const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3/calendars";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export const GOOGLE_DEMO_CALENDAR_NAME = "Emerge";
export const GOOGLE_DEMO_DRIVE_ROOT_NAME = "Lead Emergence automated Platform";
export const GOOGLE_DEMO_OAUTH_STATE_COOKIE = "lead_google_demo_oauth_state";
export const GOOGLE_DEMO_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const GOOGLE_DEMO_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly"
].join(" ");

type GoogleDemoEnv = Record<string, string | undefined>;

export type GoogleDemoConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  encryptionKey?: string;
  missing: string[];
};

export type GoogleDemoTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

export type GoogleDemoCalendar = {
  id: string;
  summary: string;
};

export type GoogleDemoCalendarEvent = {
  id: string;
  htmlLink?: string;
  summary: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  updated?: string;
};

export type GoogleDemoDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: number;
};

type DriveFileResource = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
};

export class GoogleDemoConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Google demo integration is not configured.");
    this.name = "GoogleDemoConfigError";
    this.missing = missing;
  }
}

export class GoogleDemoSyncTokenExpiredError extends Error {
  constructor() {
    super("Google Calendar sync token expired.");
    this.name = "GoogleDemoSyncTokenExpiredError";
  }
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGoogleDemoConfig(env: GoogleDemoEnv = process.env): GoogleDemoConfig {
  const clientId = cleanEnv(env.GOOGLE_DEMO_CLIENT_ID);
  const clientSecret = cleanEnv(env.GOOGLE_DEMO_CLIENT_SECRET);
  const redirectUri = cleanEnv(env.GOOGLE_DEMO_REDIRECT_URI);
  const encryptionKey = cleanEnv(env.GOOGLE_DEMO_ENCRYPTION_KEY);
  const required: Array<[string, string | undefined]> = [
    ["GOOGLE_DEMO_CLIENT_ID", clientId],
    ["GOOGLE_DEMO_CLIENT_SECRET", clientSecret],
    ["GOOGLE_DEMO_REDIRECT_URI", redirectUri],
    ["GOOGLE_DEMO_ENCRYPTION_KEY", encryptionKey]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  return { configured: missing.length === 0, clientId, clientSecret, redirectUri, encryptionKey, missing };
}

function requireConfig(env?: GoogleDemoEnv) {
  const config = readGoogleDemoConfig(env);
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri || !config.encryptionKey) {
    throw new GoogleDemoConfigError(config.missing);
  }
  return config as GoogleDemoConfig & { clientId: string; clientSecret: string; redirectUri: string; encryptionKey: string };
}

export function buildGoogleDemoAuthUrl(params: { state: string; env?: GoogleDemoEnv }) {
  const config = requireConfig(params.env);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DEMO_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeGoogleDemoCode(params: { code: string; env?: GoogleDemoEnv; fetchImpl?: typeof fetch }): Promise<GoogleDemoTokens> {
  const config = requireConfig(params.env);
  const response = await (params.fetchImpl ?? fetch)(TOKEN_URL, {
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
  if (!response.ok) throw new Error(`Google demo token exchange failed: ${response.status}`);
  const json = (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope ?? ""
  };
}

export async function refreshGoogleDemoAccessToken(params: {
  refreshToken: string;
  env?: GoogleDemoEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string; expiresAt: string }> {
  const config = requireConfig(params.env);
  const response = await (params.fetchImpl ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Google demo token refresh failed: ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString() };
}

async function googleJson<T>(params: {
  accessToken: string;
  url: string;
  init?: RequestInit;
  fetchImpl?: typeof fetch;
}): Promise<T> {
  const response = await (params.fetchImpl ?? fetch)(params.url, {
    ...params.init,
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.init?.headers ?? {})
    }
  });
  if (response.status === 410) throw new GoogleDemoSyncTokenExpiredError();
  if (!response.ok) throw new Error(`Google API request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function getGoogleDemoAccountEmail(params: { accessToken: string; fetchImpl?: typeof fetch }) {
  const json = await googleJson<{ email?: string }>({ accessToken: params.accessToken, url: USERINFO_URL, fetchImpl: params.fetchImpl });
  if (!json.email) throw new Error("Google account email was not returned.");
  return json.email;
}

export async function listGoogleDemoCalendars(params: { accessToken: string; fetchImpl?: typeof fetch }): Promise<GoogleDemoCalendar[]> {
  const calendars: GoogleDemoCalendar[] = [];
  let pageToken = "";
  do {
    const url = new URL(CALENDAR_LIST_URL);
    url.searchParams.set("fields", "items(id,summary),nextPageToken");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const json = await googleJson<{ items?: GoogleDemoCalendar[]; nextPageToken?: string }>({
      accessToken: params.accessToken,
      url: url.toString(),
      fetchImpl: params.fetchImpl
    });
    calendars.push(...(json.items ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return calendars;
}

export async function findGoogleDemoCalendar(params: { accessToken: string; fetchImpl?: typeof fetch }) {
  const calendars = await listGoogleDemoCalendars(params);
  return calendars.find((calendar) => calendar.summary.trim().toLowerCase() === GOOGLE_DEMO_CALENDAR_NAME.toLowerCase()) ?? null;
}

function eventTime(value: string) {
  return { dateTime: value };
}

function eventBody(input: {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  platformEventId: string;
}) {
  return {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: eventTime(input.startTime),
    end: eventTime(input.endTime),
    extendedProperties: { private: { leadEmergenceEventId: input.platformEventId } }
  };
}

function mapCalendarEvent(item: {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  updated?: string;
}): GoogleDemoCalendarEvent {
  return {
    id: item.id,
    htmlLink: item.htmlLink,
    summary: item.summary ?? "(untitled event)",
    description: item.description,
    location: item.location,
    start: item.start?.dateTime ?? item.start?.date,
    end: item.end?.dateTime ?? item.end?.date,
    updated: item.updated
  };
}

export async function createGoogleDemoCalendarEvent(params: {
  accessToken: string;
  calendarId: string;
  event: Parameters<typeof eventBody>[0];
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(`${CALENDAR_BASE_URL}/${encodeURIComponent(params.calendarId)}/events`);
  url.searchParams.set("fields", "id,htmlLink,summary,description,location,start,end,updated");
  const json = await googleJson<Parameters<typeof mapCalendarEvent>[0]>({
    accessToken: params.accessToken,
    url: url.toString(),
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(params.event))
    },
    fetchImpl: params.fetchImpl
  });
  return mapCalendarEvent(json);
}

export async function updateGoogleDemoCalendarEvent(params: {
  accessToken: string;
  calendarId: string;
  googleEventId: string;
  event: Parameters<typeof eventBody>[0];
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(`${CALENDAR_BASE_URL}/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.googleEventId)}`);
  url.searchParams.set("fields", "id,htmlLink,summary,description,location,start,end,updated");
  const json = await googleJson<Parameters<typeof mapCalendarEvent>[0]>({
    accessToken: params.accessToken,
    url: url.toString(),
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(params.event))
    },
    fetchImpl: params.fetchImpl
  });
  return mapCalendarEvent(json);
}

export async function listGoogleDemoCalendarEvents(params: {
  accessToken: string;
  calendarId: string;
  syncToken?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const events: GoogleDemoCalendarEvent[] = [];
  let pageToken = "";
  let nextSyncToken = "";
  do {
    const url = new URL(`${CALENDAR_BASE_URL}/${encodeURIComponent(params.calendarId)}/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("maxResults", "2500");
    url.searchParams.set("fields", "items(id,htmlLink,summary,description,location,start,end,updated),nextPageToken,nextSyncToken");
    if (params.syncToken) url.searchParams.set("syncToken", params.syncToken);
    if (!params.syncToken) url.searchParams.set("timeMin", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const json = await googleJson<{
      items?: Parameters<typeof mapCalendarEvent>[0][];
      nextPageToken?: string;
      nextSyncToken?: string;
    }>({ accessToken: params.accessToken, url: url.toString(), fetchImpl: params.fetchImpl });
    events.push(...(json.items ?? []).map(mapCalendarEvent));
    pageToken = json.nextPageToken ?? "";
    nextSyncToken = json.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken };
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function mapDriveFile(file: DriveFileResource): GoogleDemoDriveFile {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime,
    size: file.size ? Number(file.size) : undefined
  };
}

export async function findGoogleDemoDriveFolder(params: {
  accessToken: string;
  name: string;
  parentId?: string;
  fetchImpl?: typeof fetch;
}) {
  const parentClause = params.parentId ? ` and '${escapeDriveQuery(params.parentId)}' in parents` : "";
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set(
    "q",
    `trashed = false and mimeType = '${GOOGLE_DEMO_FOLDER_MIME_TYPE}' and name = '${escapeDriveQuery(params.name)}'${parentClause}`
  );
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime)");
  url.searchParams.set("pageSize", "1");
  const json = await googleJson<{ files?: DriveFileResource[] }>({
    accessToken: params.accessToken,
    url: url.toString(),
    fetchImpl: params.fetchImpl
  });
  const first = json.files?.[0];
  return first ? mapDriveFile(first) : null;
}

export async function createGoogleDemoDriveFolder(params: {
  accessToken: string;
  name: string;
  parentId?: string;
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("fields", "id,name,mimeType,webViewLink,modifiedTime");
  const json = await googleJson<DriveFileResource>({
    accessToken: params.accessToken,
    url: url.toString(),
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name,
        mimeType: GOOGLE_DEMO_FOLDER_MIME_TYPE,
        ...(params.parentId ? { parents: [params.parentId] } : {})
      })
    },
    fetchImpl: params.fetchImpl
  });
  return mapDriveFile(json);
}

