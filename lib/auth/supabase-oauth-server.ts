type OAuthClientDetails = {
  id: string;
  name: string;
  uri: string;
};

export type OAuthAuthorizationDetails =
  | { redirect_url: string }
  | {
      authorization_id: string;
      client: OAuthClientDetails;
      user: { email: string };
      scope: string;
      redirect_uri: string;
    };

export type OAuthConsentResult = { redirect_url: string };

type SupabaseOAuthResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Calls Supabase's OAuth server with the authenticated account bearer token.
 *
 * The browser-oriented auth-js OAuth helpers load a session from client-side
 * storage before making this request. Server routes intentionally have no such
 * storage, so they must forward the already-validated bearer token directly.
 */
export function getOAuthAuthorizationDetails(
  accessToken: string,
  authorizationId: string
): Promise<SupabaseOAuthResult<OAuthAuthorizationDetails>> {
  return requestSupabaseOAuth<OAuthAuthorizationDetails>(
    accessToken,
    `/oauth/authorizations/${encodeURIComponent(authorizationId)}`,
    { method: "GET" }
  );
}

export function decideOAuthAuthorization(
  accessToken: string,
  authorizationId: string,
  decision: "approve" | "deny"
): Promise<SupabaseOAuthResult<OAuthConsentResult>> {
  return requestSupabaseOAuth<OAuthConsentResult>(
    accessToken,
    `/oauth/authorizations/${encodeURIComponent(authorizationId)}/consent`,
    {
      method: "POST",
      body: JSON.stringify({ action: decision })
    }
  );
}

async function requestSupabaseOAuth<T>(
  accessToken: string,
  path: string,
  init: Pick<RequestInit, "method" | "body">
): Promise<SupabaseOAuthResult<T>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    return { data: null, error: new Error("Supabase OAuth is not configured.") };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {})
      }
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !payload) {
      return { data: null, error: new Error(readOAuthError(payload) ?? `Supabase OAuth request failed (${response.status}).`) };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Supabase OAuth request failed.") };
  }
}

function readOAuthError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const errorPayload = payload as { message?: unknown; error?: unknown };
  if (typeof errorPayload.message === "string" && errorPayload.message.trim()) return errorPayload.message.trim();
  if (typeof errorPayload.error === "string" && errorPayload.error.trim()) return errorPayload.error.trim();
  return null;
}
