import { createGeminiProvider } from "@/lib/emma/providers/gemini-provider";
import { createGlooEmmaProvider, readGlooEmmaConfig } from "@/lib/emma/providers/gloo-provider";
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
import {
  buildMeridianProvenance,
  buildMeridianSynthesisBrief,
  formatMeridianSynthesisBriefForAi,
  validateMeridianArtifact,
  type MeridianGenerationProvenance,
  type MeridianSynthesisBrief,
  type MeridianValidationResult
} from "@/lib/scripture/meridian-synthesis";
import type { MetanarrativeMovement, StudentDiscussionPrompt } from "@/lib/scripture/types";
import type { StudentDiscussionKnowledgeContext } from "@/lib/scripture/types";
import { buildStudentJourneyFormationContentFromAi } from "@/lib/scripture/student-journey-content";
import type { StudentJourneyFormationContent } from "@/lib/scripture/student-journey-draft";

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
      journeyContent?: StudentJourneyFormationContent;
      scriptureReference?: string;
      safetyLabel: Exclude<StudentDiscussionPrompt["safetyLabel"], "unreviewed">;
      safetyNotes: string;
      provenance: MeridianGenerationProvenance;
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
      provenance: MeridianGenerationProvenance;
    }
  | {
      ok: false;
      code: "not_configured" | "provider_error";
      message: string;
      attemptedProviders: MeridianAiProviderId[];
    };

export type SermonPrepResourceKind = "outline" | "leader_guide" | "slide_plan" | "small_group_questions";

export type MeridianSermonPrepResourceInput = {
  kind: SermonPrepResourceKind;
  title: string;
  passage: string;
  bigIdea: string;
  body: string;
  knowledgeMatches?: StudentDiscussionKnowledgeContext[];
  allowLiveProviders?: boolean;
};

export type MeridianSermonPrepResourceResult = {
  ok: true;
  provider: MeridianAiProviderId | "deterministic";
  model: string;
  kind: SermonPrepResourceKind;
  title: string;
  summary: string;
  contentMarkdown: string;
  estimatedMinutes: number;
  sources: string[];
  warnings: string[];
  provenance: MeridianGenerationProvenance;
};

export type MeridianDiscussionDraftInput = GlooDiscussionDraftInput & {
  synthesisBrief?: MeridianSynthesisBrief;
};

type FallbackProviderConfig = {
  id: "gemini" | "openai";
  model: string;
  provider: EmmaProvider;
};

