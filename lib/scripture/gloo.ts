import type { MetanarrativeMovement } from "@/lib/scripture/types";
import { measureServerOperation } from "@/lib/performance/timing";

const PROVIDER_TIMEOUT_MS = 45_000;
const PROVIDER_MAX_OUTPUT_TOKENS = 1_200;
const GLOO_TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const GLOO_DEFAULT_API_BASE_URL = "https://platform.ai.gloo.com/ai/v2";
const GLOO_TOKEN_REFRESH_BUFFER_MS = 60_000;

const GLOO_MODEL_ALIASES: Record<string, string> = {
  "gpt-5 nano": "gloo-openai-gpt-5-nano",
  "gpt-5 mini": "gloo-openai-gpt-5-mini",
  "gemini 2.5 flash lite": "gloo-google-gemini-2.5-flash-lite"
};

type GlooCredentials = {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
};

type GlooAccessTokenPayload = {
  access_token?: unknown;
  expires_in?: unknown;
};

let cachedGlooAccessToken: { clientId: string; accessToken: string; expiresAtMs: number } | undefined;
let pendingGlooAccessToken: { clientId: string; promise: Promise<string> } | undefined;

export type GlooDiscussionDraftInput = {
  question: string;
  scriptureReference: string;
  metanarrativeMovement?: MetanarrativeMovement;
  retrievedContext?: string;
  internalGroundingContext?: string;
};

export type GlooReadingPlanDraftInput = {
  title: string;
  audience: string;
  duration: string;
  primaryScripture: string;
  contextNotes: string;
  observationQuestion: string;
  interpretationQuestion: string;
  applicationQuestion: string;
  discussionQuestion: string;
  prayerPrompt: string;
  guardrailNotes: string;
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
      scriptureReference?: string;
      safetyLabel: "safe" | "needs_leader_care" | "pastoral_escalation";
      safetyNotes: string;
    }
  | {
      ok: false;
      code: "not_configured" | "provider_error";
      message: string;
    };

export type GlooDiagnosticAttempt = {
  url: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  message: string;
};

export type GlooDiagnosticResult = {
  ok: boolean;
  configured: boolean;
  credentialsConfigured: boolean;
  baseUrlConfigured: boolean;
  primaryModelConfigured: boolean;
  primaryModel: string;
  escalationModel: string;
  longContextModel: string;
  selectedModel: string;
  selectedTier: GlooModelTier | "";
  message: string;
  attempts: GlooDiagnosticAttempt[];
  draftPreview?: {
    discussionPrompt: string;
    safetyLabel: string;
    confidence: number;
  };
};

export type GlooDiscussionPreview =
  | {
      ok: true;
      provider: "gloo";
      model: string;
      modelTier: GlooModelTier;
      confidence: number;
      discussionPrompt: string;
      safetyLabel: "safe" | "needs_leader_care" | "pastoral_escalation";
      safetyNotes: string;
      message: string;
    }
  | {
      ok: false;
      configured: boolean;
      code: "not_configured" | "provider_error";
      message: string;
    };

export type GlooReadingPlanDraftResult =
  | {
      ok: true;
      provider: "gloo";
      model: string;
      modelReason: string;
      title: string;
      audience: string;
      duration: string;
      primaryScripture: string;
      movement: MetanarrativeMovement;
      summary: string;
      contextFocus: string;
      weeklyRhythm: string[];
      discussionPrompts: string[];
      guardrailNotes: string[];
      prayerPrompt: string;
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
  scriptureReference?: unknown;
  safetyLabel?: unknown;
  safetyNotes?: unknown;
  confidence?: unknown;
  topicTags?: unknown;
  escalationRecommended?: unknown;
  escalationReason?: unknown;
};

