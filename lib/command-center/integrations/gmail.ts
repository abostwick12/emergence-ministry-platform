// Gmail integration for the Personal Command Center: read-only triage plus
// draft-only replies. Mirrors lib/command-center/integrations/google-calendar.ts
// and lib/command-center/sage.ts's provider-config pattern: config is read
// from env only, and every function throws GmailConfigError instead of
// attempting a network call when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or
// GOOGLE_REDIRECT_URI is missing.
//
// Gmail, Calendar, and Drive share one Google OAuth client (one consent
// screen), but Andrew grants and stores a separate token per integration —
// connecting Gmail does not connect Calendar or vice versa.
//
// Scope note: Gmail has no OAuth scope that allows creating drafts without
// also technically permitting drafts.send. "SAGE never sends email" is
// enforced at the application layer, not the OAuth layer — this module
// intentionally implements no send/drafts.send call anywhere. Only
// messages.list/messages.get (read) and drafts.create (draft-only) exist
// below.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_SCOPES = `${GMAIL_READONLY_SCOPE} ${GMAIL_COMPOSE_SCOPE}`;
export const GMAIL_OAUTH_STATE_COOKIE = "cc_gmail_oauth_state";

type GmailEnv = Record<string, string | undefined>;

export type GmailConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  missing: string[];
};

export type GmailTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGmailConfig(env: GmailEnv = process.env): GmailConfig {
  const clientId = cleanEnv(env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(env.GOOGLE_CLIENT_SECRET);
  const redirectUri = cleanEnv(env.GOOGLE_REDIRECT_URI);
  const required: Array<[string, string | undefined]> = [
    ["GOOGLE_CLIENT_ID", clientId],
    ["GOOGLE_CLIENT_SECRET", clientSecret],
    ["GOOGLE_REDIRECT_URI", redirectUri]
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  return { configured: missing.length === 0, clientId, clientSecret, redirectUri, missing };
}

export class GmailConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Gmail integration is not configured.");
    this.name = "GmailConfigError";
    this.missing = missing;
  }
}

function requireConfig(env?: GmailEnv): Required<Pick<GmailConfig, "clientId" | "clientSecret" | "redirectUri">> {
  const config = readGmailConfig(env);
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new GmailConfigError(config.missing);
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri };
}

export function buildGmailAuthUrl(params: { state: string; env?: GmailEnv }): string {
  const config = requireConfig(params.env);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
};

export async function exchangeGmailCode(params: { code: string; env?: GmailEnv; fetchImpl?: typeof fetch }): Promise<GmailTokens> {
  const config = requireConfig(params.env);
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new Error(`Gmail token exchange failed: ${response.status}`);
  const json = (await response.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope
  };
}

export async function refreshGmailAccessToken(params: {
  refreshToken: string;
  env?: GmailEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string; expiresAt: string }> {
  const config = requireConfig(params.env);
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Gmail token refresh failed: ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString() };
}

export function isGmailTokenExpired(expiresAt: string, skewMs = 60_000): boolean {
  return new Date(expiresAt).getTime() - skewMs <= Date.now();
}

// Reads the { accessToken, refreshToken, expiresAt, scope } shape persisted
// into personal_integrations.config by the callback route. Returns null for
// any malformed/partial config so callers can treat the integration as
// disconnected rather than throwing on stored data they don't control.
export function parseStoredGmailTokens(config: Record<string, unknown>): GmailTokens | null {
  const accessToken = config.accessToken;
  const expiresAt = config.expiresAt;
  if (typeof accessToken !== "string" || typeof expiresAt !== "string") return null;
  return {
    accessToken,
    refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
    expiresAt,
    scope: typeof config.scope === "string" ? config.scope : ""
  };
}

function headerValue(headers: Array<{ name?: string; value?: string }>, name: string): string {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type GmailMessageListResponse = { messages?: Array<{ id: string; threadId: string }> };

type GmailMessageMetadataResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: { headers?: Array<{ name?: string; value?: string }> };
};

// Read-only triage list: fetches only Subject/From/Date headers and the
// short snippet Gmail already generates, never the full message body.
export async function listRecentGmailMessages(params: {
  accessToken: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}): Promise<GmailMessageSummary[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const listUrl = new URL(`${GMAIL_API_BASE}/messages`);
  listUrl.searchParams.set("maxResults", String(params.maxResults ?? 10));
  listUrl.searchParams.set("q", "in:inbox");

  const listResponse = await doFetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!listResponse.ok) throw new Error(`Gmail message list fetch failed: ${listResponse.status}`);
  const listJson = (await listResponse.json()) as GmailMessageListResponse;
  const refs = listJson.messages ?? [];

  const summaries = await Promise.all(
    refs.map(async (ref) => {
      const metaUrl = new URL(`${GMAIL_API_BASE}/messages/${ref.id}`);
      metaUrl.searchParams.set("format", "metadata");
      metaUrl.searchParams.append("metadataHeaders", "Subject");
      metaUrl.searchParams.append("metadataHeaders", "From");
      metaUrl.searchParams.append("metadataHeaders", "Date");

      const metaResponse = await doFetch(metaUrl.toString(), {
        headers: { Authorization: `Bearer ${params.accessToken}` }
      });
      if (!metaResponse.ok) throw new Error(`Gmail message read failed: ${metaResponse.status}`);
      const meta = (await metaResponse.json()) as GmailMessageMetadataResponse;
      const headers = meta.payload?.headers ?? [];
      return {
        id: meta.id,
        threadId: meta.threadId,
        subject: headerValue(headers, "Subject") || "(no subject)",
        from: headerValue(headers, "From"),
        date: headerValue(headers, "Date"),
        snippet: meta.snippet ?? ""
      };
    })
  );

  return summaries;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMimeDraft(params: { to: string; subject: string; body: string; inReplyTo?: string; threadId?: string }): string {
  const headers = [`To: ${params.to}`, `Subject: ${params.subject}`, 'Content-Type: text/plain; charset="UTF-8"', "MIME-Version: 1.0"];
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }
  return `${headers.join("\r\n")}\r\n\r\n${params.body}`;
}

export type GmailDraftResult = { draftId: string; messageId: string };

// Draft-only. There is no send() call anywhere in this module — creating a
// draft here never transmits an email. Andrew reviews and sends it himself
// from Gmail.
export async function createGmailDraft(params: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailDraftResult> {
  const doFetch = params.fetchImpl ?? fetch;
  const raw = base64UrlEncode(buildMimeDraft(params));
  const response = await doFetch(`${GMAIL_API_BASE}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        raw,
        ...(params.threadId ? { threadId: params.threadId } : {})
      }
    })
  });
  if (!response.ok) throw new Error(`Gmail draft creation failed: ${response.status}`);
  const json = (await response.json()) as { id: string; message: { id: string } };
  return { draftId: json.id, messageId: json.message.id };
}