export async function findOrCreateGoogleDemoDriveFolder(params: {
  accessToken: string;
  name: string;
  parentId?: string;
  fetchImpl?: typeof fetch;
}) {
  return (await findGoogleDemoDriveFolder(params)) ?? createGoogleDemoDriveFolder(params);
}

export async function listGoogleDemoDriveFilesInFolder(params: {
  accessToken: string;
  folderId: string;
  fetchImpl?: typeof fetch;
}) {
  const files: GoogleDemoDriveFile[] = [];
  let pageToken = "";
  do {
    const url = new URL(DRIVE_FILES_URL);
    url.searchParams.set("q", `trashed = false and '${escapeDriveQuery(params.folderId)}' in parents`);
    url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime,size),nextPageToken");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const json = await googleJson<{ files?: DriveFileResource[]; nextPageToken?: string }>({
      accessToken: params.accessToken,
      url: url.toString(),
      fetchImpl: params.fetchImpl
    });
    files.push(...(json.files ?? []).map(mapDriveFile));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return files;
}

export async function uploadGoogleDemoDriveFile(params: {
  accessToken: string;
  folderId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
  fetchImpl?: typeof fetch;
}) {
  const boundary = `lead-emergence-${crypto.randomUUID()}`;
  const metadata = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
      name: params.name,
      parents: [params.folderId]
    })}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    "utf8"
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const url = new URL(DRIVE_UPLOAD_URL);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,mimeType,webViewLink,modifiedTime,size");
  const json = await googleJson<DriveFileResource>({
    accessToken: params.accessToken,
    url: url.toString(),
    init: {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([metadata, params.bytes, closing]) as unknown as BodyInit
    },
    fetchImpl: params.fetchImpl
  });
  return mapDriveFile(json);
}