type ParsedReadingPlanDraft = {
  title?: unknown;
  audience?: unknown;
  duration?: unknown;
  primaryScripture?: unknown;
  movement?: unknown;
  summary?: unknown;
  contextFocus?: unknown;
  weeklyRhythm?: unknown;
  discussionPrompts?: unknown;
  guardrailNotes?: unknown;
  prayerPrompt?: unknown;
  safetyNotes?: unknown;
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
    hasGlooCredentials(credentials) &&
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

  const escalationModel = normalizeGlooModelId(env.GLOO_AI_ESCALATION_MODEL);
  const longContextModel = normalizeGlooModelId(env.GLOO_AI_LONG_CONTEXT_MODEL);
  const topicFlags = findSensitiveTopicFlags(input.question);
  const contextSize = `${input.question}\n${input.scriptureReference}\n${input.retrievedContext ?? ""}\n${input.internalGroundingContext ?? ""}`.length;

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
  const credentials = getGlooCredentials(process.env);
  const { apiBaseUrl } = credentials;
  const selection = selectGlooModelPolicy(input);

  if (!hasGlooCredentials(credentials) || !apiBaseUrl || !selection) {
    return {
      ok: false,
      code: "not_configured",
      message: "AI drafting is offline. Configure Gloo AI Studio before launch; knowledge-guided fallback remains available only for leader review."
    };
  }

  const accessToken = await resolveGlooAccessTokenSafely(credentials);
  if (!accessToken.ok) return accessToken.result;

  const firstDraft = await requestGlooDiscussionDraft(input, apiBaseUrl, accessToken.token, selection);
  if (!firstDraft.ok) return firstDraft;

  const escalationModel = normalizeGlooModelId(process.env.GLOO_AI_ESCALATION_MODEL);
  if (selection.tier === "default" && escalationModel && needsProviderEscalation(firstDraft)) {
    const escalatedSelection: GlooModelSelection = {
      model: escalationModel,
      tier: "escalation",
      reason: "Default model first pass requested escalation because confidence or safety risk required deeper review.",
      escalationReason: firstDraft.escalationReason || `confidence ${firstDraft.confidence}; safety ${firstDraft.safetyLabel}`,
      topicFlags: firstDraft.topicTags
    };
    const escalatedDraft = await requestGlooDiscussionDraft(input, apiBaseUrl, accessToken.token, escalatedSelection);
    if (escalatedDraft.ok) return escalatedDraft;

    return {
      ...firstDraft,
      modelReason: limitText(
        `${firstDraft.modelReason} The escalation model did not return a usable draft, so Meridian retained the valid first pass for leader review.`,
        500
      ),
      safetyNotes: limitText(
        `${firstDraft.safetyNotes} The escalation attempt did not complete; review this first-pass draft carefully before approval.`,
        900
      )
    };
  }

  return firstDraft;
}

