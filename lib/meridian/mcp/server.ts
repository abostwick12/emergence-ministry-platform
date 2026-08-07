import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthSession } from "@/lib/auth/server";
import { ContentStudioService } from "@/lib/meridian/content-studio/service";
import { contentGuideKinds, contentPlatforms, type ContentStudioRepository } from "@/lib/meridian/content-studio/types";
import { meridianToolSecuritySchemes } from "@/lib/meridian/mcp/oauth";
import { runPlatformMcpPilotOperation, type PlatformMcpPilotContext, type PlatformMcpPilotRepository, type PlatformMcpPilotTool } from "@/lib/meridian/mcp/pilot";
import { PlatformMcpService } from "@/lib/meridian/mcp/platform-service";
import { platformEventTypes, platformResourceKinds, platformTaskStatuses, type PlatformMcpRepository } from "@/lib/meridian/mcp/platform-types";
import { MeridianMcpService } from "@/lib/meridian/mcp/service";
import { MeridianMcpError, meridianMcpCandidateObjectTypes, meridianResourceTypes, type MeridianMcpRepository } from "@/lib/meridian/mcp/types";

export function createMeridianMcpServer(input: {
  session: AuthSession;
  repository: MeridianMcpRepository;
  contentRepository: ContentStudioRepository;
  platformRepository: PlatformMcpRepository;
  clientName: string;
  pilotRepository?: PlatformMcpPilotRepository;
}) {
  const service = new MeridianMcpService(input.repository);
  const contentStudio = new ContentStudioService(input.repository, input.contentRepository);
  const platform = new PlatformMcpService(input.repository, input.platformRepository);
  const server = new McpServer(
    { name: "lead-emergence-meridian", version: "0.6.0" },
    {
      instructions:
        "Lead Emergence tools act as the signed-in user and require explicit grants. For ministry content, always offer Start guided interview and Skip interview as equally visible choices. If guided, ask exactly one returned question at a time; let the active interviewer playbook choose follow-ups and stop when it reports ready, when the user finishes, or at six answers. Fetch the active voice, visual, and selected platform guides before drafting. Generate genuinely different platform artifacts, save them only as drafts, and invite positive or corrective feedback after each draft. Feedback only enters a pending batch; it never rewrites an active guide until an administrator explicitly approves the batch. No content tool publishes, sends, schedules, or synchronizes. Platform tools also require enrollment in the administrator-controlled pilot cohort and record payload-free safety metrics. Use approved Meridian evidence for theology and culture. Read before changing records, confirm every write, and reuse idempotency keys. Private Obsidian discovery stays in the user's local connector. EMMA outcomes still require a person. No delete, publish, send, vault-browsing, pastoral, Camp, medical, mental-health, or volunteer platform tools are available."
    }
  );

  const runPlatformTool = <T>(
    toolName: PlatformMcpPilotTool,
    context: PlatformMcpPilotContext,
    run: () => Promise<T>
  ) => runPlatformMcpPilotOperation({
    session: input.session,
    toolName,
    clientName: input.clientName,
    context,
    run,
    repository: input.pilotRepository
  });

  server.registerTool(
    "search",
    {
      title: "Search approved Meridian knowledge",
      description: "Use this when the user needs approved Lead Emergence theology, curriculum, teaching history, policy, or ministry context for developing a resource.",
      inputSchema: { query: z.string().trim().min(1).max(500) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ query }) => mcpToolResult(async () => service.search(input.session, query))
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch an approved Meridian item",
      description: "Use this after search when the user needs the approved claim, attribution, source names, and permitted quotation material for one Meridian result.",
      inputSchema: { id: z.string().trim().min(1).max(100) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ id }) => mcpToolResult(async () => service.fetch(input.session, id))
  );

  server.registerTool(
    "submit_resource_draft",
    {
      title: "Submit a ministry resource draft for review",
      description: "Use this only when the user has finished a grounded resource draft and explicitly wants it saved to Lead Emergence for human review. This never approves, publishes, or sends the resource.",
      inputSchema: {
        title: z.string().trim().min(1).max(240),
        resourceType: z.enum(meridianResourceTypes),
        audience: z.string().trim().min(1).max(120),
        taskType: z.string().trim().min(1).max(120),
        bodyMarkdown: z.string().trim().min(1).max(30000),
        claimIds: z.array(z.string().trim().min(1).max(100)).min(1).max(32),
        idempotencyKey: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9._:-]+$/)
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (draft) => mcpToolResult(async () => service.submitDraft(input.session, draft, input.clientName))
  );

  server.registerTool(
    "submit_private_discovery_candidate",
    {
      title: "Nominate private discovery material for Meridian review",
      description: "Submit one explicitly selected local Obsidian note to the Meridian candidate queue only after the user confirms. It remains private, unreviewed, authority-none, never-quote, and unusable for generation until an administrator reviews and promotes it.",
      inputSchema: {
        title: z.string().trim().min(1).max(240),
        sourceReference: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9._:-]+$/),
        rawText: z.string().trim().min(1).max(60000),
        contentHash: z.string().regex(/^[0-9a-f]{64}$/),
        objectType: z.enum(meridianMcpCandidateObjectTypes),
        summary: z.string().trim().min(1).max(800),
        topicTags: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
        scriptureReferences: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
        claimProposals: z.array(z.string().trim().min(1).max(500)).max(16).default([]),
        questionAliases: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
        questionFacets: z.array(z.string().trim().min(1).max(500)).max(4).default([]),
        confirmed: z.literal(true).describe("Set to true only after the user explicitly confirms submission of this exact private note.")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (candidate) => mcpToolResult(async () => service.submitPrivateCandidate(input.session, candidate))
  );

  server.registerTool(
    "list_events",
    {
      title: "List ministry events",
      description: "Find events in the signed-in user's Lead Emergence ministry workspace. Returns only operational event fields and stable platform links.",
      inputSchema: {
        query: z.string().trim().max(200).optional(),
        from: z.string().trim().max(40).optional(),
        to: z.string().trim().max(40).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("list_events", { operationKind: "read" }, () => platform.listEvents(input.session, toolInput)))
  );

  server.registerTool(
    "get_event",
    {
      title: "Get an event workspace",
      description: "Retrieve one event and its tasks from the signed-in user's Lead Emergence ministry workspace before planning or making changes.",
      inputSchema: { eventId: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ eventId }) => mcpToolResult(async () => runPlatformTool("get_event", { operationKind: "read", targetRecordType: "event", targetRecordId: eventId }, () => platform.getEvent(input.session, eventId)))
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List ministry tasks",
      description: "List tasks in the signed-in user's ministry, optionally limited to an event or status.",
      inputSchema: {
        eventId: z.string().uuid().optional(),
        status: z.enum(platformTaskStatuses).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("list_tasks", {
      operationKind: "read",
      ...(toolInput.eventId ? { parentRecordType: "event" as const, parentRecordId: toolInput.eventId } : {})
    }, () => platform.listTasks(input.session, toolInput)))
  );

  server.registerTool(
    "list_team_members",
    {
      title: "List assignable ministry team members",
      description: "List only the names, roles, and stable IDs of staff and leaders who can be assigned platform work. This does not expose contact or pastoral information.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async () => mcpToolResult(async () => runPlatformTool("list_team_members", { operationKind: "read" }, () => platform.listTeamMembers(input.session)))
  );

  server.registerTool(
    "list_resources",
    {
      title: "List resources in a ministry workspace",
      description: "List visible resource metadata for an event or the current weekly leader-prep workspace. Resource bodies are opened through authenticated Lead Emergence links.",
      inputSchema: {
        destinationType: z.enum(["event", "weekly_leader_prep"]),
        destinationId: z.string().trim().min(1).max(120)
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("list_resources", {
      operationKind: "read",
      parentRecordType: toolInput.destinationType,
      parentRecordId: toolInput.destinationId
    }, () => platform.listResources(input.session, toolInput)))
  );

  const mutationMeta = {
    confirmed: z.literal(true).describe("Set to true only after the user explicitly confirms this exact platform change."),
    idempotencyKey: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9._:-]+$/)
  };

  server.registerTool(
    "create_event",
    {
      title: "Create a ministry event",
      description: "Create an event and its normal baseline planning tasks only after the user explicitly confirms the exact event. This does not publish, send communications, or sync an external calendar.",
      inputSchema: {
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(4000),
        type: z.enum(platformEventTypes),
        startTime: z.string().trim().min(1).max(40),
        endTime: z.string().trim().min(1).max(40),
        location: z.string().trim().max(240).optional(),
        targetGroup: z.string().trim().max(240).optional(),
        priority: z.string().trim().max(40).optional(),
        contactOwnerId: z.string().uuid().optional(),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("create_event", { operationKind: "write", targetRecordType: "event" }, () => platform.createEvent(input.session, { ...toolInput, clientName: input.clientName })))
  );

  server.registerTool(
    "update_event",
    {
      title: "Update a ministry event",
      description: "Update selected event fields only after reading the event and receiving explicit user confirmation. This cannot delete or archive an event and does not sync an external calendar.",
      inputSchema: {
        eventId: z.string().uuid(),
        title: z.string().trim().min(1).max(160).optional(),
        description: z.string().trim().min(1).max(4000).optional(),
        type: z.enum(platformEventTypes).optional(),
        startTime: z.string().trim().min(1).max(40).optional(),
        endTime: z.string().trim().min(1).max(40).optional(),
        status: z.enum(["draft", "planning", "ready", "not_started", "in_progress", "working_on_it", "stuck", "completed"]).optional(),
        location: z.string().trim().max(240).optional(),
        targetGroup: z.string().trim().max(240).optional(),
        priority: z.string().trim().max(40).optional(),
        contactOwnerId: z.string().uuid().optional(),
        notes: z.string().trim().max(4000).optional(),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ eventId, ...toolInput }) => mcpToolResult(async () => runPlatformTool("update_event", { operationKind: "write", targetRecordType: "event", targetRecordId: eventId }, () => platform.updateEvent(input.session, eventId, { ...toolInput, clientName: input.clientName })))
  );

  server.registerTool(
    "create_task",
    {
      title: "Create a ministry task",
      description: "Create and assign a task in an existing event only after the user explicitly confirms the exact task.",
      inputSchema: {
        eventId: z.string().uuid(),
        taskTitle: z.string().trim().min(1).max(240),
        dueDate: z.string().trim().min(1).max(40),
        assignedUserId: z.string().uuid(),
        status: z.enum(platformTaskStatuses).optional(),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("create_task", {
      operationKind: "write",
      targetRecordType: "task",
      parentRecordType: "event",
      parentRecordId: toolInput.eventId
    }, () => platform.createTask(input.session, { ...toolInput, clientName: input.clientName })))
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a ministry task",
      description: "Update selected task fields only after reading the task and receiving explicit user confirmation. This cannot delete a task.",
      inputSchema: {
        taskId: z.string().uuid(),
        taskTitle: z.string().trim().min(1).max(240).optional(),
        dueDate: z.string().trim().min(1).max(40).optional(),
        assignedUserId: z.string().uuid().optional(),
        status: z.enum(platformTaskStatuses).optional(),
        notes: z.string().trim().max(4000).optional(),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ taskId, ...toolInput }) => mcpToolResult(async () => runPlatformTool("update_task", { operationKind: "write", targetRecordType: "task", targetRecordId: taskId }, () => platform.updateTask(input.session, taskId, { ...toolInput, clientName: input.clientName })))
  );

  server.registerTool(
    "create_resource_bundle",
    {
      title: "Place a resource bundle for review",
      description: "Save one to eight Markdown resource drafts in an event or the current leader-prep workspace after explicit user confirmation. Every item remains limited to authenticated ministry leaders, unreviewed by EMMA, unpublished, and unsent.",
      inputSchema: {
        title: z.string().trim().min(1).max(240),
        destinationType: z.enum(["event", "weekly_leader_prep"]),
        destinationId: z.string().trim().min(1).max(120),
        items: z.array(z.object({
          kind: z.enum(platformResourceKinds),
          title: z.string().trim().min(1).max(160),
          bodyMarkdown: z.string().trim().min(1).max(30000)
        })).min(1).max(8),
        privateDiscovery: z.array(z.object({
          sourceReference: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9._:-]+$/),
          contentHash: z.string().regex(/^[0-9a-f]{64}$/),
          rawText: z.string().trim().min(1).max(60000)
        })).max(16).optional().describe("Transient local-note check payload from the user-owned Obsidian connector. Required whenever private discovery influenced this bundle; raw text is checked and discarded, while only opaque references and hashes are retained."),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("create_resource_bundle", {
      operationKind: "write",
      targetRecordType: "resource_bundle",
      parentRecordType: toolInput.destinationType,
      parentRecordId: toolInput.destinationId,
      artifactCount: toolInput.items.length,
      privateDiscoveryStatus: toolInput.privateDiscovery?.length ? "passed" : "not_used"
    }, () => platform.createResourceBundle(input.session, { ...toolInput, clientName: input.clientName })))
  );

  server.registerTool(
    "submit_bundle_for_emma_review",
    {
      title: "Submit a saved bundle for EMMA review",
      description: "Run the complete saved resource bundle through the versioned EMMA alignment, grounding, Scripture, privacy, permission, citation, audience, and safety contract. Submit every exact saved artifact and its approved Meridian claim IDs. The result is ready for human review, changes required, or blocked; it never grants human approval or publishes anything.",
      inputSchema: {
        bundleId: z.string().uuid(),
        audience: z.string().trim().min(1).max(240),
        items: z.array(z.object({
          itemId: z.string().uuid(),
          bodyMarkdown: z.string().trim().min(1).max(30000),
          claimIds: z.array(z.string().uuid()).max(20)
        })).min(1).max(8),
        ...mutationMeta
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => runPlatformTool("submit_bundle_for_emma_review", {
      operationKind: "write",
      targetRecordType: "resource_bundle",
      targetRecordId: toolInput.bundleId,
      artifactCount: toolInput.items.length,
      groundingClaimCount: toolInput.items.reduce((total, item) => total + new Set(item.claimIds).size, 0)
    }, () => platform.submitBundleForEmmaReview(input.session, { ...toolInput, clientName: input.clientName })))
  );

  const contentDesignSchema = z.object({
    aspectRatio: z.string().trim().max(20).optional(),
    overlayText: z.string().trim().max(500).optional(),
    visualDirection: z.string().trim().max(2000).optional(),
    accessibilityText: z.string().trim().max(1000).optional()
  });

  server.registerTool(
    "get_content_guides",
    {
      title: "Get active ministry content guides",
      description: "Fetch the exact active Meridian voice, anti-slop, visual, interviewer, and selected platform guide versions before drafting. Platform rules are real format constraints, not labels.",
      inputSchema: { platforms: z.array(z.enum(contentPlatforms)).min(1).max(contentPlatforms.length) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ platforms }) => mcpToolResult(async () => contentStudio.getGuides(input.session, platforms))
  );

  server.registerTool(
    "start_content_session",
    {
      title: "Start or skip the content interview",
      description: "Start a bounded, playbook-driven interview for one topic, or take the equally supported skip-interview path. When guided, ask only the returned next question and do not invent a static questionnaire.",
      inputSchema: {
        topic: z.string().trim().min(1).max(1000),
        contentType: z.string().trim().min(1).max(120),
        platforms: z.array(z.enum(contentPlatforms)).min(1).max(contentPlatforms.length),
        skipInterview: z.boolean().describe("True when the user chose Skip interview; false when they chose Start guided interview.")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.startSession(input.session, toolInput))
  );

  server.registerTool(
    "continue_content_interview",
    {
      title: "Continue the dynamic content interview",
      description: "Record one user answer and let the active interviewer playbook choose a contextual follow-up or stop. The loop cannot exceed the session's six-question limit.",
      inputSchema: {
        sessionId: z.string().uuid(),
        answer: z.string().trim().min(1).max(5000),
        finishNow: z.boolean().default(false).describe("True when the user wants to stop interviewing and draft with the answers already given.")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.continueInterview(input.session, toolInput))
  );

  server.registerTool(
    "save_content_draft",
    {
      title: "Save a platform-specific content draft",
      description: "Save one generated platform artifact with its real design specification and exact guide provenance. This tool validates the selected platform guide and has no publish, send, schedule, or sync path.",
      inputSchema: {
        sessionId: z.string().uuid(),
        platform: z.enum(contentPlatforms),
        bodyMarkdown: z.string().trim().min(1).max(5000),
        design: contentDesignSchema.default({})
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.saveDraft(input.session, toolInput))
  );

  server.registerTool(
    "submit_content_feedback",
    {
      title: "Log feedback on a content draft",
      description: "Record positive feedback or a correction in content_feedback. This never changes an active guide; it creates learning evidence for a later reviewed batch.",
      inputSchema: {
        draftId: z.string().uuid(),
        sentiment: z.enum(["positive", "correction"]),
        feedbackText: z.string().trim().min(1).max(3000),
        guideTarget: z.enum(["voice", "visual", "platform"])
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.submitFeedback(input.session, toolInput))
  );

  server.registerTool(
    "propose_content_feedback_batch",
    {
      title: "Propose a reviewed content-learning batch",
      description: "Batch feedback from at least three distinct drafts into explicit proposed guide changes. The batch remains pending and does not change any active guide.",
      inputSchema: {
        feedbackIds: z.array(z.string().uuid()).min(3).max(100),
        changes: z.array(z.object({
          sourceGuideVersionId: z.string().uuid(),
          proposedBodyMarkdown: z.string().trim().min(1).max(30000),
          proposedGuideData: z.record(z.unknown()),
          changeSummary: z.string().trim().min(1).max(1000)
        })).min(1).max(9)
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.proposeFeedbackBatch(input.session, toolInput))
  );

  server.registerTool(
    "approve_content_feedback_batch",
    {
      title: "Approve and activate a content-learning batch",
      description: "Administrator-only activation of a pending batch. Creates new guide versions atomically, retires prior active versions, and preserves history. It never edits a guide in place.",
      inputSchema: { batchId: z.string().uuid(), confirmed: z.literal(true) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ batchId }) => mcpToolResult(async () => contentStudio.approveFeedbackBatch(input.session, batchId))
  );

  server.registerTool(
    "list_content_guide_versions",
    {
      title: "List content guide version history",
      description: "Retrieve active and retired voice, visual, interviewer, or platform guide versions with parent links and change summaries.",
      inputSchema: {
        kind: z.enum(contentGuideKinds).optional(),
        platform: z.enum(contentPlatforms).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async (toolInput) => mcpToolResult(async () => contentStudio.listGuideVersions(input.session, toolInput))
  );

  server.registerTool(
    "rollback_content_guide",
    {
      title: "Roll back a content guide",
      description: "Administrator-only rollback to a selected historical version. The rollback creates a new active version so the complete audit trail remains retrievable.",
      inputSchema: {
        targetVersionId: z.string().uuid(),
        reason: z.string().trim().min(1).max(1000),
        confirmed: z.literal(true)
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { securitySchemes: meridianToolSecuritySchemes }
    },
    async ({ targetVersionId, reason }) => mcpToolResult(async () => contentStudio.rollbackGuide(input.session, { targetVersionId, reason }))
  );

  return server;
}

async function mcpToolResult(run: () => Promise<unknown>) {
  try {
    const value = await run();
    const structuredContent = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : { result: value };
    return { structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
  } catch (error) {
    const safe = error instanceof MeridianMcpError
      ? { code: error.code, error: error.message, status: error.status }
      : { code: "meridian_mcp_failed", error: "Meridian could not complete that tool call.", status: 500 };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(safe) }] };
  }
}
