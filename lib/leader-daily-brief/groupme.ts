const DEFAULT_GROUPME_API_BASE_URL = "https://api.groupme.com/v3";

type LeaderBriefGroupMeEnv = Record<string, string | undefined>;

export type LeaderBriefGroupMeConfig = {
  enabled: boolean;
  configured: boolean;
  botId?: string;
  groupId?: string;
  apiBaseUrl: string;
  missing: string[];
};

export class LeaderBriefGroupMeConfigError extends Error {
  constructor(readonly missing: string[]) {
    super("Leader Daily Brief GroupMe posting is not configured.");
    this.name = "LeaderBriefGroupMeConfigError";
  }
}

export class LeaderBriefGroupMeDisabledError extends Error {
  constructor() {
    super("Leader Daily Brief posting is disabled.");
    this.name = "LeaderBriefGroupMeDisabledError";
  }
}

export class LeaderBriefGroupMePostError extends Error {
  constructor(
    readonly downstreamStatus: number,
    readonly downstreamContentType: string | null,
    readonly downstreamBody: string | null
  ) {
    super(`Leader Daily Brief GroupMe post failed with HTTP ${downstreamStatus}.`);
  }
}

export function readLeaderBriefGroupMeConfig(env: LeaderBriefGroupMeEnv = process.env): LeaderBriefGroupMeConfig {
  const enabledValue = cleanEnv(env.LEADER_DAILY_BRIEF_ENABLED);
  const enabled = enabledValue?.toLowerCase() !== "false";
  const botId = cleanEnv(env.GROUPME_LEADER_BRIEF_BOT_ID);
  const groupId = cleanEnv(env.GROUPME_LEADER_BRIEF_GROUP_ID);
  const apiBaseUrl = cleanEnv(env.GROUPME_API_BASE_URL) ?? DEFAULT_GROUPME_API_BASE_URL;
  const missing = [
    ...(!enabledValue ? ["LEADER_DAILY_BRIEF_ENABLED"] : []),
    ...(!botId ? ["GROUPME_LEADER_BRIEF_BOT_ID"] : []),
    ...(!groupId ? ["GROUPME_LEADER_BRIEF_GROUP_ID"] : [])
  ];
  return { enabled, configured: missing.length === 0, botId, groupId, apiBaseUrl, missing };
}

export async function sendLeaderDailyBriefToGroupMe(params: {
  text: string;
  env?: LeaderBriefGroupMeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ messageId?: string; groupId: string }> {
  const config = readLeaderBriefGroupMeConfig(params.env);
  if (!config.enabled) throw new LeaderBriefGroupMeDisabledError();
  if (!config.configured || !config.botId || !config.groupId) throw new LeaderBriefGroupMeConfigError(config.missing);
  const text = params.text.trim();
  if (!text) throw new Error("Leader Daily Brief message body is required.");
  if (text.length > 1000) throw new Error("GroupMe bot messages must be 1,000 characters or fewer.");

  const response = await (params.fetchImpl ?? fetch)(`${config.apiBaseUrl.replace(/\/+$/, "")}/bots/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: config.botId, text })
  });
  if (!response.ok) {
    throw new LeaderBriefGroupMePostError(
      response.status,
      response.headers.get("content-type"),
      await readSafeResponseBody(response)
    );
  }

  const messageId = await readMessageId(response);
  return { messageId, groupId: config.groupId };
}

async function readSafeResponseBody(response: Response) {
  const body = await response.text().catch(() => "");
  if (!body) return null;
  return body
    .replace(/(["']?(?:bot_id|authorization|api[_-]?key|token|secret)["']?\s*[:=]\s*["']?)[^\s,}"']+/gi, "$1[redacted]")
    .replace(/Bearer\s+[^\s,}"']+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

async function readMessageId(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;
  try {
    const body = JSON.parse(text) as { response?: { message?: { id?: unknown }; id?: unknown }; id?: unknown };
    const id = body.response?.message?.id ?? body.response?.id ?? body.id;
    return typeof id === "string" && id.trim() ? id.trim() : undefined;
  } catch {
    return undefined;
  }
}
