import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateMeridianMcpRequest, meridianMcpUnauthorizedResponse } from "@/lib/meridian/mcp/auth";
import { SupabaseContentStudioRepository } from "@/lib/meridian/content-studio/repository";
import { SupabaseMeridianMcpRepository } from "@/lib/meridian/mcp/repository";
import { SupabasePlatformMcpRepository } from "@/lib/meridian/mcp/platform-repository";
import { createMeridianMcpServer } from "@/lib/meridian/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleMeridianMcp(request: Request) {
  const authenticated = await authenticateMeridianMcpRequest(request);
  if (!authenticated) return meridianMcpUnauthorizedResponse(request);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  const clientName = request.headers.get("user-agent")?.trim() || "mcp-client";
  const server = createMeridianMcpServer({
    session: authenticated.session,
    repository: new SupabaseMeridianMcpRepository(),
    contentRepository: new SupabaseContentStudioRepository(),
    platformRepository: new SupabasePlatformMcpRepository(),
    clientName
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request, {
    authInfo: {
      token: authenticated.token,
      clientId: authenticated.clientId ?? clientName.slice(0, 120),
      scopes: authenticated.scopes,
      extra: {
        userId: authenticated.session.user.id,
        role: authenticated.session.user.role
      }
    }
  });
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = handleMeridianMcp;
export const POST = handleMeridianMcp;
export const DELETE = handleMeridianMcp;
