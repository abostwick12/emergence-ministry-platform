import { createHash } from "node:crypto";

import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveEmergeOperationsAccess, resolveEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import {
  createMinistryEvent,
  createMinistryTask,
  getEventWorkspace,
  getOverview,
  listMinistryTasks,
  updateMinistryEvent,
  updateMinistryTask
} from "@/lib/data/ministry-repository";
import type {
  CreatePlatformEventInput,
  CreatePlatformResourceBundleInput,
  CreatePlatformTaskInput,
  PlatformEventSummary,
  PlatformMcpRepository,
  PlatformResourceBundleResult,
  PlatformResourceBundleReviewSnapshot,
  SavePlatformResourceBundleReviewInput,
  StoredPlatformResourceBundleReview,
  PlatformTaskSummary,
  UpdatePlatformEventInput,
  UpdatePlatformTaskInput
} from "@/lib/meridian/mcp/platform-types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";
import { createMcpTextResourceAttachment, listResourceAttachments, ResourceAttachmentError } from "@/lib/resources/repository";
import type { ActiveTask, MinistryEvent } from "@/lib/types";

type BundleRow = {
  id: string;
  ministry_id: string;
  created_by_user_id: string;
  title: string;
  destination_type: "event" | "weekly_leader_prep";
  destination_id: string;
  status: "creating" | "review_required" | "changes_requested" | "blocked";
  emma_status: "not_reviewed" | "changes_required" | "blocked" | "passed";
  human_review_status?: "pending" | "approved" | "changes_requested" | "rejected";
  private_discovery_status: "not_used" | "passed";
  client_name: string;
  idempotency_key: string;
};

type PrivateProvenanceRow = {
  source_reference: string;
  content_hash: string;
  check_status: "passed";
};

type BundleItemRow = {
  id: string;
  bundle_id: string;
  artifact_kind: CreatePlatformResourceBundleInput["items"][number]["kind"];
  title: string;
  content_hash: string;
  attachment_id: string | null;
  position: number;
  status: "creating" | "review_required" | "changes_requested" | "blocked";
};

type BundleReviewRow = {
  id: string;
  bundle_id: string;
  contract_version: "1.0";
  outcome: "ready_for_human_review" | "changes_required" | "blocked" | "failed";
  summary: string | null;
  findings: StoredPlatformResourceBundleReview["findings"];
  provider: string | null;
  model: string | null;
  emma_request_id: string;
  emma_run_id: string | null;
  human_review_status: "pending";
  failure_code: string | null;
};

export class SupabasePlatformMcpRepository implements PlatformMcpRepository {
  async listEvents(session: AuthSession) {
    await requireReadAccess(session);
    return (await getOverview(session)).events.filter((event) => !event.archivedAt).map(toEventSummary);
  }

  async getEvent(session: AuthSession, eventId: string) {
    await requireReadAccess(session);
    const workspace = await getEventWorkspace(session, eventId);
    return workspace && !workspace.event.archivedAt
      ? { ...toEventSummary(workspace.event), tasks: workspace.tasks.map(toTaskSummary) }
      : null;
  }

  async listTasks(session: AuthSession, eventId?: string) {
    await requireReadAccess(session);
    const tasks = await listMinistryTasks(session);
    return tasks.filter((task) => !eventId || task.eventId === eventId).map(toTaskSummary);
  }

  async listTeamMembers(session: AuthSession) {
    await requireReadAccess(session);
    const users = (await getOverview(session)).users;
    return users
      .filter((user) => user.role === "admin" || user.role === "leader")
      .map(({ id, firstName, lastName, role }) => ({ id, firstName, lastName, role }));
  }

