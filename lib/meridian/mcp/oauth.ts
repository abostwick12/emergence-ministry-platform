export const meridianOAuthScopes = ["openid", "email", "profile"] as const;

const productionOrigin = "https://www.leademergence.com";

export function getMeridianPublicOrigin(request?: Request) {
  const configured = firstValue(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  if (configured) return normalizeOrigin(configured);

  if (request) {
    const origin = new URL(request.url).origin;
    if (isLocalOrigin(origin)) return origin;
  }

  return productionOrigin;
}

export function getMeridianMcpResourceUrl(request?: Request) {
  return `${getMeridianPublicOrigin(request)}/mcp`;
}

export function getMeridianProtectedResourceMetadataUrl(request?: Request) {
  return `${getMeridianPublicOrigin(request)}/.well-known/oauth-protected-resource`;
}

export function getMeridianAuthorizationServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
}

export function getMeridianProtectedResourceMetadata(request?: Request) {
  const authorizationServer = getMeridianAuthorizationServer();
  return {
    resource: getMeridianMcpResourceUrl(request),
    ...(authorizationServer ? { authorization_servers: [authorizationServer] } : {}),
    scopes_supported: [...meridianOAuthScopes],
    bearer_methods_supported: ["header"],
    resource_name: "Lead Emergence Meridian",
    resource_documentation: `${getMeridianPublicOrigin(request)}/settings#meridian-personal-ai`
  };
}

export function getMeridianBearerChallenge(request?: Request) {
  const metadataUrl = getMeridianProtectedResourceMetadataUrl(request);
  return `Bearer realm="Lead Emergence Meridian", resource_metadata="${metadataUrl}", scope="${meridianOAuthScopes.join(" ")}"`;
}

export const meridianToolSecuritySchemes = [
  { type: "oauth2", scopes: [...meridianOAuthScopes] }
] as const;

function firstValue(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  return url.origin;
}

function isLocalOrigin(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
