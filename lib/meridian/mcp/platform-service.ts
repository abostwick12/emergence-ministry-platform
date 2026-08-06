import { createHash } from "node:crypto";

import type { AuthSession } from "@/lib/auth/server";
import { deterministicMcpUuid } from "@/lib/meridian/mcp/idempotency";
import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import { inspectPrivateFragmentLeakage } from "@/lib/meridian/knowledge/leakage-firewall";
import {
  runResourceBundleEmmaReview,
  type ResourceBundleReviewProviderInput,
  type ResourceBundleReviewProviderResult
} from "@/lib/emma/providers/resource-bundle-review";
import type { MeridianMcpRepository } from "@/lib/meridian/mcp/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";
import type {
  PlatformMcpRepository,
  PlatformEmmaReviewFinding,
  PlatformResourceKind,
  UpdatePlatformEventInput,
  UpdatePlatformTaskInput
} from "@/lib/meridian/mcp/platform-types";
import type { EventType, TaskStatus } from "@/lib/types";

type MutationMeta = { clientName: string; idempotencyKey: string; confirmed: true };

export class PlatformMcpService {
  constructor(
    private readonly grantRepository: MeridianMcpRepository,
    private readonly repository: PlatformMcpRepository,
    private readonly reviewProvider: (
      session: AuthSession,
      input: ResourceBundleReviewProviderInput
    ) => Promise<ResourceBundleReviewProviderResult> = runResourceBundleEmmaReview
  ) {}

  async listEvents(session: AuthSession, input: { query?: string; from?: string; to?: string }) {
    await this.grantRepository.requireGrant(session, "read_platform");
    const query = input.query?.trim().toLowerCase();
    const from = input.from ? requireDate(input.from, "from") : undefined;
    const to = input.to ? requireDate(input.to, "to") : undefined;
    if (from && to && from > to) throw new MeridianMcpError("invalid_date_range", 400, "The beginning of the event range must be before its end.");
    const events = await this.repository.listEvents(session);
    return {
      events: events.filter((event) => {
        if (query && !`${event.title} ${event.description} ${event.location ?? ""} ${event.targetGroup ?? ""}`.toLowerCase().includes(query)) return false;
        if (from && new Date(event.endTime) < from) return false;
        if (to && new Date(event.startTime) > to) return false;
        return true;
      }).slice(0, 100)
    };
  }

  async getEvent(session: AuthSession, eventId: string) {
    await this.grantRepository.requireGrant(session, "read_platform");
    const event = await this.repository.getEvent(session, requireUuid(eventId, "event"));
    if (!event) throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    return event;
  }

  async listTasks(session: AuthSession, input: { eventId?: string; status?: TaskStatus }) {
    await this.grantRepository.requireGrant(session, "read_platform");
    const eventId = input.eventId ? requireUuid(input.eventId, "event") : undefined;
    const tasks = await this.repository.listTasks(session, eventId);
    return { tasks: tasks.filter((task) => !input.status || task.status === input.status).slice(0, 200) };
  }

  async listTeamMembers(session: AuthSession) {
    await this.grantRepository.requireGrant(session, "read_platform");
    return { teamMembers: await this.repository.listTeamMembers(session) };
  }

  async listResources(session: AuthSession, input: { destinationType: "event" | "weekly_leader_prep"; destinationId: string }) {
    await this.grantRepository.requireGrant(session, "read_platform");
    const destinationId = input.destinationType === "event"
      ? requireUuid(input.destinationId, "event")
      : requireCurrentWeek(input.destinationId);
    if (input.destinationType === "event" && !(await this.repository.getEvent(session, destinationId))) {
      throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    }
    return { resources: await this.repository.listResources(session, { ...input, destinationId }) };
  }