  async listResources(session: AuthSession, input: { destinationType: "event" | "weekly_leader_prep"; destinationId: string }) {
    await requireReadAccess(session);
    const parentType = input.destinationType === "event" ? "event" : "weekly_leader_prep";
    const resources = await listResourceAttachments(session, { parentType, parentId: input.destinationId });
    return resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      resourceType: resource.resourceType,
      createdAt: resource.createdAt,
      reviewRequired: /review (?:has not been completed|is required)|human review/i.test(resource.description),
      url: `${publicOrigin()}/api/resource-attachments/items/${encodeURIComponent(resource.id)}/open`
    }));
  }

  async createEvent(session: AuthSession, input: CreatePlatformEventInput) {
    await requireWriteAccess(session);
    const workspace = await createMinistryEvent(session, input, { recordId: input.id, suppressExternalSync: true });
    if (!workspace) throw storageError();
    return toEventSummary(workspace.event);
  }

  async updateEvent(session: AuthSession, eventId: string, input: UpdatePlatformEventInput) {
    await requireWriteAccess(session);
    const workspace = await updateMinistryEvent(session, eventId, input, { suppressExternalSync: true });
    return workspace ? toEventSummary(workspace.event) : null;
  }

  async createTask(session: AuthSession, input: CreatePlatformTaskInput) {
    await requireWriteAccess(session);
    const task = await createMinistryTask(session, input, { recordId: input.id });
    if (!task) throw storageError();
    return toTaskSummary(task);
  }

  async updateTask(session: AuthSession, taskId: string, input: UpdatePlatformTaskInput) {
    await requireWriteAccess(session);
    const task = await updateMinistryTask(session, taskId, input);
    return task ? toTaskSummary(task) : null;
  }

  async createResourceBundle(session: AuthSession, input: CreatePlatformResourceBundleInput): Promise<PlatformResourceBundleResult> {
    await requireWriteAccess(session);
    if (!session.accessToken || session.isMock || session.isGuest) {
      throw new MeridianMcpError("live_storage_required", 409, "Resource bundles require a live Lead Emergence workspace.");
    }
    const supabase = getSupabaseAuthClient(session.accessToken);
    const existingResult = await supabase
      .from("meridian_mcp_resource_bundles")
      .select("id,ministry_id,created_by_user_id,title,destination_type,destination_id,status,emma_status,private_discovery_status,client_name,idempotency_key")
      .eq("id", input.id)
      .maybeSingle<BundleRow>();
    if (existingResult.error) throw storageError();
    let bundle = existingResult.data;
    const replay = Boolean(bundle);

    if (bundle) assertSameBundle(bundle, input);
    else {
      const insertResult = await supabase
        .from("meridian_mcp_resource_bundles")
        .insert({
          id: input.id,
          ministry_id: input.ministryId,
          created_by_user_id: input.userId,
          title: input.title,
          destination_type: input.destinationType,
          destination_id: input.destinationId,
          status: "creating",
          emma_status: "not_reviewed",
          private_discovery_status: "not_used",
          client_name: input.clientName,
          idempotency_key: input.idempotencyKey
        })
        .select("id,ministry_id,created_by_user_id,title,destination_type,destination_id,status,emma_status,private_discovery_status,client_name,idempotency_key")
        .single<BundleRow>();
      if (insertResult.error || !insertResult.data) throw storageError();
      bundle = insertResult.data;
    }

    const provenanceResult = await supabase
      .from("meridian_mcp_bundle_private_provenance")
      .select("source_reference,content_hash,check_status")
      .eq("bundle_id", input.id)
      .order("source_reference", { ascending: true })
      .returns<PrivateProvenanceRow[]>();
    if (provenanceResult.error) throw storageError();
    let savedProvenance = provenanceResult.data ?? [];
    if (input.privateDiscoveryProvenance.length && !savedProvenance.length) {
      const insertProvenance = await supabase
        .from("meridian_mcp_bundle_private_provenance")
        .insert(input.privateDiscoveryProvenance.map((source) => ({
          ministry_id: input.ministryId,
          bundle_id: input.id,
          source_reference: source.sourceReference,
          content_hash: source.contentHash,
          check_status: "passed"
        })))
        .select("source_reference,content_hash,check_status")
        .returns<PrivateProvenanceRow[]>();
      if (insertProvenance.error) throw storageError();
      savedProvenance = insertProvenance.data ?? [];
    }
    assertSamePrivateProvenance(savedProvenance, input);
    if (input.privateDiscoveryStatus === "passed" && bundle.private_discovery_status !== "passed") {
      const markPrivateCheck = await supabase
        .from("meridian_mcp_resource_bundles")
        .update({ private_discovery_status: "passed" })
        .eq("id", input.id);
      if (markPrivateCheck.error) throw storageError();
      bundle.private_discovery_status = "passed";
    }

    const itemResult = await supabase
      .from("meridian_mcp_resource_bundle_items")
      .select("id,bundle_id,artifact_kind,title,content_hash,attachment_id,position,status")
      .eq("bundle_id", input.id)
      .order("position", { ascending: true })
      .returns<BundleItemRow[]>();
    if (itemResult.error) throw storageError();
    let savedItems = itemResult.data ?? [];
    if (!savedItems.length) {
      const insertItems = await supabase
        .from("meridian_mcp_resource_bundle_items")
        .insert(input.items.map((item) => ({
          id: item.id,
          ministry_id: input.ministryId,
          bundle_id: input.id,
          artifact_kind: item.kind,
          title: item.title,
          content_hash: hashText(item.bodyMarkdown),
          attachment_id: null,
          position: item.position,
          status: "creating"
        })))
        .select("id,bundle_id,artifact_kind,title,content_hash,attachment_id,position,status")
        .returns<BundleItemRow[]>();
      if (insertItems.error) throw storageError();
      savedItems = insertItems.data ?? [];
    }
    assertSameItems(savedItems, input);

    const parentType = input.destinationType === "event" ? "event" : "weekly_leader_prep";
    const attachmentIds: string[] = [];
    for (const item of input.items) {
      let attachment;
      try {
        attachment = await createMcpTextResourceAttachment(session, {
          attachmentId: item.attachmentId,
          parentType,
          parentId: input.destinationId,
          title: item.title,
          bodyMarkdown: item.bodyMarkdown,
          description: `${item.kind.replace(/_/g, " ")} draft created through MCP. EMMA review has not been completed. Human review is required.`
        });
      } catch (error) {
        if (error instanceof ResourceAttachmentError) {
          throw new MeridianMcpError(error.code, error.status, error.message);
        }
        throw error;
      }
      attachmentIds.push(attachment.id);
      const updateItem = await supabase
        .from("meridian_mcp_resource_bundle_items")
        .update({ attachment_id: attachment.id, status: "review_required" })
        .eq("id", item.id)
        .eq("bundle_id", input.id);
      if (updateItem.error) throw storageError();
    }

    const complete = await supabase
      .from("meridian_mcp_resource_bundles")
      .update({ status: "review_required" })
      .eq("id", input.id);
    if (complete.error) throw storageError();

    return {
      id: input.id,
      status: "review_required",
      emmaStatus: "not_reviewed",
      privateDiscoveryStatus: input.privateDiscoveryStatus,
      destinationType: input.destinationType,
      destinationId: input.destinationId,
      itemIds: input.items.map((item) => item.id),
      attachmentIds,
      url: input.destinationType === "event" ? `${publicOrigin()}/events?eventId=${encodeURIComponent(input.destinationId)}` : `${publicOrigin()}/leader-prep`,
      idempotentReplay: replay
    };
  }

  async getResourceBundleForReview(session: AuthSession, bundleId: string): Promise<PlatformResourceBundleReviewSnapshot | null> {
    await requireWriteAccess(session);
    if (!session.accessToken || session.isMock || session.isGuest) {
      throw new MeridianMcpError("live_storage_required", 409, "EMMA bundle review requires a live Lead Emergence workspace.");
    }
    const supabase = getSupabaseAuthClient(session.accessToken);
    const bundleResult = await supabase
      .from("meridian_mcp_resource_bundles")
      .select("id,ministry_id,created_by_user_id,title,destination_type,destination_id,status,emma_status,private_discovery_status,human_review_status,client_name,idempotency_key")
      .eq("id", bundleId)
      .maybeSingle<BundleRow>();
    if (bundleResult.error) throw storageError();
    if (!bundleResult.data) return null;
    const itemResult = await supabase
      .from("meridian_mcp_resource_bundle_items")
      .select("id,bundle_id,artifact_kind,title,content_hash,attachment_id,position,status")
      .eq("bundle_id", bundleId)
      .order("position", { ascending: true })
      .returns<BundleItemRow[]>();
    if (itemResult.error) throw storageError();
    const bundle = bundleResult.data;
    return {
      id: bundle.id,
      ministryId: bundle.ministry_id,
      createdByUserId: bundle.created_by_user_id,
      title: bundle.title,
      destinationType: bundle.destination_type,
      destinationId: bundle.destination_id,
      status: bundle.status,
      emmaStatus: bundle.emma_status,
      humanReviewStatus: bundle.human_review_status ?? "pending",
      privateDiscoveryStatus: bundle.private_discovery_status,
      items: (itemResult.data ?? []).map((item) => ({
        id: item.id,
        kind: item.artifact_kind,
        title: item.title,
        contentHash: item.content_hash,
        attachmentId: item.attachment_id,
        position: item.position,
        status: item.status
      }))
    };
  }

  async findResourceBundleReview(
    session: AuthSession,
    bundleId: string,
    idempotencyKey: string
  ): Promise<StoredPlatformResourceBundleReview | null> {
    await requireWriteAccess(session);
    if (!session.accessToken || session.isMock || session.isGuest) return null;
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("meridian_mcp_bundle_reviews")
      .select("id,bundle_id,contract_version,outcome,summary,findings,provider,model,emma_request_id,emma_run_id,human_review_status,failure_code")
      .eq("bundle_id", bundleId)
      .eq("created_by_user_id", session.user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<BundleReviewRow>();
    if (result.error) throw storageError();
    if (!result.data) return null;
    const bundle = await this.getResourceBundleForReview(session, bundleId);
    if (!bundle) return null;
    return toStoredReview(result.data, reviewUrl(bundle));
  }

  async saveResourceBundleReview(
    session: AuthSession,
    input: SavePlatformResourceBundleReviewInput
  ): Promise<StoredPlatformResourceBundleReview> {
    await requireWriteAccess(session);
    if (!session.accessToken || session.isMock || session.isGuest) {
      throw new MeridianMcpError("live_storage_required", 409, "EMMA bundle review requires a live Lead Emergence workspace.");
    }
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase.rpc("save_meridian_mcp_bundle_review", {
      p_review_id: input.id,
      p_bundle_id: input.bundleId,
      p_ministry_id: input.ministryId,
      p_idempotency_key: input.idempotencyKey,
      p_contract_version: input.contractVersion,
      p_content_fingerprint: input.contentFingerprint,
      p_outcome: input.outcome,
      p_summary: input.summary,
      p_findings: input.findings,
      p_evidence: input.evidence,
      p_provider: input.provider,
      p_model: input.model,
      p_emma_request_id: input.emmaRequestId,
      p_emma_run_id: input.emmaRunId,
      p_failure_code: input.failureCode,
      p_private_discovery_status: input.privateDiscoveryStatus
    });
    if (result.error) throw storageError();
    const saved = await this.findResourceBundleReview(session, input.bundleId, input.idempotencyKey);
    if (!saved) throw storageError();
    return saved;
  }
}