type ParsedDiscussionDraft = {
  discussionPrompt?: unknown;
  journeyDraft?: unknown;
  scriptureReference?: unknown;
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

type ParsedSermonPrepResource = {
  title?: unknown;
  summary?: unknown;
  contentMarkdown?: unknown;
  estimatedMinutes?: unknown;
  sources?: unknown;
  warnings?: unknown;
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

export async function generateMeridianDiscussionDraft(input: MeridianDiscussionDraftInput): Promise<MeridianDiscussionDraftResult> {
  const readiness = getMeridianAiReadiness();
  const attemptedProviders: MeridianAiProviderId[] = [];
  let lastFailure = "";
  const synthesisBrief = input.synthesisBrief ?? buildMeridianSynthesisBrief({
    taskType: "discussion_prompt",
    request: input.question,
    audience: "students in a leader-reviewed small group",
    scriptureReference: input.scriptureReference,
    metanarrativeMovement: input.metanarrativeMovement,
    internalGroundingContext: input.internalGroundingContext
  });
  const providerInput = discussionInputWithSynthesis(input, synthesisBrief);

  if (readiness.gloo) {
    attemptedProviders.push("gloo");
    const glooDraft = await generateGlooDiscussionDraft(providerInput);
    if (glooDraft.ok) {
      const validation = validateMeridianArtifact({
        taskType: "discussion_prompt",
        content: glooDraft.discussionPrompt
      });
      if (validation.ok) {
        return {
          ...glooDraft,
          provenance: buildMeridianProvenance({
            brief: synthesisBrief,
            provider: glooDraft.provider,
            model: glooDraft.model,
            validation
          })
        };
      }
      lastFailure = `Gloo returned a draft that failed validation: ${validation.reason}.`;
    } else {
      lastFailure = glooDraft.message;
    }
  }

  for (const fallback of createFallbackProviders()) {
    attemptedProviders.push(fallback.id);
    try {
      const result = await fallback.provider.generate({
        model: fallback.model,
        systemPrompt: discussionSystemPrompt(),
        userPrompt: discussionUserPrompt(providerInput, fallback.id, lastFailure, synthesisBrief),
        temperature: 0.25,
        maxOutputTokens: input.journeyContext ? 2_600 : 900,
        timeoutMs: 15_000
      });
      const parsed = parseDiscussionOutput(result.output, fallback.id, result.model || fallback.model, synthesisBrief, providerInput);
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
  const synthesisBrief = buildMeridianSynthesisBrief({
    taskType: "reading_plan",
    request: `${input.title} ${input.contextNotes} ${input.observationQuestion} ${input.interpretationQuestion}`,
    audience: input.audience,
    scriptureReference: input.primaryScripture
  });
  const providerInput: MeridianReadingPlanDraftInput = {
    ...input,
    contextNotes: [
      "Meridian Synthesis Brief:",
      formatMeridianSynthesisBriefForAi(synthesisBrief),
      "",
      "Leader-entered context notes:",
      input.contextNotes || "No additional notes provided."
    ].join("\n")
  };

  if (readiness.gloo) {
    attemptedProviders.push("gloo");
    const glooDraft = await generateGlooReadingPlanDraft(toGlooReadingPlanInput(providerInput));
    if (glooDraft.ok) {
      const validation = validateMeridianArtifact({
        taskType: "reading_plan",
        title: glooDraft.title,
        summary: glooDraft.summary,
        content: [glooDraft.contextFocus, ...glooDraft.weeklyRhythm, ...glooDraft.discussionPrompts].join("\n")
      });
      if (validation.ok) {
        return {
          ...glooDraft,
          provenance: buildMeridianProvenance({
            brief: synthesisBrief,
            provider: glooDraft.provider,
            model: glooDraft.model,
            validation
          })
        };
      }
      lastFailure = `Gloo returned a reading plan that failed validation: ${validation.reason}.`;
    } else {
      lastFailure = glooDraft.message;
    }
  }

  for (const fallback of createFallbackProviders()) {
    attemptedProviders.push(fallback.id);
    try {
      const result = await fallback.provider.generate({
        model: fallback.model,
        systemPrompt: readingPlanSystemPrompt(),
        userPrompt: readingPlanUserPrompt(providerInput, fallback.id, lastFailure),
        temperature: 0.25,
        maxOutputTokens: 1400,
        timeoutMs: 18_000
      });
      const parsed = parseReadingPlanOutput(result.output, fallback.id, result.model || fallback.model, input, synthesisBrief);
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

export async function generateMeridianSermonPrepResource(input: MeridianSermonPrepResourceInput): Promise<MeridianSermonPrepResourceResult> {
  const configuredProviders: Array<{ id: MeridianAiProviderId; model: string; provider: EmmaProvider }> = [];
  if (input.allowLiveProviders !== false) {
    const glooConfig = readGlooEmmaConfig();
    if (glooConfig) {
      configuredProviders.push({
        id: "gloo",
        model: glooConfig.model,
        provider: createGlooEmmaProvider({ config: glooConfig })
      });
    }
    configuredProviders.push(...createFallbackProviders().filter((provider) => provider.id === "gemini"));
  }

  const synthesisBrief = buildMeridianSynthesisBrief({
    taskType: input.kind,
    request: `${input.title} ${input.passage} ${input.bigIdea}`,
    audience: input.kind === "small_group_questions" ? "teenagers in a small group" : "volunteer small-group leaders",
    scriptureReference: input.passage,
    knowledgeMatches: input.knowledgeMatches,
    sermon: {
      title: input.title,
      passage: input.passage,
      bigIdea: input.bigIdea,
      excerpt: input.body.slice(0, 3200)
    }
  });
  const warnings: string[] = [];
  let repairAttemptUsed = false;
  for (const candidate of configuredProviders) {
    const attempts = repairAttemptUsed ? [1] : [1, 2];
    for (const attempt of attempts) {
      if (attempt === 2) repairAttemptUsed = true;
      try {
        const result = await candidate.provider.generate({
          model: candidate.model,
          systemPrompt: sermonPrepSystemPrompt(input.kind),
          userPrompt: sermonPrepUserPrompt(input, candidate.id, synthesisBrief, attempt === 1 ? "" : warnings.at(-1) ?? ""),
          temperature: attempt === 1 ? 0.28 : 0.18,
          maxOutputTokens: 1900,
          timeoutMs: 20_000
        });
        const parsed = parseSermonPrepResourceOutput(result.output, candidate.id, result.model || candidate.model, input, synthesisBrief);
        if (parsed) return parsed;
        warnings.push(`${candidate.id} returned an unusable sermon-prep resource on attempt ${attempt}.`);
      } catch (error) {
        const providerError = normalizeProviderError(error);
        warnings.push(`${candidate.id} failed safely with ${providerError.code} on attempt ${attempt}.`);
        logFallbackFailure("sermon_prep", candidate.id, providerError.code, providerError.httpStatus);
      }
    }
  }

  return deterministicSermonPrepResource(input, warnings.length ? warnings : ["No live Meridian AI provider was configured."], synthesisBrief);
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

function parseDiscussionOutput(
  output: unknown,
  provider: EmmaProviderId,
  model: string,
  synthesisBrief: MeridianSynthesisBrief,
  input: MeridianDiscussionDraftInput
): Extract<MeridianDiscussionDraftResult, { ok: true }> | undefined {
  if (provider !== "gemini" && provider !== "openai") return undefined;
  if (!output || typeof output !== "object") return undefined;
  const parsed = output as ParsedDiscussionDraft;
  const discussionPrompt = textValue(parsed.discussionPrompt, 1800);
  const scriptureReference = textValue(parsed.scriptureReference, 160);
  const safetyLabel = normalizeSafetyLabel(parsed.safetyLabel);
  const safetyNotes = textValue(parsed.safetyNotes, 900);
  if (!discussionPrompt || !safetyLabel || !safetyNotes) return undefined;
  const journeyContent = input.journeyContext
    ? buildStudentJourneyFormationContentFromAi({
        value: parsed.journeyDraft,
        provider,
        model,
        sources: input.journeyContext.sources
      })
    : undefined;
  if (input.journeyContext && !journeyContent) return undefined;
  if (input.journeyContext && normalizeReferenceKey(scriptureReference) !== normalizeReferenceKey(input.journeyContext.selection.primaryReference)) return undefined;
  const validation = validateMeridianArtifact({ taskType: "discussion_prompt", content: discussionPrompt });
  if (!validation.ok) return undefined;

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
    ...(journeyContent ? { journeyContent } : {}),
    ...(scriptureReference ? { scriptureReference } : {}),
    safetyLabel,
    safetyNotes,
    provenance: buildMeridianProvenance({
      brief: synthesisBrief,
      provider,
      model,
      validation
    })
  };
}

function parseReadingPlanOutput(
  output: unknown,
  provider: EmmaProviderId,
  model: string,
  input: MeridianReadingPlanDraftInput,
  synthesisBrief: MeridianSynthesisBrief
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
  const validation = validateMeridianArtifact({
    taskType: "reading_plan",
    title,
    summary,
    content: [contextFocus, ...weeklyRhythm, ...discussionPrompts].join("\n")
  });
  if (!validation.ok) return undefined;

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
    safetyNotes,
    provenance: buildMeridianProvenance({
      brief: synthesisBrief,
      provider,
      model,
      validation
    })
  };
}

function discussionSystemPrompt() {
  return "You help student ministry leaders prepare careful, Scripture-grounded discussion prompts and Journey Journal drafts. Return only JSON with keys discussionPrompt, journeyDraft, scriptureReference, safetyLabel, safetyNotes, confidence, topicTags, escalationReason. When a locked Journey Journal source packet is supplied, journeyDraft must include missingSourceFields; receive.historicalBackground; explore.repeatedPhrase, workedExample, and wholeStoryBridge; practice.slowReadingPrayer and responseStarter; walk.exampleActions; and see.biblicalStandardReference plus fruitToWatch. Every prose value and action must be an object with text and sourceIds drawn only from the supplied source IDs. Supply 2-3 concrete actions and set biblicalStandardReference to Galatians 5:22-23. If support is absent, leave the text empty and list the dotted field path in missingSourceFields. scriptureReference must be one concise Bible reference that directly grounds the response; retain the locked or user-supplied reference. safetyLabel must be safe, needs_leader_care, or pastoral_escalation. Keep every draft leader-reviewed, humble, and usable with real students. Do not include full Bible text, invent background claims, or provide crisis counseling.";
}

function normalizeReferenceKey(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, "").trim();
}

function discussionUserPrompt(
  input: MeridianDiscussionDraftInput,
  provider: "gemini" | "openai",
  previousFailure: string,
  synthesisBrief: MeridianSynthesisBrief
) {
  return (
    `Fallback provider: ${provider}\n` +
    `Previous Gloo result: ${previousFailure || "Gloo was not configured or was skipped."}\n` +
    `Student question: ${input.question}\n` +
    `Scripture reference: ${input.scriptureReference || "not selected"}\n` +
    `Story-lens hint: ${input.metanarrativeMovement ?? "infer from the question and passage"}\n\n` +
    `Meridian Synthesis Brief:\n${formatMeridianSynthesisBriefForAi(synthesisBrief)}\n\n` +
    (input.journeyContext
      ? `Locked Journey Journal passage: ${input.journeyContext.selection.primaryReference}\nWhy this passage: ${input.journeyContext.selection.whyThisPassage}\nDo not substitute another passage.\n\nJourney source packet:\n${input.journeyContext.sourceContext}\n\n`
      : "No Journey Journal source packet was supplied; omit journeyDraft.\n\n") +
    "Draft one Socratic small-group discussion prompt for leader review. When a Journey source packet is present, write substantive middle-school-ready content for every supported stage and cite the supplied source IDs in each field. Synthesize the brief naturally; do not expose internal documents or sources."
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

function parseSermonPrepResourceOutput(
  output: unknown,
  provider: MeridianAiProviderId,
  model: string,
  input: MeridianSermonPrepResourceInput,
  synthesisBrief: MeridianSynthesisBrief
): MeridianSermonPrepResourceResult | undefined {
  if (!output || typeof output !== "object") return undefined;
  const parsed = output as ParsedSermonPrepResource;
  const title = textValue(parsed.title, 140) || defaultSermonResourceTitle(input);
  const summary = textValue(parsed.summary, 500);
  const contentMarkdown = textValue(parsed.contentMarkdown, 7000);
  if (!summary || !contentMarkdown) return undefined;
  const validation = validateMeridianArtifact({
    taskType: input.kind,
    title,
    summary,
    content: contentMarkdown,
    requiredMarkers: requiredMarkersForKind(input.kind)
  });
  if (!validation.ok) return undefined;

  return {
    ok: true,
    provider,
    model,
    kind: input.kind,
    title,
    summary,
    contentMarkdown,
    estimatedMinutes: normalizeEstimatedMinutes(parsed.estimatedMinutes, input.kind),
    sources: normalizeStringArray(parsed.sources, 6).length ? normalizeStringArray(parsed.sources, 6) : sermonPrepSources(input, provider),
    warnings: normalizeStringArray(parsed.warnings, 4),
    provenance: buildMeridianProvenance({
      brief: synthesisBrief,
      provider,
      model,
      validation
    })
  };
}

function deterministicSermonPrepResource(
  input: MeridianSermonPrepResourceInput,
  warnings: string[],
  synthesisBrief: MeridianSynthesisBrief
): MeridianSermonPrepResourceResult {
  const title = defaultSermonResourceTitle(input);
  const passage = input.passage.trim() || "selected Scripture";
  const bigIdea = input.bigIdea.trim() || "Jesus forms leaders through humble love.";
  const bodyAnchor = input.body.trim().split(/\n+/).find(Boolean) ?? "Use the saved sermon draft as the starting point.";
  const contentByKind: Record<SermonPrepResourceKind, string> = {
    outline: [
      `# ${title}`,
      "",
      `Passage: ${passage}`,
      `Big Idea: ${bigIdea}`,
      "",
      "1. Start with what Jesus knows before he serves.",
      `   - Anchor: ${bodyAnchor}`,
      "   - Movement: identity in the Father frees Jesus to take the low place.",
      "2. Show the towel as the shape of kingdom authority.",
      "   - Contrast titles that protect status with love that moves toward need.",
      "3. Invite leaders and students to receive before they perform.",
      "   - Peter's resistance becomes the doorway into grace.",
      "4. Land one practice for the week.",
      "   - Name one person to serve with attention, humility, and no need for applause."
    ].join("\n"),
    leader_guide: [
      `# ${title}`,
      "",
      `Passage: ${passage}`,
      `Big Idea: ${bigIdea}`,
      "",
      "## Lesson Summary",
      `This lesson helps students see ${bigIdea} The passage should move the group from observing Jesus' action, to interpreting His kingdom authority, to practicing love from received grace.`,
      "",
      "## Likely Student Misunderstandings",
      "- Some students may hear humble service as pressure to perform for God instead of a response to Jesus' love.",
      "- Some may treat the towel as a generic kindness example and miss that Jesus serves from secure identity with the Father.",
      "- Some may resist being served because receiving grace can feel more vulnerable than doing religious work.",
      "",
      "## Leader Guidance",
      "- Read the passage slowly and notice what Jesus knows before he kneels.",
      "- Keep returning to receive before serve. Lead students away from self-improvement language and toward grace-shaped response.",
      "- Use concise follow-up questions. Do not rescue every silence too quickly.",
      "",
      "## Discussion Strategy",
      "1. Notice: What does Jesus know, and what does He do next?",
      "2. Interpret: What does this reveal about authority in Jesus' kingdom?",
      "3. Wrestle: Why might Peter resist receiving from Jesus?",
      "4. Practice: What is one towel-shaped act of love that fits this week?",
      "5. Community: Who can help you practice this without turning it into a performance?",
      "",
      "## Pastoral Considerations",
      "- Watch for students carrying shame, comparison, or pressure to prove usefulness.",
      "- If a student names a serious care concern, move toward trusted leader follow-up instead of public troubleshooting.",
      "",
      "## Practical Application",
      "Invite each student to name one concrete way to receive Jesus' love and one quiet way to serve from security, not applause."
    ].join("\n"),
    slide_plan: [
      `# ${title}`,
      "",
      "## Slide Plan",
      `1. Title slide: ${input.title || "Sermon Prep"}`,
      `2. Scripture slide: ${passage}`,
      `3. Big idea slide: ${bigIdea}`,
      "4. Contrast slide: Title vs. Towel",
      "5. Movement slide: Jesus knows, Jesus kneels, Jesus invites.",
      "6. Response slide: Receive, then serve.",
      "",
      "Keep slides simple and text-light. No Canva action was taken."
    ].join("\n"),
    small_group_questions: [
      `# ${title}`,
      "",
      `Passage: ${passage}`,
      "",
      "1. Notice: What does Jesus know about Himself before He washes the disciples' feet?",
      "2. Notice: What words or actions in the passage show that this is more than a random act of kindness?",
      "3. Interpret: What does the towel reveal about the kind of King Jesus is?",
      "4. Wrestle: Why do you think Peter pushes back against being served by Jesus?",
      "5. Wrestle: Where do people our age prefer a title, image, or reputation over humble love?",
      "6. Practice: What is one specific way to receive Jesus' grace before trying to serve this week?",
      "7. Practice: Who is one person you can serve quietly without needing credit?",
      "8. Community: How could this group help each other practice humble love without turning it into a performance?"
    ].join("\n")
  };
  const validation: MeridianValidationResult = validateMeridianArtifact({
    taskType: input.kind,
    title,
    summary: summaryForSermonKind(input.kind, bigIdea),
    content: contentByKind[input.kind],
    requiredMarkers: requiredMarkersForKind(input.kind)
  });

  return {
    ok: true,
    provider: "deterministic",
    model: "meridian-deterministic-local",
    kind: input.kind,
    title,
    summary: summaryForSermonKind(input.kind, bigIdea),
    contentMarkdown: contentByKind[input.kind],
    estimatedMinutes: normalizeEstimatedMinutes(undefined, input.kind),
    sources: sermonPrepSources(input, "deterministic"),
    warnings: validation.ok ? warnings : [...warnings, `Local fallback validation warning: ${validation.reason}`],
    provenance: buildMeridianProvenance({
      brief: synthesisBrief,
      provider: "deterministic",
      model: "meridian-deterministic-local",
      fallbackUsed: true,
      fallbackReason: warnings.join(" ") || "No live Meridian AI provider was configured.",
      validation
    })
  };
}

function sermonPrepSystemPrompt(kind: SermonPrepResourceKind) {
  return [
    "You are Meridian, preparing leader-reviewed sermon resources for Lead Emergence through Gloo AI Studio when configured.",
    "Return only JSON with keys title, summary, contentMarkdown, estimatedMinutes, sources, warnings.",
    "Do not include full Bible text. Do not send, publish externally, create Canva files, or claim a live sync.",
    "Write direct, useful ministry content, not Socratic coaching. The model should not cite internal documents; synthesize them.",
    `Requested resource kind: ${kind}.`
  ].join(" ");
}

function sermonPrepUserPrompt(
  input: MeridianSermonPrepResourceInput,
  provider: MeridianAiProviderId,
  synthesisBrief: MeridianSynthesisBrief,
  previousFailure: string
) {
  return JSON.stringify({
    provider,
    previousFailure,
    task: "Generate one sermon-prep resource and make it ready for volunteer leader review.",
    kind: input.kind,
    meridianSynthesisBrief: synthesisBrief,
    sermon: {
      title: input.title,
      passage: input.passage,
      bigIdea: input.bigIdea,
      draftExcerpt: input.body.slice(0, 3200)
    },
    expectedShape: resourceShape(input.kind),
    citationRequirement: "Do not cite internal ministry documents. sources is internal diagnostic metadata only; visible prose must read naturally."
  });
}

function resourceShape(kind: SermonPrepResourceKind) {
  if (kind === "outline") return "4-6 message movements with short explanations and transitions.";
  if (kind === "leader_guide") return "leader goal, before-group prep, discussion flow, care notes, and closing prayer.";
  if (kind === "slide_plan") return "a slide-by-slide plan only; no Canva or external design action.";
  return "student-ready small group questions with observation, interpretation, heart, practice, and prayer prompts.";
}

function defaultSermonResourceTitle(input: MeridianSermonPrepResourceInput) {
  const base = input.title.trim() || "Sermon Prep";
  const suffix: Record<SermonPrepResourceKind, string> = {
    outline: "Message Outline",
    leader_guide: "Leader Guide",
    slide_plan: "Slide Plan",
    small_group_questions: "Small Group Questions"
  };
  return `${base} - ${suffix[input.kind]}`;
}

function summaryForSermonKind(kind: SermonPrepResourceKind, bigIdea: string) {
  if (kind === "outline") return `Message outline shaped around: ${bigIdea}`;
  if (kind === "leader_guide") return `Volunteer leader guide shaped around: ${bigIdea}`;
  if (kind === "slide_plan") return `Slide plan generated without Canva connection, shaped around: ${bigIdea}`;
  return `Small group questions shaped around: ${bigIdea}`;
}

function sermonPrepSources(input: MeridianSermonPrepResourceInput, provider: MeridianAiProviderId | "deterministic") {
  return [
    `Current sermon draft: ${input.title.trim() || "Untitled sermon"}`,
    `Selected Scripture reference: ${input.passage.trim() || "Not selected"}`,
    provider === "deterministic" ? "Meridian local fallback" : `Meridian provider: ${provider}`
  ];
}

function discussionInputWithSynthesis(
  input: MeridianDiscussionDraftInput,
  synthesisBrief: MeridianSynthesisBrief
): GlooDiscussionDraftInput {
  return {
    question: input.question,
    scriptureReference: input.scriptureReference,
    metanarrativeMovement: input.metanarrativeMovement,
    studentJourneyContext: input.studentJourneyContext,
    approvedEvidenceContext: input.approvedEvidenceContext,
    groundingStatus: input.groundingStatus,
    requireStructuredAnswer: input.requireStructuredAnswer,
    requireClaimAttribution: input.requireClaimAttribution,
    journeyContext: input.journeyContext,
    retrievedContext: [
      "Meridian Synthesis Brief:",
      formatMeridianSynthesisBriefForAi(synthesisBrief),
      "",
      "Legacy retrieved context for comparison only; synthesize the brief above instead of citing snippets:",
      input.retrievedContext || "No legacy retrieved context supplied."
    ].join("\n"),
    internalGroundingContext: "Internal grounding has already been synthesized into the Meridian Synthesis Brief. Do not quote, cite, reveal, or assign internal ministry documents."
  };
}

function requiredMarkersForKind(kind: SermonPrepResourceKind) {
  if (kind === "leader_guide") {
    return ["Lesson Summary", "Likely Student Misunderstandings", "Leader Guidance", "Discussion Strategy", "Pastoral Considerations", "Practical Application"];
  }
  if (kind === "small_group_questions") return ["Notice", "Interpret", "Wrestle", "Practice", "Community"];
  if (kind === "slide_plan") return ["Slide Plan"];
  return [];
}

function normalizeEstimatedMinutes(value: unknown, kind: SermonPrepResourceKind) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 45);
  if (kind === "leader_guide") return 10;
  if (kind === "small_group_questions") return 8;
  return 6;
}

function logFallbackFailure(kind: "discussion" | "reading_plan" | "sermon_prep", provider: "gloo" | "gemini" | "openai", code: string, httpStatus: number | null) {
  console.warn("[meridian-ai] fallback provider failure", {
    timestamp: new Date().toISOString(),
    kind,
    provider,
    code,
    httpStatus
  });
}
