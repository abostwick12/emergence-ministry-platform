const AUTH_URL = "https://api.planningcenteronline.com/oauth/authorize";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";
const DEFAULT_API_BASE_URL = "https://api.planningcenteronline.com";

export const PLANNING_CENTER_OAUTH_STATE_COOKIE = "lead_pco_oauth_state";

type PlanningCenterEnv = Record<string, string | undefined>;

export type PlanningCenterConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  apiBaseUrl: string;
  missing: string[];
};

export type PlanningCenterTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
};

export type PlanningCenterPersonRef = {
  externalPersonId: string;
  displayName: string;
  householdExternalId?: string;
  grade?: string;
  ageBand?: string;
  sourceUpdatedAt?: string;
};

export type PlanningCenterAttendanceRef = {
  externalCheckInId: string;
  externalPersonId?: string;
  externalEventId?: string;
  sessionLabel?: string;
  locationLabel?: string;
  checkedInAt?: string;
};

type PlanningCenterResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id?: string; type?: string } | Array<{ id?: string; type?: string }> | null }>;
};

type PlanningCenterCollectionResponse = {
  data?: PlanningCenterResource[];
  links?: {
    next?: string | null;
  };
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readPlanningCenterConfig(env: PlanningCenterEnv = process.env): PlanningCenterConfig {
  const clientId = cleanEnv(env.PLANNING_CENTER_CLIENT_ID);
  const clientSecret = cleanEnv(env.PLANNING_CENTER_CLIENT_SECRET);
  const redirectUri = cleanEnv(env.PLANNING_CENTER_REDIRECT_URI);
  const apiBaseUrl = cleanEnv(env.PLANNING_CENTER_API_BASE_URL) ?? DEFAULT_API_BASE_URL;
  const required: Array<[string, string | undefined]> = [
    ["PLANNING_CENTER_CLIENT_ID", clientId],
    ["PLANNING_CENTER_CLIENT_SECRET", clientSecret],
    ["PLANNING_CENTER_REDIRECT_URI", redirectUri]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  return { configured: missing.length === 0, clientId, clientSecret, redirectUri, apiBaseUrl, missing };
}

export class PlanningCenterConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Planning Center integration is not configured.");
    this.name = "PlanningCenterConfigError";
    this.missing = missing;
  }
}

function requireConfig(env?: PlanningCenterEnv): Required<Pick<PlanningCenterConfig, "clientId" | "clientSecret" | "redirectUri" | "apiBaseUrl">> {
  const config = readPlanningCenterConfig(env);
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new PlanningCenterConfigError(config.missing);
  }
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    apiBaseUrl: config.apiBaseUrl
  };
}