export async function generateGlooReadingPlanDraft(input: GlooReadingPlanDraftInput): Promise<GlooReadingPlanDraftResult> {
  const credentials = getGlooCredentials(process.env);
  const { apiBaseUrl } = credentials;
  const selection = selectGlooModelPolicy({
    question: `${input.title}\n${input.contextNotes}\n${input.guardrailNotes}`,
    scriptureReference: input.primaryScripture
  });

  if (!hasGlooCredentials(credentials) || !apiBaseUrl || !selection) {
    return {
      ok: false,
      code: "not_configured",
      message: "AI reading-plan drafting is offline. Configure Gloo AI Studio before launch."
    };
  }

  const accessToken = await resolveGlooAccessTokenSafely(credentials);
  if (!accessToken.ok) return accessToken.result;

  const body = createGlooReadingPlanRequestBody(input, selection);
  let lastFailure: GlooProviderFailure | undefined;
  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    let response: Response;
    try {
      response = await timedGlooFetch("provider.gloo.generate", url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json"
        },
        body
      });
    } catch (error) {
      lastFailure = {
        message: error instanceof Error ? limitText(error.message, 240) : "Gloo AI Studio reading-plan request failed.",
        url: redactGlooUrl(url)
      };
      logGlooProviderFailure(lastFailure);
      return { ok: false, code: "provider_error", message: lastFailure.message };
    }

    if (!response.ok) {
      lastFailure = {
        message: providerStatusMessage(response.status),
        status: response.status,
        statusText: response.statusText,
        url: redactGlooUrl(url)
      };
      logGlooProviderFailure(lastFailure);
      return { ok: false, code: "provider_error", message: lastFailure.message };
    }

    let payload: GlooChatResponse;
    try {
      payload = (await response.json()) as GlooChatResponse;
    } catch {
      const failure = { message: "Gloo AI Studio returned an unreadable reading-plan response.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    const content = extractGlooTextContent(payload);
    if (typeof content !== "string") {
      const failure = { message: "Gloo AI Studio returned an unexpected reading-plan response.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    const parsed = parseReadingPlanContent(content, selection, input);
    if (!parsed) {
      const failure = { message: "Gloo AI Studio returned a reading-plan draft that could not be parsed.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    return parsed;
  }

  if (lastFailure) logGlooProviderFailure(lastFailure);
  return { ok: false, code: "provider_error", message: lastFailure?.message ?? "Gloo AI Studio did not return a usable reading-plan draft." };
}

export async function runGlooDiscussionDiagnostic(
  input: GlooDiscussionDraftInput = {
    question: "Why did God put the tree of knowledge of good and evil in the garden?",
    scriptureReference: "Genesis 3",
    metanarrativeMovement: "Creation"
  },
  env: Partial<NodeJS.ProcessEnv> = process.env
): Promise<GlooDiagnosticResult> {
  const credentials = getGlooCredentials(env);
  const { apiBaseUrl } = credentials;
  const primaryModel = getPrimaryGlooModel(env);
  const selection = selectGlooModelPolicy(input, env);
  const base: Omit<GlooDiagnosticResult, "ok" | "configured" | "message" | "attempts"> = {
    credentialsConfigured: hasGlooCredentials(credentials),
    baseUrlConfigured: Boolean(apiBaseUrl),
    primaryModelConfigured: Boolean(primaryModel),
    primaryModel,
    escalationModel: normalizeGlooModelId(env.GLOO_AI_ESCALATION_MODEL),
    longContextModel: normalizeGlooModelId(env.GLOO_AI_LONG_CONTEXT_MODEL),
    selectedModel: selection?.model ?? "",
    selectedTier: selection?.tier ?? ""
  };

  if (!hasGlooCredentials(credentials) || !apiBaseUrl || !selection) {
    return {
      ...base,
      ok: false,
      configured: false,
      message: "Gloo AI Studio is missing a server credential, base URL, or primary model.",
      attempts: []
    };
  }

  const body = createGlooDraftRequestBody(input, selection);
  const attempts: GlooDiagnosticAttempt[] = [];
  const accessToken = await resolveGlooAccessTokenForDiagnostic(credentials);
  if (!accessToken.ok) {
    return {
      ...base,
      ok: false,
      configured: true,
      message: accessToken.attempt.message,
      attempts: [accessToken.attempt]
    };
  }

  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    try {
      const response = await timedGlooFetch("provider.gloo.diagnostic", url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json"
        },
        body
      });

      if (!response.ok) {
        const attempt = {
          url: redactGlooUrl(url),
          ok: false,
          status: response.status,
          statusText: response.statusText,
          message: providerStatusMessage(response.status)
        };
        attempts.push(attempt);
        return {
          ...base,
          ok: false,
          configured: true,
          message: attempt.message,
          attempts
        };
      }

      const payload = (await response.json()) as GlooChatResponse;
      const content = extractGlooTextContent(payload);
      if (typeof content !== "string") {
        const attempt = {
          url: redactGlooUrl(url),
          ok: false,
          status: response.status,
          statusText: response.statusText,
          message: "Gloo AI Studio responded, but the response did not include text content."
        };
        attempts.push(attempt);
        return {
          ...base,
          ok: false,
          configured: true,
          message: attempt.message,
          attempts
        };
      }

      const parsed = parseDraftContent(content, selection);
      if (!parsed?.ok) {
        const attempt = {
          url: redactGlooUrl(url),
          ok: false,
          status: response.status,
          statusText: response.statusText,
          message: "Gloo AI Studio responded, but the draft JSON could not be parsed."
        };
        attempts.push(attempt);
        return {
          ...base,
          ok: false,
          configured: true,
          message: attempt.message,
          attempts
        };
      }

      attempts.push({
        url: redactGlooUrl(url),
        ok: true,
        status: response.status,
        statusText: response.statusText,
        message: "Gloo AI Studio returned a usable draft."
      });

      return {
        ...base,
        ok: true,
        configured: true,
        message: "Gloo AI Studio returned a usable draft.",
        attempts,
        draftPreview: {
          discussionPrompt: parsed.discussionPrompt,
          safetyLabel: parsed.safetyLabel,
          confidence: parsed.confidence
        }
      };
    } catch (error) {
      const attempt = {
        url: redactGlooUrl(url),
        ok: false,
        message: error instanceof Error ? limitText(error.message, 240) : "Network request failed."
      };
      attempts.push(attempt);
      return {
        ...base,
        ok: false,
        configured: true,
        message: attempt.message,
        attempts
      };
    }
  }

  return {
    ...base,
    ok: false,
    configured: true,
    message: attempts.at(-1)?.message ?? "Gloo AI Studio did not return a usable draft.",
    attempts
  };
}

async function requestGlooDiscussionDraft(
  input: GlooDiscussionDraftInput,
  apiBaseUrl: string,
  accessToken: string,
  selection: GlooModelSelection
): Promise<GlooDiscussionDraftResult> {
  const body = createGlooDraftRequestBody(input, selection);

  let lastFailure: GlooProviderFailure | undefined;
  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    let response: Response;
    try {
      response = await timedGlooFetch("provider.gloo.generate", url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body
      });
    } catch (error) {
      lastFailure = {
        message: error instanceof Error ? limitText(error.message, 240) : "Gloo AI Studio request failed.",
        url: redactGlooUrl(url)
      };
      logGlooProviderFailure(lastFailure);
      return { ok: false, code: "provider_error", message: lastFailure.message };
    }

    if (!response.ok) {
      lastFailure = {
        message: providerStatusMessage(response.status),
        status: response.status,
        statusText: response.statusText,
        url: redactGlooUrl(url)
      };
      logGlooProviderFailure(lastFailure);
      return { ok: false, code: "provider_error", message: lastFailure.message };
    }

    let payload: GlooChatResponse;
    try {
      payload = (await response.json()) as GlooChatResponse;
    } catch {
      const failure = { message: "Gloo AI Studio returned an unreadable response.", url: redactGlooUrl(url) };
      logGlooProviderFailure(failure);
      return { ok: false, code: "provider_error", message: failure.message };
    }

    const content = extractGlooTextContent(payload);
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

function timedGlooFetch(
  operation: "provider.gloo.authenticate" | "provider.gloo.diagnostic" | "provider.gloo.generate",
  url: string,
  init: RequestInit
) {
  return measureServerOperation(operation, () => fetch(url, {
    ...init,
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  }));
}

function extractGlooTextContent(payload: GlooChatResponse): string | undefined {
  const content = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;

  const text = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const candidate = part as { text?: unknown; content?: unknown };
      if (typeof candidate.text === "string") return candidate.text;
      if (typeof candidate.content === "string") return candidate.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || undefined;
}

function createGlooDraftRequestBody(input: GlooDiscussionDraftInput, selection: GlooModelSelection) {
  return JSON.stringify({
    model: selection.model,
    temperature: 0.3,
    max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content:
          "You help student ministry leaders prepare careful, Scripture-grounded discussion prompts. Use retrieved student-visible ministry context as background, not as an authority to quote. Use internal grounding only for theological posture, ministry voice, question shape, culture, and artistic texture. Never quote, summarize, cite, reveal, or assign internal grounding material to students. Return only JSON with keys discussionPrompt, scriptureReference, safetyLabel, safetyNotes, confidence, topicTags, escalationRecommended, escalationReason. scriptureReference must be one concise Bible reference that directly grounds the response; retain a user-supplied reference when present. The safetyLabel must be one of safe, needs_leader_care, pastoral_escalation. confidence must be a number from 0 to 1. topicTags must be short lowercase strings. Do not claim pastoral authority, do not give crisis counseling, and do not include full Bible text."
      },
      {
        role: "user",
        content:
          `Student question: ${input.question}\n` +
          `Scripture reference: ${input.scriptureReference || "not selected"}\n` +
          `Quiet story-lens hint: ${input.metanarrativeMovement ?? "infer from the question and passage"}\n\n` +
          `Student-visible ministry context:\n${input.retrievedContext || "No retrieved student-visible context available."}\n\n` +
          `Internal grounding for posture only:\n${input.internalGroundingContext || "No internal grounding context available."}\n\n` +
          `Model routing: ${selection.reason}${selection.escalationReason ? ` Escalation reason: ${selection.escalationReason}` : ""}\n\n` +
          "Draft one Socratic small-group discussion prompt for leader review. Keep it humble, conversational, and grounded in the reference without quoting the passage. Drive toward engagement, attention, and relationship with Jesus and community rather than certainty, trivia, or content-farm answers."
      }
    ]
  });
}