  async createEvent(session: AuthSession, input: {
    title: string;
    description: string;
    type: EventType;
    startTime: string;
    endTime: string;
    location?: string;
    targetGroup?: string;
    priority?: string;
    contactOwnerId?: string;
  } & MutationMeta) {
    const grant = await this.grantRepository.requireGrant(session, "manage_events");
    requireConfirmation(input.confirmed);
    const start = requireDate(input.startTime, "startTime");
    const end = requireDate(input.endTime, "endTime");
    if (end <= start) throw new MeridianMcpError("invalid_event_time", 400, "The event end time must be after its start time.");
    const id = mutationId(grant.ministryId, session.user.id, "create_event", input.idempotencyKey);
    const existing = await this.repository.getEvent(session, id);
    if (existing) {
      ensureCreateMatches(existing, { title: input.title, startTime: start.toISOString(), endTime: end.toISOString() });
      return { event: existing, idempotentReplay: true };
    }
    if (input.contactOwnerId) await requireAssignableTeamMember(this.repository, session, input.contactOwnerId);
    const event = await this.repository.createEvent(session, {
      id,
      title: requireText(input.title, "title", 160),
      description: requireText(input.description, "description", 4000),
      type: input.type,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      location: optionalText(input.location, 240),
      targetGroup: optionalText(input.targetGroup, 240),
      priority: optionalText(input.priority, 40),
      contactOwnerId: input.contactOwnerId ? requireUuid(input.contactOwnerId, "team member") : undefined
    });
    ensureCreateMatches(event, { title: input.title, startTime: start.toISOString(), endTime: end.toISOString() });
    return { event, idempotentReplay: false };
  }

  async updateEvent(session: AuthSession, eventId: string, input: UpdatePlatformEventInput & MutationMeta) {
    await this.grantRepository.requireGrant(session, "manage_events");
    requireConfirmation(input.confirmed);
    const id = requireUuid(eventId, "event");
    const current = await this.repository.getEvent(session, id);
    if (!current) throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    const patch = normalizeEventPatch(input);
    const nextStart = patch.startTime ?? current.startTime;
    const nextEnd = patch.endTime ?? current.endTime;
    if (new Date(nextEnd) <= new Date(nextStart)) {
      throw new MeridianMcpError("invalid_event_time", 400, "The event end time must be after its start time.");
    }
    if (patch.contactOwnerId) await requireAssignableTeamMember(this.repository, session, patch.contactOwnerId);
    const changed = changedEventPatch(current, patch);
    if (!Object.keys(changed).length) return { event: current, idempotentReplay: true };
    const event = await this.repository.updateEvent(session, id, changed);
    if (!event) throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    return { event, idempotentReplay: false };
  }

  async createTask(session: AuthSession, input: {
    eventId: string;
    taskTitle: string;
    dueDate: string;
    assignedUserId: string;
    status?: TaskStatus;
  } & MutationMeta) {
    const grant = await this.grantRepository.requireGrant(session, "manage_tasks");
    requireConfirmation(input.confirmed);
    const normalizedEventId = requireUuid(input.eventId, "event");
    const assignedUserId = requireUuid(input.assignedUserId, "team member");
    if (!(await this.repository.getEvent(session, normalizedEventId))) {
      throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    }
    await requireAssignableTeamMember(this.repository, session, assignedUserId);
    const id = mutationId(grant.ministryId, session.user.id, "create_task", input.idempotencyKey);
    const existing = (await this.repository.listTasks(session)).find((task) => task.id === id);
    if (existing) {
      if (existing.eventId !== normalizedEventId || existing.taskTitle !== input.taskTitle.trim()) {
        throw new MeridianMcpError("idempotency_conflict", 409, "That idempotency key has already been used for a different task.");
      }
      return { task: existing, idempotentReplay: true };
    }
    const task = await this.repository.createTask(session, {
      id,
      eventId: normalizedEventId,
      taskTitle: requireText(input.taskTitle, "taskTitle", 240),
      dueDate: requireDate(input.dueDate, "dueDate").toISOString(),
      assignedUserId,
      status: input.status
    });
    if (task.id !== id || task.eventId !== input.eventId || task.taskTitle !== input.taskTitle.trim()) {
      throw new MeridianMcpError("idempotency_conflict", 409, "That idempotency key has already been used for a different task.");
    }
    return { task, idempotentReplay: false };
  }

