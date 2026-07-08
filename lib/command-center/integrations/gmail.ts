// Gmail integration for the Personal Command Center: read, organize
// (labels/folders), and draft-only replies — everything an assistant could
// do short of sending. Mirrors lib/command-center/integrations/google-calendar.ts
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
// intentionally implements no send/drafts.send call anywhere, at every
// capability level below (read, organize, draft).
//
// Organize uses gmail.labels rather than the broader gmail.modify: labels
// scope grants label CRUD plus adding/removing labels on messages (which is
// how "moving to a folder" works in Gmail — there are no real folders,
// just labels, and "moving" a message means adding the target label and
// removing INBOX). gmail.modify would additionally allow things like
// permanently trashing threads that this integration has no need for.
//
// triageAndDraftImportantMessages() reuses SAGE's own AI provider (see
// lib/command-center/sage.ts) to judge importance and compose a reply, the
// same way lib/command-center/integrations/linkedin.ts drafts LinkedIn
// content. It only ever creates a draft — it is Andrew-triggered (never
// scheduled) and never sends anything.

import { streamSageResponse } from "@/lib/command-center/sage";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_LABELS_SCOPE = "https://www.googleapis.com/auth/gmail.labels";
export const GMAIL_SCOPES = `${GMAIL_READONLY_SCOPE} ${GMAIL_COMPOSE_SCOPE} ${GMAIL_LABELS_SCOPE}`;
export const GMAIL_OAUTH_STATE_COOKIE = "cc_gmail_oauth_state";

// Fixed label SAGE stages drafted replies under, so Andrew can find every
// draft SAGE created for review in one place inside Gmail itself. Uses a
// "/" so Gmail displays it as a nested label (visually like a sub-folder).
export const GMAIL_DRAFT_REVIEW_LABEL_NAME = "SAGE/Draft Review";

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
  labelIds: string[];
};

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
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
  labelIds?: string[];
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
        snippet: meta.snippet ?? "",
        labelIds: meta.labelIds ?? []
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

// --- Organize (labels / "folders") ------------------------------------

type GmailLabelResponse = { id: string; name: string; type?: string };
type GmailLabelsListResponse = { labels?: GmailLabelResponse[] };

function toGmailLabel(label: GmailLabelResponse): GmailLabel {
  return { id: label.id, name: label.name, type: label.type === "system" ? "system" : "user" };
}

export async function listGmailLabels(params: { accessToken: string; fetchImpl?: typeof fetch }): Promise<GmailLabel[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${GMAIL_API_BASE}/labels`, {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Gmail labels list failed: ${response.status}`);
  const json = (await response.json()) as GmailLabelsListResponse;
  return (json.labels ?? []).map(toGmailLabel);
}

// Creates a new user label ("folder"). Gmail rejects a duplicate name with
// a 409 — callers that want idempotent behavior should use
// findOrCreateGmailLabel instead.
export async function createGmailLabel(params: { accessToken: string; name: string; fetchImpl?: typeof fetch }): Promise<GmailLabel> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${GMAIL_API_BASE}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: params.name, labelListVisibility: "labelShow", messageListVisibility: "show" })
  });
  if (!response.ok) throw new Error(`Gmail label creation failed: ${response.status}`);
  return toGmailLabel((await response.json()) as GmailLabelResponse);
}

// Idempotent: returns the existing label if a same-named (case-insensitive)
// label already exists, otherwise creates it. This is what "create a
// folder" and "move to a folder that doesn't exist yet" both use.
export async function findOrCreateGmailLabel(params: {
  accessToken: string;
  name: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailLabel> {
  const labels = await listGmailLabels(params);
  const existing = labels.find((label) => label.name.toLowerCase() === params.name.toLowerCase());
  if (existing) return existing;
  return createGmailLabel(params);
}

// Adds/removes labels on one message. This is the only write primitive for
// "organizing" mail — it never deletes a message and never touches send.
export async function modifyGmailMessageLabels(params: {
  accessToken: string;
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${GMAIL_API_BASE}/messages/${params.messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ addLabelIds: params.addLabelIds ?? [], removeLabelIds: params.removeLabelIds ?? [] })
  });
  if (!response.ok) throw new Error(`Gmail message label update failed: ${response.status}`);
}