function toStoredReview(row: BundleReviewRow, url: string): StoredPlatformResourceBundleReview {
  if (row.outcome === "failed") {
    return {
      id: row.id,
      bundleId: row.bundle_id,
      contractVersion: row.contract_version,
      outcome: "failed",
      summary: null,
      findings: [],
      provider: null,
      model: null,
      emmaRequestId: row.emma_request_id,
      emmaRunId: null,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url,
      failureCode: row.failure_code ?? "provider_error"
    };
  }
  if (!row.summary || !row.provider || !row.model || !row.emma_run_id) throw storageError();
  return {
    id: row.id,
    bundleId: row.bundle_id,
    contractVersion: row.contract_version,
    outcome: row.outcome,
    summary: row.summary,
    findings: row.findings,
    provider: row.provider,
    model: row.model,
    emmaRequestId: row.emma_request_id,
    emmaRunId: row.emma_run_id,
    humanReviewRequired: true,
    humanReviewStatus: "pending",
    url
  };
}

function reviewUrl(bundle: Pick<PlatformResourceBundleReviewSnapshot, "destinationType" | "destinationId">) {
  return bundle.destinationType === "event"
    ? `${publicOrigin()}/events?eventId=${encodeURIComponent(bundle.destinationId)}`
    : `${publicOrigin()}/leader-prep`;
}