  async updateTask(session: AuthSession, taskId: string, input: UpdatePlatformTaskInput & MutationMeta) {
    await this.grantRepository.requireGrant(session, "manage_tasks");
    requireConfirmation(input.confirmed);
    const id = requireUuid(taskId, "task");
    const current = (await this.repository.listTasks(session)).find((task) => task.id === id);
    if (!current) throw new MeridianMcpError("task_not_found", 404, "That task is not available in your ministry workspace.");
    const patch = normalizeTaskPatch(input);
    if (patch.assignedUserId) await requireAssignableTeamMember(this.repository, session, patch.assignedUserId);
    const changed = changedTaskPatch(current, patch);
    if (!Object.keys(changed).length) return { task: current, idempotentReplay: true };
    const task = await this.repository.updateTask(session, id, changed);
    if (!task) throw new MeridianMcpError("task_not_found", 404, "That task is not available in your ministry workspace.");
    return { task, idempotentReplay: false };
  }

  async createResourceBundle(session: AuthSession, input: {
    title: string;
    destinationType: "event" | "weekly_leader_prep";
    destinationId: string;
    items: Array<{ kind: PlatformResourceKind; title: string; bodyMarkdown: string }>;
    privateDiscovery?: Array<{ sourceReference: string; contentHash: string; rawText: string }>;
  } & MutationMeta) {
    const grant = await this.grantRepository.requireGrant(session, "save_resources");
    requireConfirmation(input.confirmed);
    const destinationId = input.destinationType === "event"
      ? requireUuid(input.destinationId, "event")
      : requireCurrentWeek(input.destinationId);
    if (input.destinationType === "event" && !(await this.repository.getEvent(session, destinationId))) {
      throw new MeridianMcpError("event_not_found", 404, "That event is not available in your ministry workspace.");
    }
    const prohibited = detectProhibitedInference(input.items.map((item) => `${item.title}\n${item.bodyMarkdown}`).join("\n\n"));
    if (prohibited.prohibited) {
      throw new MeridianMcpError(
        "prohibited_inference",
        422,
        "This resource bundle makes a prohibited personal, spiritual, medical, mental-health, motive, or divine-intent inference. Revise it before saving."
      );
    }
    const privateDiscovery = await normalizePrivateDiscovery(input.privateDiscovery ?? []);
    if (privateDiscovery.length) {
      const leakage = await inspectPrivateFragmentLeakage(
        input.items.map((item) => `${item.title}\n${item.bodyMarkdown}`).join("\n\n"),
        privateDiscovery.map((fragment) => ({
          id: fragment.sourceReference,
          contentHash: fragment.contentHash,
          rawText: fragment.rawText
        }))
      );
      if (!leakage.ok) {
        throw new MeridianMcpError(
          "private_discovery_leakage",
          422,
          "This bundle contains exact or high-similarity private-note language. Revise it locally before saving; no resource was stored."
        );
      }
    }
    const bundleId = mutationId(grant.ministryId, session.user.id, "create_resource_bundle", input.idempotencyKey);
    const items = input.items.map((item, position) => ({
      id: deterministicMcpUuid(bundleId, "item", String(position)),
      attachmentId: deterministicMcpUuid(bundleId, "attachment", String(position)),
      kind: item.kind,
      title: requireText(item.title, "item title", 160),
      bodyMarkdown: requireText(item.bodyMarkdown, "item body", 30000),
      position
    }));
    return this.repository.createResourceBundle(session, {
      id: bundleId,
      ministryId: grant.ministryId,
      userId: session.user.id,
      clientName: sanitizeClientName(input.clientName),
      idempotencyKey: input.idempotencyKey,
      title: requireText(input.title, "title", 240),
      destinationType: input.destinationType,
      destinationId,
      privateDiscoveryStatus: privateDiscovery.length ? "passed" : "not_used",
      privateDiscoveryProvenance: privateDiscovery.map(({ sourceReference, contentHash }) => ({ sourceReference, contentHash })),
      items
    });
  }