function createGlooReadingPlanRequestBody(input: GlooReadingPlanDraftInput, selection: GlooModelSelection) {
  return JSON.stringify({
    model: selection.model,
    temperature: 0.3,
    max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content:
          "You help student ministry leaders draft Scripture reading plans for leader review. Return only JSON with keys title, audience, duration, primaryScripture, movement, summary, contextFocus, weeklyRhythm, discussionPrompts, guardrailNotes, prayerPrompt, safetyNotes. movement must be one of the whole-Bible metanarrative labels. Do not include full Bible text, do not publish anything, and keep the plan humble, student-readable, and leader-reviewed."
      },
      {
        role: "user",
        content:
          `Title: ${input.title || "Untitled reading plan"}\n` +
          `Audience: ${input.audience || "Student group"}\n` +
          `Duration: ${input.duration || "Leader-selected duration"}\n` +
          `Primary Scripture: ${input.primaryScripture || "Leader-selected passage"}\n` +
          `Context notes: ${input.contextNotes || "No context notes provided."}\n` +
          `Observation question: ${input.observationQuestion || "No observation question provided."}\n` +
          `Interpretation question: ${input.interpretationQuestion || "No interpretation question provided."}\n` +
          `Application question: ${input.applicationQuestion || "No application question provided."}\n` +
          `Discussion question: ${input.discussionQuestion || "No discussion question provided."}\n` +
          `Prayer prompt: ${input.prayerPrompt || "No prayer prompt provided."}\n` +
          `Guardrail notes: ${input.guardrailNotes || "No guardrail notes provided."}\n\n` +
          `Model routing: ${selection.reason}${selection.escalationReason ? ` Escalation reason: ${selection.escalationReason}` : ""}\n\n` +
          "Draft a concise day-by-day reading plan. weeklyRhythm should be an array of daily reading descriptions, not full Bible text. discussionPrompts and guardrailNotes should be arrays."
      }
    ]
  });
}

