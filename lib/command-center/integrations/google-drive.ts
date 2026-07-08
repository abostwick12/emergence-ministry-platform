// Read-only Google Drive search for the Personal Command Center. Mirrors
// lib/command-center/integrations/google-calendar.ts and gmail.ts: config is
// read from env only, and every function throws GoogleDriveConfigError
// instead of attempting a network call when GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI is missing.
//
// Shares the same Google OAuth client as Calendar and Gmail (one consent
// screen), but Andrew grants and stores a separate token under
// service = 'google_drive' — connecting Drive does not connect Calendar or
// Gmail, and vice versa.
//
// Scope is drive.metadata.readonly, not drive.readonly: this integration
// only ever needs to find and name relevant documents, never to download or
// read file content. That keeps the OAuth grant itself minimal, on top of
// the app-level read-only guarantee.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

export const GOOGLE_DRIVE_METADATA_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
export const GOOGLE_DRIVE_OAUTH_STATE_COOKIE = "cc_gdrive_oauth_state";

type GoogleDriveEnv = Record<string, string | undefined>;

export type GoogleDriveConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  missing: string[];
};

export type GoogleDriveTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

export type GoogleDriveFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGoogleDriveConfig(env: GoogleDriveEnv = process.env): GoogleDriveConfig {
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

export class GoogleDriveConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Google Drive integration is not configured.");
    this.name = "GoogleDriveConfigError";
    this.missing = missing;
  }
}

function requireConfig(env?: GoogleDriveEnv): Required<Pick<GoogleDriveConfig, "clientId" | "clientSecret" | "redirectUri">> {
  const config = readGoogleDriveConfig(env);
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new GoogleDriveConfigError(config.missing);
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri };
}

export function buildGoogleDriveAuthUrl(params: { state: string; env?: GoogleDriveEnv }): string {
  const config = requireConfig(params.env);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_METADATA_READONLY_SCOPE);
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

export async function exchangeGoogleDriveCode(params: {
  code: string;
  env?: GoogleDriveEnv;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveTokens> {
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
  if (!response.ok) throw new Error(`Google Drive token exchange failed: ${response.status}`);
  const json = (await response.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope
  };
}

export async function refreshGoogleDriveAccessToken(params: {
  refreshToken: string;
  env?: GoogleDriveEnv;
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
  if (!response.ok) throw new Error(`Google Drive token refresh failed: ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString() };
}

export function isGoogleDriveTokenExpired(expiresAt: string, skewMs = 60_000): boolean {
  return new Date(expiresAt).getTime() - skewMs <= Date.now();
}

// Reads the { accessToken, refreshToken, expiresAt, scope } shape persisted
// into personal_integrations.config by the callback route. Returns null for
// any malformed/partial config so callers can treat the integration as
// disconnected rather than throwing on stored data they don't control.
export function parseStoredGoogleDriveTokens(config: Record<string, unknown>): GoogleDriveTokens | null {
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

function escapeDriveQueryTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type DriveFilesListResponse = {
  files?: Array<{ id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }>;
};

// Read-only, metadata-only search: matches by filename, excludes trashed
// files, and requests only id/name/mimeType/webViewLink/modifiedTime —
// never file content.
export async function searchGoogleDriveFiles(params: {
  accessToken: string;
  query: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFileSummary[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("q", `trashed = false and name contains '${escapeDriveQueryTerm(params.query)}'`);
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime)");
  url.searchParams.set("pageSize", String(params.maxResults ?? 10));

  const response = await doFetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Google Drive search failed: ${response.status}`);
  const json = (await response.json()) as DriveFilesListResponse;
  return (json.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime
  }));
}