  async submitBundleForEmmaReview(session: AuthSession, input: {
    bundleId: string;
    audience: string;
    items: Array<{ itemId: string; bodyMarkdown: string; claimIds: string[] }>;
  } & MutationMeta) {
    const grant = await this.grantRepository.requireGrant(session, "review_resources");
    requireConfirmation(input.confirmed);
    const bundleId = requireUuid(input.bundleId, "resource bundle");
    const idempotencyKey = requireText(input.idempotencyKey, "idempotencyKey", 120);
    const existing = await this.repository.findResourceBundleReview(session, bundleId, idempotencyKey);
    if (existing) {
      if (existing.outcome === "failed") {
        throw new MeridianMcpError("emma_review_failed", 503, "The prior EMMA review attempt failed safely. Use a new idempotency key to retry.");
      }
      return { ...existing, idempotentReplay: true };
    }
    const bundle = await this.repository.getResourceBundleForReview(session, bundleId);
    if (!bundle || (bundle.createdByUserId !== session.user.id && grant.accessLevel !== "admin")) {
      throw new MeridianMcpError("resource_bundle_not_found", 404, "That resource bundle is not available for review.");
    }
    if (bundle.emmaStatus !== "not_reviewed" || bundle.status !== "review_required") {
      throw new MeridianMcpError("resource_bundle_already_reviewed", 409, "This exact bundle has already entered an EMMA or human review state.");
    }
    const audience = requireText(input.audience, "audience", 240);
    const submittedItems = normalizeReviewItems(bundle.items, input.items);
    const destination = bundle.destinationType === "event"
      ? await reviewEventDestination(this.repository, session, bundle.destinationId, audience)
      : {
          type: "weekly_leader_prep" as const,
          id: bundle.destinationId,
          title: "Current weekly leader preparation",
          description: "Shared weekly sermon-development and leader-equipping workspace.",
          audience,
          startsAt: null
        };
    const deterministicFindings = deterministicReviewFindings(bundle.items, submittedItems);
    const providerItems: ResourceBundleReviewProviderInput["items"] = [];
    const evidenceRows = [];
    const allowedEvidenceRefs = new Set<string>();
    deterministicFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => allowedEvidenceRefs.add(ref)));
    for (const submitted of submittedItems) {
      const evidence = [];
      for (const claimId of submitted.claimIds) {
        const claim = await this.grantRepository.fetch(session, claimId);
        if (!claim) {
          throw new MeridianMcpError("approved_grounding_not_found", 422, "Every grounding claim must still be approved and available to this ministry.");
        }
        allowedEvidenceRefs.add(claim.id);
        claim.metadata.fragmentIds.forEach((id) => allowedEvidenceRefs.add(id));
        evidence.push({
          id: claim.id,
          title: claim.title,
          text: claim.text,
          authorityClass: claim.metadata.authorityClass,
          attribution: claim.metadata.attribution,
          quotePermission: claim.metadata.quotePermission,
          fragmentIds: claim.metadata.fragmentIds
        });
        evidenceRows.push({
          itemId: submitted.itemId,
          claimId: claim.id,
          fragmentIds: claim.metadata.fragmentIds,
          authorityClass: claim.metadata.authorityClass,
          quotePermission: claim.metadata.quotePermission
        });
      }
      const item = bundle.items.find((candidate) => candidate.id === submitted.itemId)!;
      providerItems.push({ id: item.id, kind: item.kind, title: item.title, bodyMarkdown: submitted.bodyMarkdown, evidence });
    }
    const contentFingerprint = await sha256(JSON.stringify({
      audience,
      bundleId,
      items: submittedItems.map((item) => ({ itemId: item.itemId, bodyHash: item.bodyHash, claimIds: item.claimIds }))
    }));
    const reviewId = mutationId(grant.ministryId, session.user.id, "submit_bundle_for_emma_review", idempotencyKey);
    const provider = await this.reviewProvider(session, {
      reviewId,
      bundleId,
      title: bundle.title,
      destination,
      privateDiscoveryStatus: bundle.privateDiscoveryStatus,
      items: providerItems
    });
    if (!provider.ok) {
      await this.repository.saveResourceBundleReview(session, {
        id: reviewId,
        bundleId,
        ministryId: grant.ministryId,
        userId: session.user.id,
        idempotencyKey,
        contractVersion: "1.0",
        contentFingerprint,
        outcome: "failed",
        summary: null,
        findings: [],
        evidence: evidenceRows,
        provider: null,
        model: null,
        emmaRequestId: provider.requestId,
        emmaRunId: null,
        failureCode: provider.failureCode,
        privateDiscoveryStatus: bundle.privateDiscoveryStatus
      });
      throw new MeridianMcpError("emma_review_failed", 503, "EMMA could not complete a valid bundle review. The bundle remains unreviewed and no human approval was granted.");
    }
    let providerFindings: PlatformEmmaReviewFinding[];
    try {
      providerFindings = validateProviderFindings(provider.review.findings, bundle.items.map((item) => item.id), allowedEvidenceRefs);
    } catch (error) {
      await this.repository.saveResourceBundleReview(session, {
        id: reviewId,
        bundleId,
        ministryId: grant.ministryId,
        userId: session.user.id,
        idempotencyKey,
        contractVersion: "1.0",
        contentFingerprint,
        outcome: "failed",
        summary: null,
        findings: [],
        evidence: evidenceRows,
        provider: null,
        model: null,
        emmaRequestId: provider.requestId,
        emmaRunId: null,
        failureCode: "invalid_emma_review",
        privateDiscoveryStatus: bundle.privateDiscoveryStatus
      });
      throw error;
    }
    const findings = [...deterministicFindings, ...providerFindings];
    const outcome = enforcedReviewOutcome(provider.review.outcome, findings);
    const saved = await this.repository.saveResourceBundleReview(session, {
      id: reviewId,
      bundleId,
      ministryId: grant.ministryId,
      userId: session.user.id,
      idempotencyKey,
      contractVersion: "1.0",
      contentFingerprint,
      outcome,
      summary: provider.review.summary,
      findings,
      evidence: evidenceRows,
      provider: provider.provider,
      model: provider.model,
      emmaRequestId: provider.requestId,
      emmaRunId: provider.runId,
      failureCode: null,
      privateDiscoveryStatus: bundle.privateDiscoveryStatus
    });
    if (saved.outcome === "failed") {
      throw new MeridianMcpError("emma_review_failed", 503, "EMMA review storage failed safely.");
    }
    return { ...saved, idempotentReplay: false };
  }
}