async function requireReadAccess(session: AuthSession) {
  const access = await resolveEmergeOperationsAccess(session);
  if (!access.allowed) throw accessError(access.response);
}

async function requireWriteAccess(session: AuthSession) {
  const access = await resolveEmergeOperationsWriteAccess(session);
  if (!access.allowed) throw accessError(access.response);
}

function accessError(response: Response) {
  return new MeridianMcpError("platform_access_denied", response.status || 403, "Your Lead Emergence role or save settings do not permit this platform operation.");
}

function toEventSummary(event: MinistryEvent): PlatformEventSummary {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    startTime: event.startTime,
    endTime: event.endTime,
    status: event.status,
    location: event.location,
    targetGroup: event.targetGroup,
    priority: event.priority,
    contactOwnerId: event.contactOwnerId,
    notes: event.notes,
    url: `${publicOrigin()}/events?eventId=${encodeURIComponent(event.id)}`
  };
}

function toTaskSummary(task: ActiveTask): PlatformTaskSummary {
  return {
    id: task.id,
    eventId: task.eventId,
    taskTitle: task.taskTitle,
    dueDate: task.dueDate,
    assignedUserId: task.assignedUserId,
    status: task.status,
    notes: task.notes,
    url: `${publicOrigin()}/tasks?taskId=${encodeURIComponent(task.id)}`
  };
}