export function buildPlanningCenterAuthUrl(params: { state: string; env?: PlanningCenterEnv }): string {
  const config = requireConfig(params.env);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

function mapTokenResponse(json: TokenResponse): PlanningCenterTokens {
  if (!json.access_token || typeof json.expires_in !== "number") {
    throw new Error("Planning Center token response was incomplete.");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope
  };
}

export async function exchangePlanningCenterCode(params: {
  code: string;
  env?: PlanningCenterEnv;
  fetchImpl?: typeof fetch;
}): Promise<PlanningCenterTokens> {
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
  if (!response.ok) throw new Error(`Planning Center token exchange failed: ${response.status}`);
  return mapTokenResponse((await response.json()) as TokenResponse);
}

export async function refreshPlanningCenterAccessToken(params: {
  refreshToken: string;
  env?: PlanningCenterEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string; expiresAt: string; refreshToken?: string; scope?: string }> {
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
  if (!response.ok) throw new Error(`Planning Center token refresh failed: ${response.status}`);
  return mapTokenResponse((await response.json()) as TokenResponse);
}

export function isPlanningCenterTokenExpired(expiresAt: string, skewMs = 60_000): boolean {
  return new Date(expiresAt).getTime() - skewMs <= Date.now();
}

async function fetchCollection(params: {
  accessToken: string;
  path: string;
  maxPages?: number;
  env?: PlanningCenterEnv;
  fetchImpl?: typeof fetch;
}): Promise<PlanningCenterResource[]> {
  const config = requireConfig(params.env);
  const doFetch = params.fetchImpl ?? fetch;
  const resources: PlanningCenterResource[] = [];
  let nextUrl: string | undefined = `${config.apiBaseUrl}${params.path}`;
  let pages = 0;

  while (nextUrl && pages < (params.maxPages ?? 3)) {
    const response = await doFetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error(`Planning Center API request failed: ${response.status}`);
    const json = (await response.json()) as PlanningCenterCollectionResponse;
    resources.push(...(json.data ?? []));
    nextUrl = typeof json.links?.next === "string" && json.links.next.trim() ? json.links.next : undefined;
    pages += 1;
  }

  return resources;
}

export async function listPlanningCenterPeople(params: {
  accessToken: string;
  maxPages?: number;
  env?: PlanningCenterEnv;
  fetchImpl?: typeof fetch;
}): Promise<PlanningCenterPersonRef[]> {
  const records = await fetchCollection({
    accessToken: params.accessToken,
    path: "/people/v2/people?per_page=100",
    maxPages: params.maxPages,
    env: params.env,
    fetchImpl: params.fetchImpl
  });
  return records.map(normalizePerson).filter((person): person is PlanningCenterPersonRef => Boolean(person));
}

export async function listPlanningCenterAttendance(params: {
  accessToken: string;
  maxPages?: number;
  env?: PlanningCenterEnv;
  fetchImpl?: typeof fetch;
}): Promise<PlanningCenterAttendanceRef[]> {
  const records = await fetchCollection({
    accessToken: params.accessToken,
    path: "/check-ins/v2/check_ins?per_page=100",
    maxPages: params.maxPages,
    env: params.env,
    fetchImpl: params.fetchImpl
  });
  return records.map(normalizeAttendance).filter((attendance): attendance is PlanningCenterAttendanceRef => Boolean(attendance));
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function relationshipId(record: PlanningCenterResource, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const data = record.relationships?.[key]?.data;
    if (Array.isArray(data)) {
      const first = data.find((item) => typeof item.id === "string" && item.id.trim());
      if (first?.id) return first.id;
    } else if (data?.id) {
      return data.id;
    }
  }
  return undefined;
}

export function normalizePerson(record: PlanningCenterResource): PlanningCenterPersonRef | null {
  if (!record.id) return null;
  const attributes = record.attributes ?? {};
  const firstName = firstString(attributes.first_name, attributes.given_name);
  const lastName = firstString(attributes.last_name, attributes.family_name);
  const displayName =
    firstString(attributes.name, attributes.display_name, attributes.full_name) ??
    [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!displayName) return null;

  return {
    externalPersonId: record.id,
    displayName,
    householdExternalId: relationshipId(record, "household", "households", "primary_household"),
    grade: firstString(attributes.grade, attributes.school_grade),
    ageBand: firstString(attributes.age, attributes.age_group, attributes.age_band),
    sourceUpdatedAt: firstString(attributes.updated_at)
  };
}

export function normalizeAttendance(record: PlanningCenterResource): PlanningCenterAttendanceRef | null {
  if (!record.id) return null;
  const attributes = record.attributes ?? {};
  return {
    externalCheckInId: record.id,
    externalPersonId: relationshipId(record, "person", "checked_in_person"),
    externalEventId: relationshipId(record, "event", "event_period", "check_in_time"),
    sessionLabel: firstString(attributes.event_name, attributes.name, attributes.kind, attributes.session_name),
    locationLabel: firstString(attributes.location_name, attributes.location, attributes.security_code),
    checkedInAt: firstString(attributes.checked_in_at, attributes.created_at)
  };
}
