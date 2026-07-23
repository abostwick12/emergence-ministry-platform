const GROUPME_AUTH_URL = "https://oauth.groupme.com/oauth/authorize";
const DEFAULT_GROUPME_API_BASE_URL = "https://api.groupme.com/v3";

export const GROUPME_CALLBACK_PATH = "/integrations/groupme/callback";
export const GROUPME_OAUTH_STATE_COOKIE = "lead_groupme_oauth_state";

type GroupMeEnv = Record<string, string | undefined>;

export type GroupMeConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  encryptionKey?: string;
  apiBaseUrl: string;
  missing: string[];
};

export type GroupMeGroup = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  shareUrl?: string;
  memberCount: number;
};

export type GroupMeMessage = {
  id: string;
  sourceGuid?: string;
  groupId: string;
  senderName: string;
  senderType?: string;
  text: string;
  avatarUrl?: string;
  createdAt: string;
};

type GroupMeEnvelope<T> = {
  response?: T;
  meta?: { code?: number; errors?: string[] };
};

type GroupMeGroupRecord = {
  id?: string;
  group_id?: string;
  name?: string;
  description?: string;
  image_url?: string;
  share_url?: string;
  members?: unknown[];
};

type GroupMeMessageRecord = {
  id?: string;
  source_guid?: string;
  group_id?: string;
  name?: string;
  sender_type?: string;
  text?: string;
  avatar_url?: string;
  created_at?: number;
};

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGroupMeConfig(env: GroupMeEnv = process.env): GroupMeConfig {
  const clientId = cleanEnv(env.GROUPME_CLIENT_ID);
  const clientSecret = cleanEnv(env.GROUPME_CLIENT_SECRET);
  const redirectUri = cleanEnv(env.GROUPME_REDIRECT_URI);
  const encryptionKey = cleanEnv(env.GROUPME_ENCRYPTION_KEY);
  const apiBaseUrl = cleanEnv(env.GROUPME_API_BASE_URL) ?? DEFAULT_GROUPME_API_BASE_URL;
  const required: Array<[string, string | undefined]> = [
    ["GROUPME_CLIENT_ID", clientId],
    ["GROUPME_REDIRECT_URI", redirectUri],
    ["GROUPME_ENCRYPTION_KEY", encryptionKey]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  return { configured: missing.length === 0, clientId, clientSecret, redirectUri, encryptionKey, apiBaseUrl, missing };
}

export class GroupMeConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("GroupMe integration is not configured.");
    this.name = "GroupMeConfigError";
    this.missing = missing;
  }
}

export class GroupMeApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(status === 401 ? "GroupMe authorization expired. Reconnect GroupMe." : `GroupMe API request failed: ${status}`);
    this.name = "GroupMeApiError";
    this.status = status;
  }
}

function requireConfig(env?: GroupMeEnv) {
  const config = readGroupMeConfig(env);
  if (!config.configured || !config.clientId || !config.redirectUri || !config.encryptionKey) {
    throw new GroupMeConfigError(config.missing);
  }
  return config as GroupMeConfig & { clientId: string; redirectUri: string; encryptionKey: string };
}

export function buildGroupMeAuthUrl(params: { state: string; redirectUri?: string; env?: GroupMeEnv }) {
  const config = requireConfig(params.env);
  const url = new URL(GROUPME_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri ?? config.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export function groupMeCallbackUrlForRequest(requestUrl: string) {
  return new URL(GROUPME_CALLBACK_PATH, requestUrl).toString();
}

async function requestGroupMe<T>(params: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  env?: GroupMeEnv;
  fetchImpl?: typeof fetch;
}): Promise<T> {
  const config = requireConfig(params.env);
  const response = await (params.fetchImpl ?? fetch)(`${config.apiBaseUrl}${params.path}`, {
    method: params.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Access-Token": params.accessToken
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body)
  });
  if (!response.ok) throw new GroupMeApiError(response.status);
  const envelope = (await response.json()) as GroupMeEnvelope<T>;
  if (envelope.meta?.code && envelope.meta.code >= 400) throw new GroupMeApiError(envelope.meta.code);
  return envelope.response as T;
}

export async function listGroupMeGroups(params: {
  accessToken: string;
  env?: GroupMeEnv;
  fetchImpl?: typeof fetch;
}): Promise<GroupMeGroup[]> {
  const records = await requestGroupMe<GroupMeGroupRecord[]>({
    ...params,
    path: "/groups?per_page=100"
  });
  return (records ?? []).map(normalizeGroup).filter((group): group is GroupMeGroup => Boolean(group));
}

export async function listGroupMeMessages(params: {
  accessToken: string;
  groupId: string;
  limit?: number;
  env?: GroupMeEnv;
  fetchImpl?: typeof fetch;
}): Promise<GroupMeMessage[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 40, 100));
  const response = await requestGroupMe<{ messages?: GroupMeMessageRecord[] }>({
    ...params,
    path: `/groups/${encodeURIComponent(params.groupId)}/messages?limit=${limit}`
  });
  return (response?.messages ?? [])
    .map(normalizeMessage)
    .filter((message): message is GroupMeMessage => Boolean(message))
    .reverse();
}

export async function sendGroupMeMessage(params: {
  accessToken: string;
  groupId: string;
  text: string;
  sourceGuid: string;
  env?: GroupMeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ id: string; sourceGuid: string }> {
  const body = params.text.trim();
  if (!body) throw new Error("Message body is required.");
  if (body.length > 1000) throw new Error("GroupMe messages must be 1,000 characters or fewer.");
  const response = await requestGroupMe<{ message?: GroupMeMessageRecord } | GroupMeMessageRecord>({
    ...params,
    path: `/groups/${encodeURIComponent(params.groupId)}/messages`,
    method: "POST",
    body: { message: { source_guid: params.sourceGuid, text: body, attachments: [] } }
  });
  let record: GroupMeMessageRecord | undefined;
  if (response && "message" in response) record = response.message;
  else record = response as GroupMeMessageRecord;
  return { id: record?.id ?? params.sourceGuid, sourceGuid: params.sourceGuid };
}

function normalizeGroup(record: GroupMeGroupRecord): GroupMeGroup | null {
  const id = record.id?.trim() || record.group_id?.trim();
  const name = record.name?.trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    description: record.description?.trim() || undefined,
    imageUrl: record.image_url?.trim() || undefined,
    shareUrl: record.share_url?.trim() || undefined,
    memberCount: Array.isArray(record.members) ? record.members.length : 0
  };
}

function normalizeMessage(record: GroupMeMessageRecord): GroupMeMessage | null {
  const id = record.id?.trim();
  const groupId = record.group_id?.trim();
  const text = record.text?.trim();
  if (!id || !groupId || !text) return null;
  return {
    id,
    sourceGuid: record.source_guid?.trim() || undefined,
    groupId,
    senderName: record.name?.trim() || "GroupMe member",
    senderType: record.sender_type?.trim() || undefined,
    text,
    avatarUrl: record.avatar_url?.trim() || undefined,
    createdAt: new Date((record.created_at ?? 0) * 1000).toISOString()
  };
}
