import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthSession } from "@/lib/auth/server";
import { MeridianMcpService } from "@/lib/meridian/mcp/service";
import { MeridianMcpError, meridianResourceTypes, type MeridianMcpRepository } from "@/lib/meridian/mcp/types";

export function createMeridianMcpServer(input: {
  session: AuthSession;
  repository: MeridianMcpRepository;
  clientName: string;
}) {
  const service = new MeridianMcpService(input.repository);
  const server = new McpServer(
    { name: "lead-emergence-meridian", version: "0.1.0" },
    {
      instructions:
        "Use only approved Meridian search/fetch results for Lead Emergence theology and culture. Never claim a draft is approved, never publish or communicate externally, and submit drafts for human review."
    }
  );

  server.registerTool(
    "search",
    {
      title: "Search approved Meridian knowledge",
      description: "Use this when the user needs approved Lead Emergence theology, curriculum, teaching history, policy, or ministry context for developing a resource.",
      inputSchema: { query: z.string().trim().min(1).max(500) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ query }) => mcpToolResult(async () => JSON.stringify(await service.search(input.session, query)))
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch an approved Meridian item",
      description: "Use this after search when the user needs the approved claim, attribution, source names, and permitted quotation material for one Meridian result.",
      inputSchema: { id: z.string().trim().min(1).max(100) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ id }) => mcpToolResult(async () => JSON.stringify(await service.fetch(input.session, id)))
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
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (draft) => mcpToolResult(async () => JSON.stringify(await service.submitDraft(input.session, draft, input.clientName)))
  );

  return server;
}

async function mcpToolResult(run: () => Promise<string>) {
  try {
    return { content: [{ type: "text" as const, text: await run() }] };
  } catch (error) {
    const safe = error instanceof MeridianMcpError
      ? { code: error.code, error: error.message, status: error.status }
      : { code: "meridian_mcp_failed", error: "Meridian could not complete that tool call.", status: 500 };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(safe) }] };
  }
}
