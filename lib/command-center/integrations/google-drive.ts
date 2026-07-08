// Google Drive integration for the Personal Command Center: search, read
// file content, and organize (move files, create folders) — everything an
// assistant could do short of editing or deleting a file. Mirrors
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
// Scope is drive.readonly (read metadata + content) plus drive.metadata
// (read/write metadata only, no content) — not the broader `drive` scope,
// which would also allow directly overwriting a file's content. Organizing
// (moving files, creating/renaming folders) only ever touches metadata
// (a file's name and parents), never its content, so drive.metadata is
// sufficient and there is no content-write function anywhere in this
// module.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

export const GOOGLE_DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const GOOGLE_DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata";
export const GOOGLE_DRIVE_SCOPES = `${GOOGLE_DRIVE_READONLY_SCOPE} ${GOOGLE_DRIVE_METADATA_SCOPE}`;
export const GOOGLE_DRIVE_OAUTH_STATE_COOKIE = "cc_gdrive_oauth_state";
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

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
  parents?: string[];
};

export type GoogleDriveFolder = {
  id: string;
  name: string;
};

export type GoogleDriveFileContent = {
  content: string;
  truncated: boolean;
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
  url.searchParams.set("scope", GOOGLE_DRIVE_SCOPES);
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

type DriveFileResource = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
};

type DriveFilesListResponse = { files?: DriveFileResource[] };

const DRIVE_FILE_FIELDS = "id,name,mimeType,webViewLink,modifiedTime,parents";

function mapDriveFile(file: DriveFileResource): GoogleDriveFileSummary {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime,
    parents: file.parents
  };
}

// Metadata search: matches by filename, excludes trashed files. Returns
// metadata only (including parents, needed to move a file later) — never
// file content; use getGoogleDriveFileContent for that.
export async function searchGoogleDriveFiles(params: {
  accessToken: string;
  query: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFileSummary[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("q", `trashed = false and name contains '${escapeDriveQueryTerm(params.query)}'`);
  url.searchParams.set("fields", `files(${DRIVE_FILE_FIELDS})`);
  url.searchParams.set("pageSize", String(params.maxResults ?? 10));

  const response = await doFetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Google Drive search failed: ${response.status}`);
  const json = (await response.json()) as DriveFilesListResponse;
  return (json.files ?? []).map(mapDriveFile);
}

// Read-only metadata for one file, including parents — used before reading
// content (to know how to read it) and before moving a file (to know what
// parent to remove).
export async function getGoogleDriveFile(params: {
  accessToken: string;
  fileId: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFileSummary> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(`${DRIVE_FILES_URL}/${params.fileId}`);
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);
  const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!response.ok) throw new Error(`Google Drive file read failed: ${response.status}`);
  return mapDriveFile((await response.json()) as DriveFileResource);
}

// --- Read file content -----------------------------------------------

const GOOGLE_DOC_EXPORT_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain"
};

const DIRECTLY_READABLE_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
]);

const MAX_DRIVE_CONTENT_LENGTH = 4000;

function truncateContent(content: string): GoogleDriveFileContent {
  const truncated = content.length > MAX_DRIVE_CONTENT_LENGTH;
  return { content: truncated ? content.slice(0, MAX_DRIVE_CONTENT_LENGTH) : content, truncated };
}

// Read-only. Google Docs/Sheets/Slides are exported as plain text/CSV;
// plain-text-ish files (text/plain, text/markdown, text/csv, JSON) are
// downloaded directly. Other types (PDF, images, Office formats, etc.)
// throw a descriptive error instead of attempting binary parsing — this
// integration only ever reads what converts cleanly to text.
export async function getGoogleDriveFileContent(params: {
  accessToken: string;
  fileId: string;
  mimeType: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFileContent> {
  const doFetch = params.fetchImpl ?? fetch;

  if (params.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new Error("Cannot read the content of a folder.");
  }

  const exportMimeType = GOOGLE_DOC_EXPORT_MIME_TYPES[params.mimeType];
  if (exportMimeType) {
    const url = new URL(`${DRIVE_FILES_URL}/${params.fileId}/export`);
    url.searchParams.set("mimeType", exportMimeType);
    const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${params.accessToken}` } });
    if (!response.ok) throw new Error(`Google Drive file export failed: ${response.status}`);
    return truncateContent(await response.text());
  }

  if (DIRECTLY_READABLE_MIME_TYPES.has(params.mimeType)) {
    const url = new URL(`${DRIVE_FILES_URL}/${params.fileId}`);
    url.searchParams.set("alt", "media");
    const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${params.accessToken}` } });
    if (!response.ok) throw new Error(`Google Drive file download failed: ${response.status}`);
    return truncateContent(await response.text());
  }

  throw new Error(`Reading "${params.mimeType}" content is not supported yet.`);
}

// --- Organize (move files, create/find folders) -----------------------

function toGoogleDriveFolder(file: DriveFileResource): GoogleDriveFolder {
  return { id: file.id, name: file.name };
}

export async function listGoogleDriveFolders(params: { accessToken: string; fetchImpl?: typeof fetch }): Promise<GoogleDriveFolder[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("q", `trashed = false and mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "50");

  const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!response.ok) throw new Error(`Google Drive folder list failed: ${response.status}`);
  const json = (await response.json()) as DriveFilesListResponse;
  return (json.files ?? []).map(toGoogleDriveFolder);
}

export async function createGoogleDriveFolder(params: {
  accessToken: string;
  name: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFolder> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${DRIVE_FILES_URL}?fields=id,name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: params.name, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE })
  });
  if (!response.ok) throw new Error(`Google Drive folder creation failed: ${response.status}`);
  return toGoogleDriveFolder((await response.json()) as DriveFileResource);
}

// Idempotent: returns an existing same-named (case-insensitive) folder
// instead of creating a duplicate.
export async function findOrCreateGoogleDriveFolder(params: {
  accessToken: string;
  name: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFolder> {
  const folders = await listGoogleDriveFolders(params);
  const existing = folders.find((folder) => folder.name.toLowerCase() === params.name.toLowerCase());
  if (existing) return existing;
  return createGoogleDriveFolder(params);
}

// "Move to folder": finds or creates the target folder, then updates the
// file's parents to replace whatever folder(s) it's currently in. This
// only ever touches metadata (parents) — never the file's content.
export async function moveGoogleDriveFile(params: {
  accessToken: string;
  fileId: string;
  currentParents: string[];
  folderName: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveFolder> {
  const folder = await findOrCreateGoogleDriveFolder({ accessToken: params.accessToken, name: params.folderName, fetchImpl: params.fetchImpl });
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(`${DRIVE_FILES_URL}/${params.fileId}`);
  url.searchParams.set("addParents", folder.id);
  if (params.currentParents.length > 0) url.searchParams.set("removeParents", params.currentParents.join(","));
  url.searchParams.set("fields", "id,parents");

  const response = await doFetch(url.toString(), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Google Drive file move failed: ${response.status}`);
  return folder;
}