function needsProviderEscalation(draft: Extract<GlooDiscussionDraftResult, { ok: true }>) {
  return draft.confidence < 0.72 || draft.safetyLabel !== "safe" || Boolean(draft.escalationReason);
}

function resolveGlooChatUrls(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return [trimmed];

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "platform.ai.gloo.com") {
      return [`${parsed.origin}/ai/v2/chat/completions`];
    }
  } catch {
    // Invalid URLs are handled by fetch and logged through the provider failure path.
  }

  return [`${trimmed}/chat/completions`];
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
    parsed = JSON.parse(extractJsonObjectText(content)) as ParsedDraft;
  } catch {
    return undefined;
  }

  const discussionPrompt = typeof parsed.discussionPrompt === "string" ? parsed.discussionPrompt.trim() : "";
  const scriptureReference = normalizeText(parsed.scriptureReference, 160);
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
    ...(scriptureReference ? { scriptureReference } : {}),
    safetyLabel,
    safetyNotes: limitText(safetyNotes, 900)
  };
}

function parseReadingPlanContent(
  content: string,
  selection: GlooModelSelection,
  input: GlooReadingPlanDraftInput
): GlooReadingPlanDraftResult | undefined {
  let parsed: ParsedReadingPlanDraft;
  try {
    parsed = JSON.parse(extractJsonObjectText(content)) as ParsedReadingPlanDraft;
  } catch {
    return undefined;
  }

  const title = normalizeText(parsed.title, 140) || normalizeText(input.title, 140);
  const audience = normalizeText(parsed.audience, 120) || normalizeText(input.audience, 120);
  const duration = normalizeText(parsed.duration, 80) || normalizeText(input.duration, 80);
  const primaryScripture = normalizeText(parsed.primaryScripture, 160) || normalizeText(input.primaryScripture, 160);
  const movement = normalizeMovement(parsed.movement);
  const summary = normalizeText(parsed.summary, 600);
  const contextFocus = normalizeText(parsed.contextFocus, 700);
  const weeklyRhythm = normalizeStringArray(parsed.weeklyRhythm, 14);
  const discussionPrompts = normalizeStringArray(parsed.discussionPrompts, 8);
  const guardrailNotes = normalizeStringArray(parsed.guardrailNotes, 8);
  const prayerPrompt = normalizeText(parsed.prayerPrompt, 500);
  const safetyNotes = normalizeText(parsed.safetyNotes, 700);

  if (!title || !audience || !duration || !primaryScripture || !summary || !contextFocus || !weeklyRhythm.length || !discussionPrompts.length) {
    return undefined;
  }

  return {
    ok: true,
    provider: "gloo",
    model: selection.model,
    modelReason: limitText(selection.reason, 500),
    title,
    audience,
    duration,
    primaryScripture,
    movement,
    summary,
    contextFocus,
    weeklyRhythm,
    discussionPrompts,
    guardrailNotes,
    prayerPrompt,
    safetyNotes
  };
}

