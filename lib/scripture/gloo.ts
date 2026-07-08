import type { MetanarrativeMovement } from "@/lib/scripture/types";

export type GlooDiscussionDraftInput = {
  question: string;
  scriptureReference: string;
  metanarrativeMovement?: MetanarrativeMovement;
  retrievedContext?: string;
};

export type GlooModelTier = "default" | "escalation" | "long_context";

export type GlooModelSelection = {
  model: string;
  tier: GlooModelTier;
  reason: string;
  escalationReason: string;
  topicFlags: string[];
};

export type GlooDiscussionDraftResult =
  | {
      ok: true;
      provider: "gloo";
      model: string;
      modelTier: GlooModelTier;
      modelReason: string;
      escalationReason: string;
      topicTags: string[];
      confidence: number;
      discussionPrompt: string;
      safetyLabel: "safe" | "needs_leader_care" | "pastoral_escalation";
      safetyNotes: string;
    }
  | {
      ok: false;
      code: "not_configured" | "provider_error";
      message: string;
    };

type GlooChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
    text?: unknown;
  }>;
};

type ParsedDraft = {
  discussionPrompt?: unknown;
  safetyLabel?: unknown;
  safetyNotes?: unknown;
  confidence?: unknown;
  topicTags?: unknown;
  escalationRecommended?: unknown;
  escalationReason?: unknown;
};

type GlooProviderFailure = {
  message: string;
  status?: number;
  statusText?: string;
  url?: string;
};

export function isGlooConfigured(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const credentials = getGlooCredentials(env);
  return Boolean(
    credentials.apiKey &&
      credentials.apiBaseUrl &&
      getPrimaryGlooModel(env)
  );
}

export function selectGlooModelPolicy(
  input: GlooDiscussionDraftInput,
  env: Partial<NodeJS.ProcessEnv> = process.env
): GlooModelSelection | undefined {
  const primaryModel = getPrimaryGlooModel(env);
  if (!primaryModel) return undefined;

  const escalationModel = env.GLOO_AI_ESCALATION_MODEL?.trim();
  const longContextModel = env.GLOO_AI_LONG_CONTEXT_MODEL?.trim();
  const topicFlags = findSensitiveTopicFlags(input.question);
  const contextSize = `${input.question}\n${input.scriptureReference}\n${input.retrievedContext ?? ""}`.length;

  if (longContextModel && contextSize > 12000) {
    return {
      model: longContextModel,
      tier: "long_context",
      reason: "Very large retrieved context selected the long-context model.",
      escalationReason: topicFlags.length ? `Sensitive-topic flags also present: ${topicFlags.join(", ")}.` : "",
      topicFlags
    };
  }

  if (escalationModel && topicFlags.length) {
    return {
      model: escalationModel,
      tier: "escalation",
      reason: "Sensitive or complex theological topic selected the escalation model.",
      escalationReason: topicFlags.join(", "),
      topicFlags
    };
  }

  return {
    model: primaryModel,
    tier: "default",
    reason: "Default first-pass model for student question classification and draft generation.",
    escalationReason: "",
    topicFlags
  };
}

export async function generateGlooDiscussionDraft(input: GlooDiscussionDraftInput): Promise<GlooDiscussionDraftResult> {
  const { apiKey, apiBaseUrl } = getGlooCredentials(process.env);
  const selection = selectGlooModelPolicy(input);

  if (!apiKey || !apiBaseUrl || !selection) {
    return {
      ok: false,
      code: "not_configured",
      message: "Gloo AI Studio is not configured yet. Set the server-only key, base URL, and primary model before generating drafts."
    };
  }

  const firstDraft = await requestGlooDiscussionDraft(input, apiBaseUrl, apiKey, selection);
  if (!firstDraft.ok) return firstDraft;

  const escalationModel = process.env.GLOO_AI_ESCALATION_MODEL?.trim();
  if (selection.tier === "default" && escalationModel && needsProviderEscalation(firstDraft)) {
    const escalatedSelection: GlooModelSelection = {
      model: escalationModel,
      tier: "escalation",
      reason: "Default model first pass requested escalation because confidence or safety risk required deeper review.",
      escalationReason: firstDraft.escalationReason || `confidence ${firstDraft.confidence}; safety ${firstDraft.safetyLabel}`,
      topicFlags: firstDraft.topicTags
    };
    return requestGlooDiscussionDraft(input, apiBaseUrl, apiKey, escalatedSelection);
  }

  return firstDraft;
}