function normalizeReviewItems(
  stored: Array<{ id: string; contentHash: string }>,
  submitted: Array<{ itemId: string; bodyMarkdown: string; claimIds: string[] }>
) {
  if (submitted.length !== stored.length) {
    throw new MeridianMcpError("incomplete_bundle_review", 400, "EMMA must review every artifact in the bundle together.");
  }
  const seen = new Set<string>();
  return submitted.map((item) => {
    const itemId = requireUuid(item.itemId, "bundle item");
    if (seen.has(itemId)) throw new MeridianMcpError("duplicate_bundle_item", 400, "Each bundle artifact may appear only once.");
    seen.add(itemId);
    const row = stored.find((candidate) => candidate.id === itemId);
    if (!row) throw new MeridianMcpError("bundle_item_not_found", 404, "A submitted artifact is not part of this bundle.");
    const bodyMarkdown = requireText(item.bodyMarkdown, "bodyMarkdown", 30000);
    const bodyHash = createStableHash(bodyMarkdown);
    if (bodyHash !== row.contentHash) {
      throw new MeridianMcpError("bundle_content_changed", 409, "An artifact no longer matches the saved bundle. Save a new revision before EMMA review.");
    }
    const claimIds = Array.from(new Set(item.claimIds.map((id) => requireUuid(id, "Meridian claim"))));
    if (claimIds.length > 20) throw new MeridianMcpError("grounding_limit", 400, "Each artifact may reference at most 20 approved Meridian claims.");
    return { itemId, bodyMarkdown, bodyHash, claimIds };
  });
}

function deterministicReviewFindings(
  stored: Array<{ id: string; attachmentId: string | null }>,
  submitted: Array<{ itemId: string; bodyMarkdown: string; claimIds: string[] }>
): PlatformEmmaReviewFinding[] {
  const findings: PlatformEmmaReviewFinding[] = [];
  for (const item of submitted) {
    if (!item.claimIds.length) findings.push({
      code: "approved_grounding_missing",
      category: "grounding",
      severity: "required_change",
      artifactId: item.itemId,
      message: "This artifact has no approved Meridian claim provenance. Add applicable grounding or explain the intentionally ungrounded creative section during human review.",
      evidenceRefs: ["rule:approved_grounding_required"]
    });
    const prohibited = detectProhibitedInference(item.bodyMarkdown);
    if (prohibited.prohibited) findings.push({
      code: prohibited.code,
      category: "prohibited_inference",
      severity: "blocker",
      artifactId: item.itemId,
      message: "This artifact contains a prohibited personal, spiritual, medical, mental-health, motive, or divine-intent inference.",
      evidenceRefs: [`rule:${prohibited.code}`]
    });
    if (!stored.find((row) => row.id === item.itemId)?.attachmentId) findings.push({
      code: "resource_linkage_incomplete",
      category: "linkage",
      severity: "blocker",
      artifactId: item.itemId,
      message: "This artifact is not attached to its destination workspace.",
      evidenceRefs: ["rule:bundle_attachment_required"]
    });
  }
  return findings;
}