function extractJsonObjectText(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function normalizeSafetyLabel(value: unknown): "safe" | "needs_leader_care" | "pastoral_escalation" | undefined {
  if (value === "safe" || value === "needs_leader_care" || value === "pastoral_escalation") return value;
  return undefined;
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trim()}...` : trimmed;
}

function getPrimaryGlooModel(env: Partial<NodeJS.ProcessEnv>) {
  return normalizeGlooModelId(env.GLOO_AI_MODEL || env.GLOO_AI_STUDIO_MODEL);
}

function getGlooCredentials(env: Partial<NodeJS.ProcessEnv>): GlooCredentials {
  const clientId = env.GLOO_AI_CLIENT_ID?.trim() || "";
  const clientSecret = env.GLOO_AI_CLIENT_SECRET?.trim() || "";
  return {
    accessToken: env.GLOO_AI_STUDIO_API_KEY?.trim() || (!clientId ? clientSecret : ""),
    clientId,
    clientSecret,
    apiBaseUrl: env.GLOO_AI_STUDIO_API_BASE_URL?.trim() || env.GLOO_AI_BASE_URL?.trim() || GLOO_DEFAULT_API_BASE_URL
  };
}

function hasGlooCredentials(credentials: GlooCredentials) {
  return Boolean(credentials.accessToken || (credentials.clientId && credentials.clientSecret));
}

function normalizeGlooModelId(value: string | undefined) {
  const trimmed = value?.trim() || "";
  return GLOO_MODEL_ALIASES[trimmed.toLowerCase()] || trimmed;
}

async function resolveGlooAccessTokenSafely(credentials: GlooCredentials): Promise<
  | { ok: true; token: string }
  | { ok: false; result: Extract<GlooDiscussionDraftResult, { ok: false }> }
> {
  try {
    return { ok: true, token: await resolveGlooAccessToken(credentials) };
  } catch (error) {
    const failure = glooAuthenticationFailure(error);
    logGlooProviderFailure(failure);
    return { ok: false, result: { ok: false, code: "provider_error", message: failure.message } };
  }
}

async function resolveGlooAccessTokenForDiagnostic(credentials: GlooCredentials): Promise<
  | { ok: true; token: string }
  | { ok: false; attempt: GlooDiagnosticAttempt }
> {
  try {
    return { ok: true, token: await resolveGlooAccessToken(credentials) };
  } catch (error) {
    const failure = glooAuthenticationFailure(error);
    return {
      ok: false,
      attempt: {
        url: GLOO_TOKEN_URL,
        ok: false,
        status: failure.status,
        statusText: failure.statusText,
        message: failure.message
      }
    };
  }
}

async function resolveGlooAccessToken(credentials: GlooCredentials) {
  if (credentials.accessToken) return credentials.accessToken;
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new GlooAuthenticationError("Gloo AI Studio client credentials are incomplete.");
  }

  const now = Date.now();
  if (
    cachedGlooAccessToken?.clientId === credentials.clientId &&
    cachedGlooAccessToken.expiresAtMs - GLOO_TOKEN_REFRESH_BUFFER_MS > now
  ) {
    return cachedGlooAccessToken.accessToken;
  }

  if (pendingGlooAccessToken?.clientId === credentials.clientId) {
    return pendingGlooAccessToken.promise;
  }

  const promise = requestGlooAccessToken(credentials);
  pendingGlooAccessToken = { clientId: credentials.clientId, promise };
  try {
    return await promise;
  } finally {
    if (pendingGlooAccessToken?.promise === promise) pendingGlooAccessToken = undefined;
  }
}

async function requestGlooAccessToken(credentials: GlooCredentials) {
  const response = await timedGlooFetch("provider.gloo.authenticate", GLOO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=api%2Faccess"
  });

  if (!response.ok) {
    throw new GlooAuthenticationError(
      response.status === 401 || response.status === 403
        ? "Gloo AI Studio rejected the configured client credentials."
        : `Gloo AI Studio token exchange returned HTTP ${response.status}.`,
      response.status,
      response.statusText
    );
  }

  let payload: GlooAccessTokenPayload;
  try {
    payload = (await response.json()) as GlooAccessTokenPayload;
  } catch {
    throw new GlooAuthenticationError("Gloo AI Studio returned an unreadable access token response.");
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const expiresIn = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 3600;
  if (!accessToken) throw new GlooAuthenticationError("Gloo AI Studio did not return an access token.");

  cachedGlooAccessToken = {
    clientId: credentials.clientId,
    accessToken,
    expiresAtMs: Date.now() + expiresIn * 1000
  };
  return accessToken;
}

class GlooAuthenticationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly statusText?: string
  ) {
    super(message);
    this.name = "GlooAuthenticationError";
  }
}

function glooAuthenticationFailure(error: unknown): GlooProviderFailure {
  if (error instanceof GlooAuthenticationError) {
    return { message: error.message, status: error.status, statusText: error.statusText, url: GLOO_TOKEN_URL };
  }
  return {
    message: error instanceof Error ? limitText(error.message, 240) : "Gloo AI Studio token exchange failed.",
    url: GLOO_TOKEN_URL
  };
}

export function resetGlooAccessTokenCacheForTests() {
  cachedGlooAccessToken = undefined;
  pendingGlooAccessToken = undefined;
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

function normalizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeMovement(value: unknown): MetanarrativeMovement {
  const allowed: MetanarrativeMovement[] = [
    "Creation",
    "Fall",
    "Covenant",
    "Exodus / Deliverance",
    "Law / Formation",
    "Land / Kingdom",
    "Wisdom",
    "Prophets / Exile",
    "Return / Waiting",
    "Jesus / Kingdom Fulfilled",
    "Church / Spirit",
    "New Creation"
  ];
  return allowed.find((movement) => movement === value) ?? "Jesus / Kingdom Fulfilled";
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
