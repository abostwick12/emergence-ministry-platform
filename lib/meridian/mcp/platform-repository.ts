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
  status: "creating" | "review_required";
  emma_status: "not_reviewed";
  client_name: string;
  idempotency_key: string;
};

type BundleItemRow = {
  id: string;
  bundle_id: string;
  artifact_kind: CreatePlatformResourceBundleInput["items"][number]["kind"];
  title: string;
  content_hash: string;
  attachment_id: string | null;
  position: number;
  status: "creating" | "review_required";
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
      .select("id,ministry_id,created_by_user_id,title,destination_type,destination_id,status,emma_status,client_name,idempotency_key")
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
          client_name: input.clientName,
          idempotency_key: input.idempotencyKey
        })
        .select("id,ministry_id,created_by_user_id,title,destination_type,destination_id,status,emma_status,client_name,idempotency_key")
        .single<BundleRow>();
      if (insertResult.error || !insertResult.data) throw storageError();
      bundle = insertResult.data;
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
      destinationType: input.destinationType,
      destinationId: input.destinationId,
      itemIds: input.items.map((item) => item.id),
      attachmentIds,
      url: input.destinationType === "event" ? `${publicOrigin()}/events?eventId=${encodeURIComponent(input.destinationId)}` : `${publicOrigin()}/leader-prep`,
      idempotentReplay: replay
    };
  }
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
