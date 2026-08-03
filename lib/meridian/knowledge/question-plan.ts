import type {
  MeridianFacetRoute,
  MeridianIntentRoute,
  MeridianQuestionPlan,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";

const MAX_REQUIRED_FACETS = 4;
const explicitCompoundBoundary = /(?:[;?]\s*|,?\s+\b(?:and|but)\s+)(?=(?:how|why|what|when|where|who|which|should|does|do|is|are|can|could|would|will)\b)/gi;
const genericQuestionTokens = new Set([
  "about", "and", "are", "bible", "but", "can", "could", "does", "explain", "for", "from", "had", "has",
  "have", "how", "into", "mean", "means", "our", "passage", "question", "scripture", "should", "tell", "than",
  "that", "their", "them", "then", "the", "this", "understand", "was", "were", "what", "when", "where", "which",
  "who", "why", "will", "with", "would"
]);
const passageIntentPattern = /\b(this|that|the)\s+(passage|verse|text|chapter|story)\b|\bwhy does .{0,80}\bsay\b|\baccording to\b/i;
const doctrineIntentPattern = /\b(god|trinity|jesus|christ|holy spirit|angel|evil|sin|salvation|saved|grace|faith|works|forgiveness|atonement|cross|resurrection|heaven|hell|rapture|second coming|free will|predestination|scripture|bible|gospel|doctrine|creation|judgment|judgement)\b/i;
const formationIntentPattern = /\b(how do i|should i|what should i|why do i feel|pray|prayer|suffer|suffering|grief|grieving|doubt|identity|gender|sexuality|family|pastoral|care|trust|anxiety|depression|practice|live|respond|apply)\b/i;
const formationLeadPattern = /\b(how do i|should i|what should i|why do i feel|how should we|what response)\b/i;

export function buildMeridianQuestionPlan(task: MeridianTaskContext): MeridianQuestionPlan {
  const question = normalizeText(task.query ?? "");
  const scriptureReferences = unique((task.scriptureReferences ?? []).map(normalizeText).filter(Boolean));

  if (!question) {
    return {
      question,
      scriptureReferences,
      intentRoute: scriptureReferences.length ? "passage" : "doctrine",
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
  const intentRoute = classifyMeridianIntent(question, scriptureReferences);

  return {
    question,
    scriptureReferences,
    intentRoute,
    facets: facetQueries.slice(0, MAX_REQUIRED_FACETS).map((query, index) => ({
      id: `facet-${index + 1}`,
      query,
      required: true,
      route: classifyMeridianFacetRoute(query, scriptureReferences)
    })),
    ambiguous: tooManyFacets,
    ambiguityReason: tooManyFacets ? "too_many_facets" : undefined
  };
}

export function classifyMeridianIntent(question: string, scriptureReferences: string[] = []): MeridianIntentRoute {
  const normalized = normalizeText(question);
  const signals = new Set<Exclude<MeridianIntentRoute, "mixed">>();
  if (scriptureReferences.length || passageIntentPattern.test(normalized)) signals.add("passage");
  if (doctrineIntentPattern.test(normalized)) signals.add("doctrine");
  if (formationIntentPattern.test(normalized)) signals.add("formation");
  if (signals.size > 1) return "mixed";
  return signals.values().next().value ?? "doctrine";
}

export function classifyMeridianFacetRoute(question: string, scriptureReferences: string[] = []): MeridianFacetRoute {
  const normalized = normalizeText(question);
  if (passageIntentPattern.test(normalized)) return "passage";
  if (formationLeadPattern.test(normalized)) return "formation";
  if (scriptureReferences.length) return "passage";
  if (doctrineIntentPattern.test(normalized)) return "doctrine";
  if (formationIntentPattern.test(normalized)) return "formation";
  return "doctrine";
}

export function deriveMeridianResponseRequirements(question: string) {
  const normalized = normalizeText(question).toLowerCase();
  const pastoralCare = /\b(suffer|suffering|pain|grief|grieving|death|trauma|tragedy|loss|sexuality|gender|identity|lgbt|gay|lesbian|trans|same-sex|same sex|hell|judgment|judgement|wrath|condemn|damnation|doubt\w*|deconstruct\w*|unbelief|faith crisis|walk away|abuse|assault|self-harm|suicide|family crisis|divorce|neglect|violence|genocide|slavery|conquest|canaan|war|kill|killing|bab(?:y|ies)|child(?:ren)?|unanswered prayer|salvation|saved)\b/.test(normalized);
  const uncertainty = /\b(why|how could|what happens|what happened|literal|symbolic|future|free will|recognize|rapture|doubt|three persons|angel of the lord|never heard)\b/.test(normalized);
  return { humanReview: true as const, pastoralCare, uncertainty };
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
