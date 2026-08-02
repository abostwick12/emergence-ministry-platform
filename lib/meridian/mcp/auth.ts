import type { AuthSession } from "@/lib/auth/server";
import { getAccountSessionFromAccessToken } from "@/lib/auth/server";
import { getMeridianBearerChallenge, getMeridianMcpResourceUrl, meridianOAuthScopes } from "@/lib/meridian/mcp/oauth";

export type AuthenticatedMeridianMcpRequest = {
  session: AuthSession;
  token: string;
  clientId?: string;
  scopes: string[];
};

export async function authenticateMeridianMcpRequest(request: Request): Promise<AuthenticatedMeridianMcpRequest | null> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  const token = match[1];
  const session = await getAccountSessionFromAccessToken(token);
  if (!session || session.isGuest || session.isMock || !session.accessToken) return null;
  const claims = readValidatedTokenContext(token, request);
  if (!claims) return null;
  return { session, token, clientId: claims.clientId, scopes: claims.scopes };
}

function readValidatedTokenContext(token: string, request: Request) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const resources = typeof payload.resource === "string"
      ? [payload.resource]
      : Array.isArray(payload.resource) ? payload.resource.filter((value): value is string => typeof value === "string") : [];
    if (resources.length && !resources.includes(getMeridianMcpResourceUrl(request))) return null;

    const requestedScopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];
    const scopes = requestedScopes.filter((scope) => meridianOAuthScopes.includes(scope as (typeof meridianOAuthScopes)[number]));
    return {
      clientId: typeof payload.client_id === "string" && payload.client_id.trim() ? payload.client_id.trim() : undefined,
      scopes: scopes.length ? scopes : [...meridianOAuthScopes]
    };
  } catch {
    return null;
  }
}

export function meridianMcpUnauthorizedResponse(request?: Request) {
  return new Response(JSON.stringify({ error: "Authentication required", code: "mcp_authentication_required" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": getMeridianBearerChallenge(request)
    }
  });
}