function assertSameBundle(bundle: BundleRow, input: CreatePlatformResourceBundleInput) {
  if (
    bundle.ministry_id !== input.ministryId
    || bundle.created_by_user_id !== input.userId
    || bundle.title !== input.title
    || bundle.destination_type !== input.destinationType
    || bundle.destination_id !== input.destinationId
    || bundle.idempotency_key !== input.idempotencyKey
  ) throw new MeridianMcpError("idempotency_conflict", 409, "That idempotency key has already been used for a different resource bundle.");
}

function assertSamePrivateProvenance(rows: PrivateProvenanceRow[], input: CreatePlatformResourceBundleInput) {
  if (rows.length !== input.privateDiscoveryProvenance.length) {
    throw new MeridianMcpError("idempotency_conflict", 409, "That resource bundle does not match the prior private-discovery check.");
  }
  for (const source of input.privateDiscoveryProvenance) {
    if (!rows.some((row) => row.source_reference === source.sourceReference && row.content_hash === source.contentHash && row.check_status === "passed")) {
      throw new MeridianMcpError("idempotency_conflict", 409, "That resource bundle does not match the prior private-discovery check.");
    }
  }
}

function assertSameItems(rows: BundleItemRow[], input: CreatePlatformResourceBundleInput) {
  if (rows.length !== input.items.length) throw new MeridianMcpError("idempotency_conflict", 409, "That resource bundle does not match the prior request.");
  for (const item of input.items) {
    const row = rows.find((candidate) => candidate.id === item.id);
    if (!row || row.artifact_kind !== item.kind || row.title !== item.title || row.content_hash !== hashText(item.bodyMarkdown)) {
      throw new MeridianMcpError("idempotency_conflict", 409, "That resource bundle does not match the prior request.");
    }
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configured) return "https://www.leademergence.com";
  return configured.startsWith("http://") || configured.startsWith("https://") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
}

function storageError() {
  return new MeridianMcpError("platform_storage_unavailable", 503, "Lead Emergence platform storage is not ready. The operation did not complete.");
}
