import { createGeminiProvider } from "@/lib/emma/providers/gemini-provider";
import { DEFAULT_GEMINI_MODEL } from "@/lib/emma/providers/registry";
import { createOpenAIEmmaProvider, DEFAULT_OPENAI_EMMA_MODEL } from "@/lib/emma/providers/openai-provider";
import { normalizeProviderError } from "@/lib/emma/providers/errors";
import type { EmmaProvider, EmmaProviderId } from "@/lib/emma/providers/types";
import {
  generateGlooDiscussionDraft,
  generateGlooReadingPlanDraft,
  isGlooConfigured,
  type GlooDiscussionDraftInput,
  type GlooModelTier,
  type GlooReadingPlanDraftInput
} from "@/lib/scripture/gloo";
import type { MetanarrativeMovement, StudentDiscussionPrompt } from "@/lib/scripture/types";

export type MeridianAiProviderId = "gloo" | "gemini" | "openai";

export type MeridianAiReadiness = {
  configured: boolean;
  gloo: boolean;
  gemini: boolean;
  openai: boolean;
  fallbackProviders: Array<"gemini" | "openai">;
  primaryProvider: MeridianAiProviderId | "";
};

export type MeridianDiscussionDraftResult =
  | {
      ok: true;
      provider: MeridianAiProviderId;
      model: string;
      modelTier: GlooModelTier;
      modelReason: string;
      escalationReason: string;
      topicTags: string[];
      confidence: number;
      discussionPrompt: string;
      safetyLabel: Exclude<StudentDiscussionPrompt["safetyLabel"], "unreviewed">;
      safetyNotes: string;
    }
  | {
      ok: false;
      code: "not_configured" | "provider_error";
      message: string;
      attemptedProviders: MeridianAiProviderId[];
    };

