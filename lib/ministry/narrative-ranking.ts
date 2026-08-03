import type { MinistryAlignmentProfile } from "@/lib/ministry/alignment";
import type { MinistryNarrative, MinistryNarrativeSignal } from "@/lib/ministry/narrative-types";

const attentionWeight = { high: 30, watch: 20, context: 10 } as const;
const confidenceWeight = { high: 9, medium: 5, low: 1 } as const;

export function rankMinistryNarratives<T extends MinistryNarrative>(
  narratives: T[],
  alignmentProfile?: MinistryAlignmentProfile
): T[] {
  const alignmentText = alignmentProfile ? normalizeWords([
    alignmentProfile.vision,
    alignmentProfile.mission,
    alignmentProfile.currentSeason.title,
    alignmentProfile.currentSeason.description,
    ...alignmentProfile.values.flatMap((value) => [value.title, value.description]),
    ...alignmentProfile.successLooksLike
  ].join(" ")) : new Set<string>();

  return narratives
    .map((narrative, index) => ({ narrative, index, score: narrativeScore(narrative, alignmentText) }))
    .sort((left, right) => right.score - left.score || left.index - right.index || left.narrative.id.localeCompare(right.narrative.id))
    .map((item) => item.narrative);
}

export function defaultNarrativeSignal(
  narrative: MinistryNarrative,
  overrides: Partial<MinistryNarrativeSignal> = {}
): MinistryNarrativeSignal {
  const supported = narrative.status === "supported";
  return {
    attention: supported ? "watch" : "context",
    confidence: supported ? "medium" : "low",
    coverage: supported ? `${narrative.evidence.length} evidence views` : "Required evidence is incomplete",
    freshness: narrative.timeframe,
    whySurfaced: supported
      ? "The records contain a pattern that is materially different from its comparison point."
      : "This evidence gap limits a leadership question the Ministry Hub is designed to support.",
    alignmentTags: [],
    ...overrides
  };
}

function narrativeScore(narrative: MinistryNarrative, alignmentText: Set<string>) {
  const signal = narrative.signal ?? defaultNarrativeSignal(narrative);
  const supportedWeight = narrative.status === "supported" ? 100 : 0;
  const alignmentMatches = signal.alignmentTags.reduce((count, tag) => {
    const words = normalizeWords(tag);
    return count + Array.from(words).filter((word) => alignmentText.has(word)).length;
  }, 0);
  return supportedWeight + attentionWeight[signal.attention] + confidenceWeight[signal.confidence] + Math.min(12, alignmentMatches * 3);
}

function normalizeWords(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 3) ?? []);
}