async function requestGlooDiscussionDraft(
  input: GlooDiscussionDraftInput,
  apiBaseUrl: string,
  apiKey: string,
  selection: GlooModelSelection
): Promise<GlooDiscussionDraftResult> {
  const body = JSON.stringify({
    model: selection.model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You help student ministry leaders prepare careful, Scripture-grounded discussion prompts. Return only JSON with keys discussionPrompt, safetyLabel, safetyNotes, confidence, topicTags, escalationRecommended, escalationReason. The safetyLabel must be one of safe, needs_leader_care, pastoral_escalation. confidence must be a number from 0 to 1. topicTags must be short lowercase strings. Do not claim pastoral authority, do not give crisis counseling, and do not include full Bible text."
      },
      {
        role: "user",
        content:
          `Student question: ${input.question}\n` +
          `Scripture reference: ${input.scriptureReference || "not selected"}\n` +
          `Quiet story-lens hint: ${input.metanarrativeMovement ?? "infer from the question and passage"}\n\n` +
          `Model routing: ${selection.reason}${selection.escalationReason ? ` Escalation reason: ${selection.escalationReason}` : ""}\n\n` +
          "Draft one Socratic small-group discussion prompt for leader review. Keep it humble, conversational, and grounded in the reference without quoting the passage."
      }
    ]
  });

  let lastFailure: GlooProviderFailure | undefined;
  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body
    });

    if (!response.ok) {
      lastFailure = {
        message: providerStatusMessage(response.status),
        status: response.status,
        statusText: response.statusText,
        url: redactGlooUrl(url)
      };
      if (response.status === 404 && shouldTryNextGlooUrl(apiBaseUrl)) continue;
      logGlooProviderFailure(lastFailure);
      return { ok: false, code: "provider_error", message: lastFailure.message };
    }

    const payload = (await response.json()) as GlooChatResponse;
    const content = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
    if (typeof content !== "string") {
      const failure = { message: "Gloo AI Studio returned an unexpected response.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    const parsed = parseDraftContent(content, selection);
    if (!parsed) {
      const failure = { message: "Gloo AI Studio returned a draft that could not be parsed.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    return parsed;
  }

  if (lastFailure) logGlooProviderFailure(lastFailure);
  return { ok: false, code: "provider_error", message: lastFailure?.message ?? "Gloo AI Studio did not return a usable draft." };
}

function needsProviderEscalation(draft: Extract<GlooDiscussionDraftResult, { ok: true }>) {
  return draft.confidence < 0.72 || draft.safetyLabel !== "safe" || Boolean(draft.escalationReason);
}

function resolveGlooChatUrls(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  const urls = new Set<string>();
  if (trimmed.endsWith("/chat/completions")) return [trimmed];
  if (trimmed.endsWith("/v1")) return [`${trimmed}/chat/completions`];
  if (trimmed.endsWith("/api/v1")) return [`${trimmed}/chat/completions`];

  urls.add(`${trimmed}/chat/completions`);
  urls.add(`${trimmed}/v1/chat/completions`);
  urls.add(`${trimmed}/api/chat/completions`);
  urls.add(`${trimmed}/api/v1/chat/completions`);

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "platform.ai.gloo.com") {
      urls.add("https://api.ai.gloo.com/v1/chat/completions");
      urls.add("https://api.ai.gloo.com/chat/completions");
    }
  } catch {
    // Invalid URLs are handled by fetch and logged through the provider failure path.
  }

  return Array.from(urls);
}

function shouldTryNextGlooUrl(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  return !trimmed.endsWith("/chat/completions") && !trimmed.endsWith("/v1");
}

function providerStatusMessage(status: number) {
  if (status === 400) return "Gloo AI Studio rejected the draft request. Check the model name and request format.";
  if (status === 401 || status === 403) return "Gloo AI Studio rejected the configured credentials.";
  if (status === 404) return "Gloo AI Studio could not find the configured chat-completions endpoint.";
  if (status === 429) return "Gloo AI Studio rate-limited the draft request.";
  if (status >= 500) return "Gloo AI Studio is temporarily unavailable.";
  return `Gloo AI Studio returned HTTP ${status}.`;
}

function redactGlooUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function logGlooProviderFailure(failure: GlooProviderFailure) {
  console.warn("[gloo] discussion draft provider failure", {
    timestamp: new Date().toISOString(),
    status: failure.status,
    statusText: failure.statusText,
    url: failure.url,
    message: failure.message
  });
}

function parseDraftContent(content: string, selection: GlooModelSelection): GlooDiscussionDraftResult | undefined {
  let parsed: ParsedDraft;
  try {
    parsed = JSON.parse(content) as ParsedDraft;
  } catch {
    return undefined;
  }

  const discussionPrompt = typeof parsed.discussionPrompt === "string" ? parsed.discussionPrompt.trim() : "";
  const safetyLabel = normalizeSafetyLabel(parsed.safetyLabel);
  const safetyNotes = typeof parsed.safetyNotes === "string" ? parsed.safetyNotes.trim() : "";
  const confidence = normalizeConfidence(parsed.confidence);
  const topicTags = normalizeTopicTags(parsed.topicTags, selection.topicFlags);
  const escalationRecommended = parsed.escalationRecommended === true;
  const modelReason =
    escalationRecommended && selection.tier === "default" ? "Default model recommended leader-care escalation." : selection.reason;
  const escalationReason =
    typeof parsed.escalationReason === "string" && parsed.escalationReason.trim()
      ? parsed.escalationReason.trim()
      : selection.escalationReason || (escalationRecommended ? "default model requested escalation" : "");

  if (!discussionPrompt || !safetyLabel || !safetyNotes) return undefined;

  return {
    ok: true,
    provider: "gloo",
    model: selection.model,
    modelTier: selection.tier,
    modelReason: limitText(modelReason, 500),
    escalationReason: limitText(escalationReason, 500),
    topicTags,
    confidence,
    discussionPrompt: limitText(discussionPrompt, 1800),
    safetyLabel,
    safetyNotes: limitText(safetyNotes, 900)
  };
}

function normalizeSafetyLabel(value: unknown): "safe" | "needs_leader_care" | "pastoral_escalation" | undefined {
  if (value === "safe" || value === "needs_leader_care" || value === "pastoral_escalation") return value;
  return undefined;
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
}

function getPrimaryGlooModel(env: Partial<NodeJS.ProcessEnv>) {
  return env.GLOO_AI_MODEL?.trim() || env.GLOO_AI_STUDIO_MODEL?.trim() || "";
}

function getGlooCredentials(env: Partial<NodeJS.ProcessEnv>) {
  return {
    apiKey: env.GLOO_AI_STUDIO_API_KEY?.trim() || env.GLOO_AI_CLIENT_SECRET?.trim() || "",
    apiBaseUrl: env.GLOO_AI_STUDIO_API_BASE_URL?.trim() || env.GLOO_AI_BASE_URL?.trim() || ""
  };
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.65;
  return Math.min(1, Math.max(0, value));
}

function normalizeTopicTags(value: unknown, fallbackTags: string[]) {
  const parsed = Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().toLowerCase())
    : [];
  return Array.from(new Set([...parsed, ...fallbackTags])).filter(Boolean).slice(0, 8);
}

function findSensitiveTopicFlags(question: string) {
  const normalized = question.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["suffering", /\b(suffer|suffering|pain|grief|grieving|death|trauma|tragedy|loss)\b/],
    ["sexuality_identity", /\b(sexuality|gender|identity|lgbt|gay|lesbian|trans|same-sex|same sex)\b/],
    ["hell_judgment", /\b(hell|judgment|judgement|wrath|condemn|damnation)\b/],
    ["doubt_deconstruction", /\b(doubt\w*|deconstruct\w*|unbelief|faith crisis|walk away)\b/],
    ["abuse_family_crisis", /\b(abuse|abusive|assault|self-harm|suicide|family crisis|divorce|neglect)\b/],
    ["old_testament_violence", /\b(violence|genocide|slavery|conquest|canaan|canaanite|war|kill|killing)\b/],
    ["hard_theological_synthesis", /\b(trinity|predestination|election|atonement|theodicy|inerrancy|contradiction)\b/]
  ];

  return checks.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
}