export type MeridianReadingPlanDraftInput = {
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

export type MeridianReadingPlanDraftResult =
  | {
      ok: true;
      provider: MeridianAiProviderId;
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
      attemptedProviders: MeridianAiProviderId[];
    };

type FallbackProviderConfig = {
  id: "gemini" | "openai";
  model: string;
  provider: EmmaProvider;
};

type ParsedDiscussionDraft = {
  discussionPrompt?: unknown;
  safetyLabel?: unknown;
  safetyNotes?: unknown;
  confidence?: unknown;
  topicTags?: unknown;
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

export function getMeridianAiReadiness(env: Partial<NodeJS.ProcessEnv> = process.env): MeridianAiReadiness {
  const gloo = isGlooConfigured(env);
  const gemini = Boolean(env.GEMINI_API_KEY?.trim());
  const openai = Boolean(env.OPENAI_API_KEY?.trim());
  const fallbackProviders = getFallbackProviderOrder(env).filter((provider) => (provider === "gemini" ? gemini : openai));
  const primaryProvider = gloo ? "gloo" : fallbackProviders[0] ?? "";

  return {
    configured: gloo || fallbackProviders.length > 0,
    gloo,
    gemini,
    openai,
    fallbackProviders,
    primaryProvider
  };
}

export async function generateMeridianDiscussionDraft(input: GlooDiscussionDraftInput): Promise<MeridianDiscussionDraftResult> {
  const readiness = getMeridianAiReadiness();
  const attemptedProviders: MeridianAiProviderId[] = [];
  let lastFailure = "";

  if (readiness.gloo) {
    attemptedProviders.push("gloo");
    const glooDraft = await generateGlooDiscussionDraft(input);
    if (glooDraft.ok) return glooDraft;
    lastFailure = glooDraft.message;
  }

  for (const fallback of createFallbackProviders()) {
    attemptedProviders.push(fallback.id);
    try {
      const result = await fallback.provider.generate({
        model: fallback.model,
        systemPrompt: discussionSystemPrompt(),
        userPrompt: discussionUserPrompt(input, fallback.id, lastFailure),
        temperature: 0.25,
        maxOutputTokens: 900,
        timeoutMs: 15_000
      });
      const parsed = parseDiscussionOutput(result.output, fallback.id, result.model || fallback.model);
      if (parsed) return parsed;
      lastFailure = `${fallback.id} returned an unusable discussion draft.`;
    } catch (error) {
      const providerError = normalizeProviderError(error);
      lastFailure = `${fallback.id} fallback failed with ${providerError.code}.`;
      logFallbackFailure("discussion", fallback.id, providerError.code, providerError.httpStatus);
    }
  }

  return {
    ok: false,
    code: readiness.configured ? "provider_error" : "not_configured",
    message: readiness.configured
      ? lastFailure || "Meridian AI providers did not return a usable discussion draft."
      : "Meridian AI drafting is not configured. Configure Gloo AI Studio first, with Gemini or OpenAI as fallback.",
    attemptedProviders
  };
}

export async function generateMeridianReadingPlanDraft(input: MeridianReadingPlanDraftInput): Promise<MeridianReadingPlanDraftResult> {
  const readiness = getMeridianAiReadiness();
  const attemptedProviders: MeridianAiProviderId[] = [];
  let lastFailure = "";

  if (readiness.gloo) {
    attemptedProviders.push("gloo");
    const glooDraft = await generateGlooReadingPlanDraft(toGlooReadingPlanInput(input));
    if (glooDraft.ok) return glooDraft;
    lastFailure = glooDraft.message;
  }

  for (const fallback of createFallbackProviders()) {
    attemptedProviders.push(fallback.id);
    try {
      const result = await fallback.provider.generate({
        model: fallback.model,
        systemPrompt: readingPlanSystemPrompt(),
        userPrompt: readingPlanUserPrompt(input, fallback.id, lastFailure),
        temperature: 0.25,
        maxOutputTokens: 1400,
        timeoutMs: 18_000
      });
      const parsed = parseReadingPlanOutput(result.output, fallback.id, result.model || fallback.model, input);
      if (parsed) return parsed;
      lastFailure = `${fallback.id} returned an unusable reading-plan draft.`;
    } catch (error) {
      const providerError = normalizeProviderError(error);
      lastFailure = `${fallback.id} fallback failed with ${providerError.code}.`;
      logFallbackFailure("reading_plan", fallback.id, providerError.code, providerError.httpStatus);
    }
  }

  return {
    ok: false,
    code: readiness.configured ? "provider_error" : "not_configured",
    message: readiness.configured
      ? lastFailure || "Meridian AI providers did not return a usable reading-plan draft."
      : "Meridian AI drafting is not configured. Configure Gloo AI Studio first, with Gemini or OpenAI as fallback.",
    attemptedProviders
  };
}

function createFallbackProviders(env: Partial<NodeJS.ProcessEnv> = process.env): FallbackProviderConfig[] {
  return getFallbackProviderOrder(env)
    .map((id): FallbackProviderConfig | undefined => {
      if (id === "gemini" && env.GEMINI_API_KEY?.trim()) {
        return {
          id,
          model: env.MERIDIAN_GEMINI_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
          provider: createGeminiProvider()
        };
      }

      if (id === "openai" && env.OPENAI_API_KEY?.trim()) {
        return {
          id,
          model: env.MERIDIAN_OPENAI_MODEL?.trim() || env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_EMMA_MODEL,
          provider: createOpenAIEmmaProvider()
        };
      }

      return undefined;
    })
    .filter((provider): provider is FallbackProviderConfig => Boolean(provider));
}

function getFallbackProviderOrder(env: Partial<NodeJS.ProcessEnv>): Array<"gemini" | "openai"> {
  const configured = env.MERIDIAN_FALLBACK_PROVIDER_ORDER?.split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is "gemini" | "openai" => provider === "gemini" || provider === "openai");

  return configured?.length ? Array.from(new Set(configured)) : ["gemini", "openai"];
}

function parseDiscussionOutput(output: unknown, provider: EmmaProviderId, model: string): Extract<MeridianDiscussionDraftResult, { ok: true }> | undefined {
  if (provider !== "gemini" && provider !== "openai") return undefined;
  if (!output || typeof output !== "object") return undefined;
  const parsed = output as ParsedDiscussionDraft;
  const discussionPrompt = textValue(parsed.discussionPrompt, 1800);
  const safetyLabel = normalizeSafetyLabel(parsed.safetyLabel);
  const safetyNotes = textValue(parsed.safetyNotes, 900);
  if (!discussionPrompt || !safetyLabel || !safetyNotes) return undefined;

  return {
    ok: true,
    provider,
    model,
    modelTier: "default",
    modelReason: `${provider} fallback generated the draft after Gloo was unavailable or returned an unusable response.`,
    escalationReason: textValue(parsed.escalationReason, 500),
    topicTags: normalizeStringArray(parsed.topicTags, 8),
    confidence: normalizeConfidence(parsed.confidence),
    discussionPrompt,
    safetyLabel,
    safetyNotes
  };
}

function parseReadingPlanOutput(
  output: unknown,
  provider: EmmaProviderId,
  model: string,
  input: MeridianReadingPlanDraftInput
): Extract<MeridianReadingPlanDraftResult, { ok: true }> | undefined {
  if (provider !== "gemini" && provider !== "openai") return undefined;
  if (!output || typeof output !== "object") return undefined;
  const parsed = output as ParsedReadingPlanDraft;
  const title = textValue(parsed.title, 140) || input.title.trim();
  const audience = textValue(parsed.audience, 120) || input.audience.trim();
  const duration = textValue(parsed.duration, 80) || input.duration.trim();
  const primaryScripture = textValue(parsed.primaryScripture, 160) || input.primaryScripture.trim();
  const movement = normalizeMovement(parsed.movement);
  const summary = textValue(parsed.summary, 600);
  const contextFocus = textValue(parsed.contextFocus, 700);
  const weeklyRhythm = normalizeStringArray(parsed.weeklyRhythm, 14);
  const discussionPrompts = normalizeStringArray(parsed.discussionPrompts, 8);
  const guardrailNotes = normalizeStringArray(parsed.guardrailNotes, 8);
  const prayerPrompt = textValue(parsed.prayerPrompt, 500);
  const safetyNotes = textValue(parsed.safetyNotes, 700);

  if (!title || !audience || !duration || !primaryScripture || !summary || !contextFocus || weeklyRhythm.length < 1 || discussionPrompts.length < 1) {
    return undefined;
  }

  return {
    ok: true,
    provider,
    model,
    modelReason: `${provider} fallback generated the reading-plan draft after Gloo was unavailable or returned an unusable response.`,
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

function discussionSystemPrompt() {
  return "You help student ministry leaders prepare careful, Scripture-grounded discussion prompts. Return only JSON with keys discussionPrompt, safetyLabel, safetyNotes, confidence, topicTags, escalationReason. safetyLabel must be safe, needs_leader_care, or pastoral_escalation. Keep the draft leader-reviewed, humble, and usable with real students. Do not include full Bible text or crisis counseling.";
}

function discussionUserPrompt(input: GlooDiscussionDraftInput, provider: "gemini" | "openai", previousFailure: string) {
  return (
    `Fallback provider: ${provider}\n` +
    `Previous Gloo result: ${previousFailure || "Gloo was not configured or was skipped."}\n` +
    `Student question: ${input.question}\n` +
    `Scripture reference: ${input.scriptureReference || "not selected"}\n` +
    `Story-lens hint: ${input.metanarrativeMovement ?? "infer from the question and passage"}\n\n` +
    `Student-visible ministry context:\n${input.retrievedContext || "No retrieved context available."}\n\n` +
    `Internal grounding for posture only. Do not quote, summarize, cite, reveal, or assign this material to students:\n${input.internalGroundingContext || "No internal grounding context available."}\n\n` +
    "Draft one Socratic small-group discussion prompt for leader review."
  );
}

function readingPlanSystemPrompt() {
  return "You help student ministry leaders draft Scripture reading plans for leader review. Return only JSON with keys title, audience, duration, primaryScripture, movement, summary, contextFocus, weeklyRhythm, discussionPrompts, guardrailNotes, prayerPrompt, safetyNotes. Keep it Scripture-grounded, student-readable, and clear that leaders review before sharing. Do not include full Bible text.";
}

function readingPlanUserPrompt(input: MeridianReadingPlanDraftInput, provider: "gemini" | "openai", previousFailure: string) {
  return (
    `Fallback provider: ${provider}\n` +
    `Previous Gloo result: ${previousFailure || "Gloo was not configured or was skipped."}\n` +
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
    "Draft a concise reading plan with day-by-day weeklyRhythm entries and leader-review guardrails."
  );
}

function toGlooReadingPlanInput(input: MeridianReadingPlanDraftInput): GlooReadingPlanDraftInput {
  return {
    title: input.title,
    audience: input.audience,
    duration: input.duration,
    primaryScripture: input.primaryScripture,
    contextNotes: input.contextNotes,
    observationQuestion: input.observationQuestion,
    interpretationQuestion: input.interpretationQuestion,
    applicationQuestion: input.applicationQuestion,
    discussionQuestion: input.discussionQuestion,
    prayerPrompt: input.prayerPrompt,
    guardrailNotes: input.guardrailNotes
  };
}

function textValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trim()}...` : trimmed;
}

function normalizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.68;
  return Math.min(1, Math.max(0, value));
}

function normalizeSafetyLabel(value: unknown): Exclude<StudentDiscussionPrompt["safetyLabel"], "unreviewed"> | undefined {
  if (value === "safe" || value === "needs_leader_care" || value === "pastoral_escalation") return value;
  return undefined;
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

function logFallbackFailure(kind: "discussion" | "reading_plan", provider: "gemini" | "openai", code: string, httpStatus: number | null) {
  console.warn("[meridian-ai] fallback provider failure", {
    timestamp: new Date().toISOString(),
    kind,
    provider,
    code,
    httpStatus
  });
}
