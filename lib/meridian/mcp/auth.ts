import type { AuthSession } from "@/lib/auth/server";
import { getAccountSessionFromAccessToken } from "@/lib/auth/server";

export type AuthenticatedMeridianMcpRequest = {
  session: AuthSession;
  token: string;
};

export async function authenticateMeridianMcpRequest(request: Request): Promise<AuthenticatedMeridianMcpRequest | null> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  const token = match[1];
  const session = await getAccountSessionFromAccessToken(token);
  if (!session || session.isGuest || session.isMock || !session.accessToken) return null;
  return { session, token };
}

export function meridianMcpUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Authentication required", code: "mcp_authentication_required" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Bearer realm="Lead Emergence Meridian", scope="meridian:mcp"'
    }
  });
}