// "Move to folder": Gmail has no real folders, so this adds the target
// label and removes INBOX, which is how a message leaves the inbox view
// and appears under the target label instead — the same effect a user
// gets from dragging a message into a label in Gmail's own UI.
export async function moveGmailMessageToLabel(params: {
  accessToken: string;
  messageId: string;
  labelName: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailLabel> {
  const label = await findOrCreateGmailLabel({ accessToken: params.accessToken, name: params.labelName, fetchImpl: params.fetchImpl });
  await modifyGmailMessageLabels({
    accessToken: params.accessToken,
    messageId: params.messageId,
    addLabelIds: [label.id],
    removeLabelIds: ["INBOX"],
    fetchImpl: params.fetchImpl
  });
  return label;
}

// Labels a drafted reply's underlying message under GMAIL_DRAFT_REVIEW_LABEL_NAME
// so every draft SAGE creates is easy for Andrew to find in one place in
// Gmail, distinct from drafts Andrew started himself.
export async function stageGmailDraftForReview(params: { accessToken: string; messageId: string; fetchImpl?: typeof fetch }): Promise<void> {
  const label = await findOrCreateGmailLabel({
    accessToken: params.accessToken,
    name: GMAIL_DRAFT_REVIEW_LABEL_NAME,
    fetchImpl: params.fetchImpl
  });
  await modifyGmailMessageLabels({
    accessToken: params.accessToken,
    messageId: params.messageId,
    addLabelIds: [label.id],
    fetchImpl: params.fetchImpl
  });
}

// --- Full message read (needed to judge importance / draft a real reply) --

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

type GmailFullMessageResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePart & { headers?: Array<{ name?: string; value?: string }> };
};

function base64UrlDecode(data: string): string {
  return Buffer.from(data, "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Depth-first search for the first text/plain part, falling back to
// text/html (stripped of markup) if no plain-text part exists.
function extractMessageBody(payload: GmailMessagePart | undefined): string {
  if (!payload) return "";

  let htmlFallback: string | null = null;

  function walk(part: GmailMessagePart): string | null {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return base64UrlDecode(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body?.data && htmlFallback === null) {
      htmlFallback = stripHtml(base64UrlDecode(part.body.data));
    }
    for (const child of part.parts ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(payload) ?? htmlFallback ?? "";
}

export type GmailMessageDetail = GmailMessageSummary & { body: string };

export async function getGmailMessageBody(params: {
  accessToken: string;
  messageId: string;
  fetchImpl?: typeof fetch;
}): Promise<GmailMessageDetail> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${GMAIL_API_BASE}/messages/${params.messageId}?format=full`, {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Gmail message read failed: ${response.status}`);
  const json = (await response.json()) as GmailFullMessageResponse;
  const headers = json.payload?.headers ?? [];
  return {
    id: json.id,
    threadId: json.threadId,
    subject: headerValue(headers, "Subject") || "(no subject)",
    from: headerValue(headers, "From"),
    date: headerValue(headers, "Date"),
    snippet: json.snippet ?? "",
    labelIds: json.labelIds ?? [],
    body: extractMessageBody(json.payload)
  };
}

// --- SAGE-powered triage and draft staging --------------------------------

const GMAIL_TRIAGE_INSTRUCTIONS = `You are SAGE, triaging one email in Andrew Bostwick's inbox. You are given its subject, sender, date, and full body. Decide two things: whether it is important enough that Andrew should personally reply soon (skip routine notifications, receipts, automated confirmations, and newsletters), and, if important, a complete, ready-to-send reply in a direct, warm, concise voice with no corporate jargon.

Respond in exactly this format and nothing else:
IMPORTANT: yes or no
REASON: one short sentence
DRAFT:
the full reply text, or the single word NONE if not important`;

function parseGmailTriageResponse(raw: string): { important: boolean; reason: string; draft: string | null } {
  const importantMatch = /IMPORTANT:\s*(yes|no)/i.exec(raw);
  const reasonMatch = /REASON:\s*(.+)/i.exec(raw);
  const draftMatch = /DRAFT:\s*([\s\S]*)$/i.exec(raw);
  const important = importantMatch?.[1]?.toLowerCase() === "yes";
  const reason = reasonMatch?.[1]?.trim() ?? "";
  const draftText = draftMatch?.[1]?.trim() ?? "";
  const hasDraft = important && draftText.length > 0 && draftText.toUpperCase() !== "NONE";
  return { important, reason, draft: hasDraft ? draftText : null };
}

export type GmailTriageResult = {
  messageId: string;
  subject: string;
  from: string;
  important: boolean;
  reason: string;
  draftId?: string;
};

// Andrew-triggered only — there is no scheduled/automatic caller of this
// function anywhere in the codebase. For each of the most recent inbox
// messages: reads the full body, asks SAGE whether it's important and (if
// so) drafts a reply, creates that draft, and stages it under
// GMAIL_DRAFT_REVIEW_LABEL_NAME. Never sends. Andrew reviews every draft in
// Gmail before deciding whether to send it himself.
type StreamSageResponseParams = Parameters<typeof streamSageResponse>[0];

export async function triageAndDraftImportantMessages(params: {
  accessToken: string;
  maxMessages?: number;
  signal: AbortSignal;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  streamers?: StreamSageResponseParams["streamers"];
}): Promise<GmailTriageResult[]> {
  const summaries = await listRecentGmailMessages({
    accessToken: params.accessToken,
    maxResults: params.maxMessages ?? 5,
    fetchImpl: params.fetchImpl
  });

  const results: GmailTriageResult[] = [];

  for (const summary of summaries) {
    const detail = await getGmailMessageBody({
      accessToken: params.accessToken,
      messageId: summary.id,
      fetchImpl: params.fetchImpl
    });
    const input = `Subject: ${detail.subject}\nFrom: ${detail.from}\nDate: ${detail.date}\n\n${detail.body || detail.snippet}`;
    const response = await streamSageResponse({
      instructions: GMAIL_TRIAGE_INSTRUCTIONS,
      input,
      signal: params.signal,
      env: params.env,
      streamers: params.streamers
    });
    const parsed = parseGmailTriageResponse(response.content);

    let draftId: string | undefined;
    if (parsed.draft) {
      const subject = detail.subject.toLowerCase().startsWith("re:") ? detail.subject : `Re: ${detail.subject}`;
      const draft = await createGmailDraft({
        accessToken: params.accessToken,
        to: detail.from,
        subject,
        body: parsed.draft,
        inReplyTo: detail.id,
        threadId: detail.threadId,
        fetchImpl: params.fetchImpl
      });
      await stageGmailDraftForReview({ accessToken: params.accessToken, messageId: draft.messageId, fetchImpl: params.fetchImpl });
      draftId = draft.draftId;
    }

    results.push({
      messageId: summary.id,
      subject: detail.subject,
      from: detail.from,
      important: parsed.important,
      reason: parsed.reason,
      draftId
    });
  }

  return results;
}