function validateProviderFindings(findings: PlatformEmmaReviewFinding[], artifactIds: string[], evidenceRefs: Set<string>) {
  const artifacts = new Set(artifactIds);
  for (const finding of findings) {
    if (finding.artifactId && !artifacts.has(finding.artifactId)) {
      throw new MeridianMcpError("invalid_emma_review", 503, "EMMA returned a finding for an artifact outside this bundle.");
    }
    if (finding.evidenceRefs.some((ref) => !evidenceRefs.has(ref))) {
      throw new MeridianMcpError("invalid_emma_review", 503, "EMMA returned a finding with evidence outside the approved review context.");
    }
  }
  return findings;
}

function enforcedReviewOutcome(
  providerOutcome: "ready_for_human_review" | "changes_required" | "blocked",
  findings: PlatformEmmaReviewFinding[]
) {
  if (providerOutcome === "blocked" || findings.some((finding) => finding.severity === "blocker")) return "blocked" as const;
  if (providerOutcome === "changes_required" || findings.some((finding) => finding.severity === "required_change")) return "changes_required" as const;
  return "ready_for_human_review" as const;
}

async function reviewEventDestination(repository: PlatformMcpRepository, session: AuthSession, eventId: string, audience: string) {
  const event = await repository.getEvent(session, eventId);
  if (!event) throw new MeridianMcpError("event_not_found", 404, "The bundle destination event is no longer available.");
  return {
    type: "event" as const,
    id: event.id,
    title: event.title,
    description: event.description,
    audience,
    startsAt: event.startTime
  };
}

function createStableHash(value: string) {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

async function normalizePrivateDiscovery(
  fragments: Array<{ sourceReference: string; contentHash: string; rawText: string }>
) {
  if (fragments.length > 16) {
    throw new MeridianMcpError("private_discovery_limit", 400, "At most 16 private discovery notes may influence one bundle.");
  }
  const seen = new Set<string>();
  const normalized = [];
  for (const fragment of fragments) {
    const sourceReference = fragment.sourceReference.trim();
    const contentHash = fragment.contentHash.trim().toLowerCase();
    const rawText = fragment.rawText.trim();
    if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(sourceReference) || !/^[0-9a-f]{64}$/.test(contentHash)) {
      throw new MeridianMcpError("invalid_private_discovery_provenance", 400, "Private discovery provenance must come from the local Obsidian connector.");
    }
    if (!rawText || rawText.length > 60000) {
      throw new MeridianMcpError("invalid_private_discovery_text", 400, "Private discovery text must contain 1 to 60000 characters.");
    }
    if (await sha256(rawText) !== contentHash) {
      throw new MeridianMcpError("private_content_hash_mismatch", 400, "Private discovery text no longer matches its local content hash.");
    }
    const key = `${sourceReference}:${contentHash}`;
    if (seen.has(key)) throw new MeridianMcpError("duplicate_private_discovery_source", 400, "Private discovery provenance cannot contain duplicates.");
    seen.add(key);
    normalized.push({ sourceReference, contentHash, rawText });
  }
  return normalized;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mutationId(ministryId: string, userId: string, tool: string, idempotencyKey: string) {
  return deterministicMcpUuid("lead-emergence-mcp", ministryId, userId, tool, idempotencyKey.trim());
}

function requireConfirmation(value: true) {
  if (value !== true) throw new MeridianMcpError("confirmation_required", 400, "The user must explicitly confirm this platform change.");
}

function requireUuid(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new MeridianMcpError(`invalid_${label.replace(/\s+/g, "_")}_id`, 400, `${label[0].toUpperCase()}${label.slice(1)} identifiers must be UUIDs returned by Lead Emergence.`);
  }
  return normalized;
}

