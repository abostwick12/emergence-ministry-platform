import type { MetanarrativeMovement } from "@/lib/scripture/types";
import { measureServerOperation } from "@/lib/performance/timing";

const PROVIDER_TIMEOUT_MS = 12_000;

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
  const { apiKey, apiBaseUrl } = getGlooCredentials(process.env);
  const selection = selectGlooModelPolicy(input);

  if (!apiKey || !apiBaseUrl || !selection) {
    return {
      ok: false,
      code: "not_configured",
      message: "AI drafting is offline. Configure Gloo AI Studio before launch; knowledge-guided fallback remains available only for leader review."
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

export async function generateGlooReadingPlanDraft(input: GlooReadingPlanDraftInput): Promise<GlooReadingPlanDraftResult> {
  const { apiKey, apiBaseUrl } = getGlooCredentials(process.env);
  const selection = selectGlooModelPolicy({
    question: `${input.title}\n${input.contextNotes}\n${input.guardrailNotes}`,
    scriptureReference: input.primaryScripture
  });

  if (!apiKey || !apiBaseUrl || !selection) {
    return {
      ok: false,
      code: "not_configured",
      message: "AI reading-plan drafting is offline. Configure Gloo AI Studio before launch."
    };
  }

  const body = createGlooReadingPlanRequestBody(input, selection);
  let lastFailure: GlooProviderFailure | undefined;
  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    let response: Response;
    try {
      response = await timedGlooFetch("provider.gloo.generate", url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
      if (response.status === 404 && shouldTryNextGlooUrl(apiBaseUrl)) continue;
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
  const { apiKey, apiBaseUrl } = getGlooCredentials(env);
  const primaryModel = getPrimaryGlooModel(env);
  const selection = selectGlooModelPolicy(input, env);
  const base: Omit<GlooDiagnosticResult, "ok" | "configured" | "message" | "attempts"> = {
    credentialsConfigured: Boolean(apiKey),
    baseUrlConfigured: Boolean(apiBaseUrl),
    primaryModelConfigured: Boolean(primaryModel),
    primaryModel,
    escalationModel: env.GLOO_AI_ESCALATION_MODEL?.trim() ?? "",
    longContextModel: env.GLOO_AI_LONG_CONTEXT_MODEL?.trim() ?? "",
    selectedModel: selection?.model ?? "",
    selectedTier: selection?.tier ?? ""
  };

  if (!apiKey || !apiBaseUrl || !selection) {
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

  for (const url of resolveGlooChatUrls(apiBaseUrl)) {
    try {
      const response = await timedGlooFetch("provider.gloo.diagnostic", url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        if (response.status === 404 && shouldTryNextGlooUrl(apiBaseUrl)) continue;
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
  apiKey: string,
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
          Authorization: `Bearer ${apiKey}`,
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
      if (response.status === 404 && shouldTryNextGlooUrl(apiBaseUrl)) continue;
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

function timedGlooFetch(operation: "provider.gloo.diagnostic" | "provider.gloo.generate", url: string, init: RequestInit) {
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
    messages: [
      {
        role: "system",
        content:
          "You help student ministry leaders prepare careful, Scripture-grounded discussion prompts. Use retrieved student-visible ministry context as background, not as an authority to quote. Use internal grounding only for theological posture, ministry voice, question shape, culture, and artistic texture. Never quote, summarize, cite, reveal, or assign internal grounding material to students. Return only JSON with keys discussionPrompt, safetyLabel, safetyNotes, confidence, topicTags, escalationRecommended, escalationReason. The safetyLabel must be one of safe, needs_leader_care, pastoral_escalation. confidence must be a number from 0 to 1. topicTags must be short lowercase strings. Do not claim pastoral authority, do not give crisis counseling, and do not include full Bible text."
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
    parsed = JSON.parse(extractJsonObjectText(content)) as ParsedDraft;
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
