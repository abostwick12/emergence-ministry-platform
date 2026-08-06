import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthSession } from "@/lib/auth/server";
import { meridianToolSecuritySchemes } from "@/lib/meridian/mcp/oauth";
import { PlatformMcpService } from "@/lib/meridian/mcp/platform-service";
import { platformEventTypes, platformResourceKinds, platformTaskStatuses, type PlatformMcpRepository } from "@/lib/meridian/mcp/platform-types";
import { MeridianMcpService } from "@/lib/meridian/mcp/service";
import { MeridianMcpError, meridianMcpCandidateObjectTypes, meridianResourceTypes, type MeridianMcpRepository } from "@/lib/meridian/mcp/types";

export function createMeridianMcpServer(input: {
  session: AuthSession;
  repository: MeridianMcpRepository;
  platformRepository: PlatformMcpRepository;
  clientName: string;
}) {
  const service = new MeridianMcpService(input.repository);
  const platform = new PlatformMcpService(input.repository, input.platformRepository);
  const server = new McpServer(
    { name: "lead-emergence-meridian", version: "0.4.0" },
    {
      instructions:
        "Lead Emergence tools act as the signed-in user and require explicit grants. Use approved Meridian evidence for theology and culture. Read before changing records, confirm every write, and reuse idempotency keys. Private Obsidian discovery stays in the user's local connector; when it influences a bundle, pass its transient check payload so the server can block leakage and retain hashes only. Submit the exact saved bundle to EMMA with approved claim IDs before describing it as reviewed. EMMA outcomes still require a person and never approve, publish, send, or synchronize. No delete, publish, send, vault-browsing, pastoral, Camp, medical, or mental-health tools are available."
    }
  );

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
    async (toolInput) => mcpToolResult(async () => platform.listEvents(input.session, toolInput))
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
    async ({ eventId }) => mcpToolResult(async () => platform.getEvent(input.session, eventId))
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
    async (toolInput) => mcpToolResult(async () => platform.listTasks(input.session, toolInput))
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
    async () => mcpToolResult(async () => platform.listTeamMembers(input.session))
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
    async (toolInput) => mcpToolResult(async () => platform.listResources(input.session, toolInput))
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
    async (toolInput) => mcpToolResult(async () => platform.createEvent(input.session, { ...toolInput, clientName: input.clientName }))
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
    async ({ eventId, ...toolInput }) => mcpToolResult(async () => platform.updateEvent(input.session, eventId, { ...toolInput, clientName: input.clientName }))
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
    async (toolInput) => mcpToolResult(async () => platform.createTask(input.session, { ...toolInput, clientName: input.clientName }))
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
    async ({ taskId, ...toolInput }) => mcpToolResult(async () => platform.updateTask(input.session, taskId, { ...toolInput, clientName: input.clientName }))
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
    async (toolInput) => mcpToolResult(async () => platform.createResourceBundle(input.session, { ...toolInput, clientName: input.clientName }))
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
    async (toolInput) => mcpToolResult(async () => platform.submitBundleForEmmaReview(input.session, { ...toolInput, clientName: input.clientName }))
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