function requireDate(value: string, field: string) {
  const date = new Date(value);
  if (!value.trim() || Number.isNaN(date.getTime())) throw new MeridianMcpError("invalid_date", 400, `${field} must be a valid ISO date or date-time.`);
  return date;
}

function requireText(value: string, field: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new MeridianMcpError("invalid_text", 400, `${field} must contain 1 to ${max} characters.`);
  return normalized;
}

function optionalText(value: string | undefined, max: number) {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (normalized.length > max) throw new MeridianMcpError("invalid_text", 400, `Text fields may not exceed ${max} characters.`);
  return normalized || undefined;
}

function requireCurrentWeek(value: string) {
  if (value.trim() !== "current-week") throw new MeridianMcpError("invalid_destination", 400, "Weekly leader-prep resources must use destinationId current-week.");
  return "current-week";
}

function sanitizeClientName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9 ._/-]/g, "").trim().slice(0, 120);
  return sanitized || "mcp-client";
}

function normalizeEventPatch(input: UpdatePlatformEventInput): UpdatePlatformEventInput {
  const patch: UpdatePlatformEventInput = {};
  if (input.title !== undefined) patch.title = requireText(input.title, "title", 160);
  if (input.description !== undefined) patch.description = requireText(input.description, "description", 4000);
  if (input.type !== undefined) patch.type = input.type;
  if (input.startTime !== undefined) patch.startTime = requireDate(input.startTime, "startTime").toISOString();
  if (input.endTime !== undefined) patch.endTime = requireDate(input.endTime, "endTime").toISOString();
  if (input.status !== undefined) patch.status = input.status;
  if (input.location !== undefined) patch.location = optionalText(input.location, 240);
  if (input.targetGroup !== undefined) patch.targetGroup = optionalText(input.targetGroup, 240);
  if (input.priority !== undefined) patch.priority = optionalText(input.priority, 40);
  if (input.contactOwnerId !== undefined) patch.contactOwnerId = input.contactOwnerId ? requireUuid(input.contactOwnerId, "team member") : undefined;
  if (input.notes !== undefined) patch.notes = optionalText(input.notes, 4000);
  return patch;
}

function normalizeTaskPatch(input: UpdatePlatformTaskInput): UpdatePlatformTaskInput {
  const patch: UpdatePlatformTaskInput = {};
  if (input.taskTitle !== undefined) patch.taskTitle = requireText(input.taskTitle, "taskTitle", 240);
  if (input.dueDate !== undefined) patch.dueDate = requireDate(input.dueDate, "dueDate").toISOString();
  if (input.assignedUserId !== undefined) patch.assignedUserId = requireUuid(input.assignedUserId, "team member");
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = optionalText(input.notes, 4000);
  return patch;
}

function changedEventPatch(current: Record<string, unknown>, patch: UpdatePlatformEventInput) {
  return Object.fromEntries(Object.entries(patch).filter(([key, value]) => !sameValue(key, current[key], value))) as UpdatePlatformEventInput;
}

function changedTaskPatch(current: Record<string, unknown>, patch: UpdatePlatformTaskInput) {
  return Object.fromEntries(Object.entries(patch).filter(([key, value]) => !sameValue(key, current[key], value))) as UpdatePlatformTaskInput;
}

function sameValue(key: string, left: unknown, right: unknown) {
  if (typeof left === "string" && typeof right === "string" && /(Time|Date)$/.test(key)) return new Date(left).getTime() === new Date(right).getTime();
  return (left ?? undefined) === (right ?? undefined);
}

function ensureCreateMatches(event: { title: string; startTime: string; endTime: string }, expected: { title: string; startTime: string; endTime: string }) {
  if (event.title !== expected.title.trim() || new Date(event.startTime).getTime() !== new Date(expected.startTime).getTime() || new Date(event.endTime).getTime() !== new Date(expected.endTime).getTime()) {
    throw new MeridianMcpError("idempotency_conflict", 409, "That idempotency key has already been used for a different event.");
  }
}

async function requireAssignableTeamMember(repository: PlatformMcpRepository, session: AuthSession, userId: string) {
  if (!(await repository.listTeamMembers(session)).some((member) => member.id === userId)) {
    throw new MeridianMcpError("team_member_not_found", 404, "That team member is not assignable in your ministry workspace.");
  }
}
