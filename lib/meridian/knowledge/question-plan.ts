import type { MeridianQuestionPlan, MeridianTaskContext } from "@/lib/meridian/knowledge/types";

const MAX_REQUIRED_FACETS = 4;
const explicitCompoundBoundary = /(?:[;?]\s*|,?\s+\b(?:and|but)\s+)(?=(?:how|why|what|when|where|who|which|should|does|do|is|are|can|could|would|will)\b)/gi;
const genericQuestionTokens = new Set([
  "about", "and", "are", "bible", "but", "can", "could", "does", "explain", "for", "from", "had", "has",
  "have", "how", "into", "mean", "means", "our", "passage", "question", "scripture", "should", "tell", "than",
  "that", "their", "them", "then", "the", "this", "understand", "was", "were", "what", "when", "where", "which",
  "who", "why", "will", "with", "would"
]);

export function buildMeridianQuestionPlan(task: MeridianTaskContext): MeridianQuestionPlan {
  const question = normalizeText(task.query ?? "");
  const scriptureReferences = unique((task.scriptureReferences ?? []).map(normalizeText).filter(Boolean));

  if (!question) {
    return {
      question,
      scriptureReferences,
      facets: [],
      ambiguous: true,
      ambiguityReason: "missing_question"
    };
  }

  const candidates = unique(
    question
      .split(explicitCompoundBoundary)
      .map(normalizeText)
      .filter((candidate) => meaningfulTokens(candidate).length >= 2)
  );
  const facetQueries = candidates.length ? candidates : [question];
  const tooManyFacets = facetQueries.length > MAX_REQUIRED_FACETS;

  return {
    question,
    scriptureReferences,
    facets: facetQueries.slice(0, MAX_REQUIRED_FACETS).map((query, index) => ({
      id: `facet-${index + 1}`,
      query,
      required: true
    })),
    ambiguous: tooManyFacets,
    ambiguityReason: tooManyFacets ? "too_many_facets" : undefined
  };
}

export function meridianSearchText(facetQuery: string, scriptureReferences: string[]) {
  return normalizeText([facetQuery, ...scriptureReferences].filter(Boolean).join(" ")).slice(0, 2000);
}

export function meridianLexicalTokens(value: string) {
  return new Set(meaningfulTokens(value).filter((token) => !genericQuestionTokens.has(token)));
}

export function normalizeMeridianReference(value: string) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

function meaningfulTokens(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function normalizeText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
