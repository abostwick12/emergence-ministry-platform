import type { MetanarrativeMovement, StudentDiscussionKnowledgeContext } from "@/lib/scripture/types";

export type MeridianSynthesisTaskType =
  | "discussion_prompt"
  | "journey_journal"
  | "leader_guide"
  | "small_group_questions"
  | "outline"
  | "slide_plan"
  | "reading_plan";

export type MeridianSynthesisSource = {
  id: string;
  sourceType: string;
  title: string;
  summary: string;
  influence: string;
  scriptureReferences: string[];
  topicTags: string[];
};

export type MeridianSynthesisBrief = {
  taskType: MeridianSynthesisTaskType;
  normalizedRequest: string;
  audience: string;
  ministryIdentity: string[];
  currentMinistrySeason: string[];
  recurringMinistryThemes: string[];
  relevantPriorTeaching: string[];
  theologicalGuardrails: string[];
  formationGoals: string[];
  teachingPhilosophy: string[];
  summarizedSources: MeridianSynthesisSource[];
  sourceIds: string[];
  sourceTypes: string[];
  excludedInformation: string[];
};

export type MeridianValidationResult = {
  ok: boolean;
  reason: string;
};

export type MeridianGenerationProvenance = {
  aiProvider: string;
  model: string;
  meridianRan: boolean;
  retrievalQuery: string;
  selectedSourceIds: string[];
  selectedSourceTypes: string[];
  fallbackUsed: boolean;
  fallbackReason: string;
  validationResult: string;
  contextCategories: string[];
};

type BuildSynthesisInput = {
  taskType: MeridianSynthesisTaskType;
  request: string;
  audience?: string;
  scriptureReference?: string;
  metanarrativeMovement?: MetanarrativeMovement;
  knowledgeMatches?: StudentDiscussionKnowledgeContext[];
  internalGroundingContext?: string;
  sermon?: {
    title: string;
    passage: string;
    bigIdea: string;
    excerpt: string;
  };
};

const DEFAULT_AUDIENCE = "students and volunteer leaders";

const ministryIdentity = [
  "Lead Emergence forms students and leaders through Scripture-shaped ministry, leader review, and practical discipleship.",
  "The platform should sound like a thoughtful ministry leader who knows the team's accumulated wisdom, not a generic content engine.",
  "Student-facing artifacts should invite attention, humility, community, and faithful next steps."
];

const currentMinistrySeason = [
  "Scripture Practice is the active formation season: students learn to read slowly, notice context, and bring honest questions into trusted community.",
  "Leader preparation should reduce Sunday pressure by giving volunteers clear, pastorally aware, student-ready guidance."
];

const recurringMinistryThemes = [
  "formation before performance",
  "presence before platform",
  "receiving grace before trying to produce",
  "Scripture's whole story from creation to new creation",
  "trusted community and leader-reviewed student care",
  "preview-only communications and provider outputs until a leader approves"
];

const theologicalGuardrails = [
  "Begin from Scripture and the larger biblical story rather than slogans or motivational advice.",
  "Do not quote, cite, reveal, or assign internal ministry documents.",
  "Keep the gospel as news about Jesus: King, crucified and risen Savior, grace that makes new, and a people formed for witness.",
  "Avoid manipulative urgency, fear tactics, culture-war shortcuts, and claims of direct divine certainty.",
  "Escalate sensitive pastoral-care topics to trusted leaders instead of treating them as normal group debate."
];

const formationGoals = [
  "students receive Scripture before explaining it",
  "students ask better questions instead of hunting quick answers",
  "students practice one concrete response tied to the passage",
  "leaders guide discussion with pastoral patience and theological clarity",
  "groups move from observation to interpretation, honest wrestling, practice, and community"
];

const teachingPhilosophy = [
  "Lead with observation, then connect to the Bible's storyline, then invite embodied practice.",
  "Use original-language notes only when they clarify the passage; avoid decorative word studies.",
  "Prefer concise, conversational language teenagers can actually use in small group.",
  "The output should synthesize Meridian context naturally, never read like citations or a research paper."
];

export function buildMeridianSynthesisBrief(input: BuildSynthesisInput): MeridianSynthesisBrief {
  const request = normalizeText(input.request || input.sermon?.bigIdea || input.sermon?.title || "ministry content request", 900);
  const sourceCandidates = [
    ...(input.knowledgeMatches ?? []).map(knowledgeMatchToSource),
    ...sermonSources(input),
    ...internalGroundingSources(input.internalGroundingContext)
  ];
  const summarizedSources = diversifySources(sourceCandidates);
  const sourceIds = summarizedSources.map((source) => source.id);
  const sourceTypes = Array.from(new Set(summarizedSources.map((source) => source.sourceType)));

  return {
    taskType: input.taskType,
    normalizedRequest: request,
    audience: normalizeText(input.audience ?? audienceForTask(input.taskType), 180) || DEFAULT_AUDIENCE,
    ministryIdentity,
    currentMinistrySeason,
    recurringMinistryThemes,
    relevantPriorTeaching: relevantPriorTeaching(input, summarizedSources),
    theologicalGuardrails,
    formationGoals: formationGoalsForTask(input.taskType),
    teachingPhilosophy: teachingPhilosophyForTask(input.taskType),
    summarizedSources,
    sourceIds,
    sourceTypes,
    excludedInformation: [
      "Internal ministry documents must not be quoted, cited, named, or exposed in student-facing output.",
      "Provider diagnostics, secrets, API configuration, and raw retrieved chunks are not visible content.",
      "Preview drafts must not imply email, text, GroupMe, Google, Planning Center, or other external sync occurred."
    ]
  };
}

export function formatMeridianSynthesisBriefForAi(brief: MeridianSynthesisBrief) {
  return JSON.stringify(
    {
      taskType: brief.taskType,
      request: brief.normalizedRequest,
      audience: brief.audience,
      ministryUnderstanding: {
        identity: brief.ministryIdentity,
        season: brief.currentMinistrySeason,
        themes: brief.recurringMinistryThemes,
        priorTeaching: brief.relevantPriorTeaching,
        guardrails: brief.theologicalGuardrails,
        formationGoals: brief.formationGoals,
        teachingPhilosophy: brief.teachingPhilosophy
      },
      synthesizedSources: brief.summarizedSources.map((source) => ({
        id: source.id,
        sourceType: source.sourceType,
        title: source.title,
        synthesis: source.summary,
        influence: source.influence,
        scriptureReferences: source.scriptureReferences.slice(0, 5),
        topicTags: source.topicTags.slice(0, 8)
      })),
      excludedInformation: brief.excludedInformation
    },
    null,
    2
  );
}

export function validateMeridianArtifact(input: {
  taskType: MeridianSynthesisTaskType;
  title?: string;
  summary?: string;
  content?: string;
  requiredMarkers?: string[];
}): MeridianValidationResult {
  const title = input.title?.trim() ?? "";
  const summary = input.summary?.trim() ?? "";
  const content = input.content?.trim() ?? "";
  if (!title && input.taskType !== "discussion_prompt") return { ok: false, reason: "missing_title" };
  if (!summary && input.taskType !== "discussion_prompt") return { ok: false, reason: "missing_summary" };
  if (!content) return { ok: false, reason: "missing_content" };
  if (content.length < minimumContentLength(input.taskType)) return { ok: false, reason: "content_too_short" };
  if (content.length > 9000) return { ok: false, reason: "content_too_long" };
  if (/(api[_ -]?key|service[_ -]?role|access token|bearer token|stack trace|provider diagnostics)/i.test(content)) {
    return { ok: false, reason: "sensitive_or_diagnostic_text" };
  }
  const missingMarker = input.requiredMarkers?.find((marker) => !content.toLowerCase().includes(marker.toLowerCase()));
  if (missingMarker) return { ok: false, reason: `missing_required_marker:${missingMarker}` };
  return { ok: true, reason: "validated" };
}

export function buildMeridianProvenance(input: {
  brief?: MeridianSynthesisBrief;
  provider: string;
  model: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  validation: MeridianValidationResult;
}): MeridianGenerationProvenance {
  return {
    aiProvider: input.provider,
    model: input.model,
    meridianRan: Boolean(input.brief),
    retrievalQuery: input.brief?.normalizedRequest ?? "",
    selectedSourceIds: input.brief?.sourceIds ?? [],
    selectedSourceTypes: input.brief?.sourceTypes ?? [],
    fallbackUsed: input.fallbackUsed === true,
    fallbackReason: input.fallbackReason ?? "",
    validationResult: input.validation.ok ? input.validation.reason : `failed:${input.validation.reason}`,
    contextCategories: input.brief
      ? [
          "mission_vision_values",
          "current_ministry_season",
          "recurring_ministry_themes",
          "prior_teaching",
          "theological_guardrails",
          "formation_goals",
          ...input.brief.sourceTypes
        ]
      : []
  };
}

function knowledgeMatchToSource(match: StudentDiscussionKnowledgeContext): MeridianSynthesisSource {
  return {
    id: match.sourceChunkId ? `chunk:${match.sourceChunkId}` : match.id,
    sourceType: match.id.startsWith("context-map-") || match.id.startsWith("launch-") ? "ministry_context_map" : "meridian_knowledge",
    title: match.title,
    summary: normalizeText(match.description, 520),
    influence: influenceForMatch(match),
    scriptureReferences: match.scriptureReferences,
    topicTags: match.topicTags
  };
}

function sermonSources(input: BuildSynthesisInput): MeridianSynthesisSource[] {
  if (!input.sermon) return [];
  const sources: MeridianSynthesisSource[] = [
    {
      id: "sermon:draft",
      sourceType: "current_sermon_draft",
      title: input.sermon.title || "Current sermon draft",
      summary: normalizeText(input.sermon.excerpt, 640) || "Use the current sermon draft as the immediate lesson context.",
      influence: "Anchor the generated artifact in the current lesson's passage, big idea, and movement.",
      scriptureReferences: input.sermon.passage ? [input.sermon.passage] : [],
      topicTags: tokenizeForTags(`${input.sermon.title} ${input.sermon.bigIdea}`).slice(0, 8)
    },
    {
      id: "sermon:big-idea",
      sourceType: "lesson_big_idea",
      title: "Lesson big idea",
      summary: normalizeText(input.sermon.bigIdea, 420) || "No big idea was supplied.",
      influence: "Keep leader resources from becoming generic sermon notes by turning the big idea into student-ready formation.",
      scriptureReferences: input.sermon.passage ? [input.sermon.passage] : [],
      topicTags: ["lesson", "formation", "leader_prep"]
    }
  ];
  return sources;
}

function internalGroundingSources(value: string | undefined): MeridianSynthesisSource[] {
  if (!value?.trim()) return [];
  return value
    .split(/\n{2,}/)
    .map((chunk, index) => normalizeText(chunk, 520))
    .filter(Boolean)
    .slice(0, 3)
    .map((summary, index) => ({
      id: `internal-grounding:${index + 1}`,
      sourceType: "internal_grounding",
      title: `Internal grounding signal ${index + 1}`,
      summary,
      influence: "Shape posture, theological texture, and ministry voice without exposing internal material.",
      scriptureReferences: [],
      topicTags: ["internal_grounding", "ministry_voice"]
    }));
}

function diversifySources(sources: MeridianSynthesisSource[]) {
  const seen = new Set<string>();
  const byType = new Map<string, number>();
  const result: MeridianSynthesisSource[] = [];

  for (const source of sources) {
    const key = `${source.id}:${source.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    const typeCount = byType.get(source.sourceType) ?? 0;
    if (typeCount >= 2) continue;
    seen.add(key);
    byType.set(source.sourceType, typeCount + 1);
    result.push(source);
    if (result.length >= 8) break;
  }

  return result;
}

function relevantPriorTeaching(input: BuildSynthesisInput, sources: MeridianSynthesisSource[]) {
  const sourceTeaching = sources
    .filter((source) => source.sourceType !== "internal_grounding")
    .map((source) => `${source.title}: ${source.influence}`)
    .slice(0, 4);
  const movement = input.metanarrativeMovement ? [`Story lens: ${input.metanarrativeMovement}`] : [];
  return [
    ...movement,
    ...sourceTeaching,
    "Student questions are handled through leader review, Scripture-grounded next steps, and trusted community."
  ].slice(0, 6);
}

function formationGoalsForTask(taskType: MeridianSynthesisTaskType) {
  if (taskType === "journey_journal") {
    return [
      "Receive: begin with Scripture and invite observation.",
      "Explore: connect to the larger biblical story with only helpful word-level notes.",
      "Practice: choose one concrete response tied to the passage.",
      "Walk: keep the step concise and community focused.",
      "See: reflect on formation with trusted community."
    ];
  }

  if (taskType === "leader_guide") {
    return [
      "summarize the lesson for volunteer leaders",
      "name likely student misunderstandings",
      "give leader guidance and discussion strategy",
      "include pastoral considerations",
      "land practical application without turning the guide into sermon notes"
    ];
  }

  if (taskType === "small_group_questions") {
    return [
      "Notice what the passage says",
      "Interpret in context",
      "Wrestle honestly with tension or confusion",
      "Practice one concrete response",
      "Bring the response into community"
    ];
  }

  return formationGoals;
}

function teachingPhilosophyForTask(taskType: MeridianSynthesisTaskType) {
  if (taskType === "small_group_questions") {
    return [...teachingPhilosophy, "Small-group questions should sound natural for teenagers and avoid filler."];
  }
  if (taskType === "leader_guide") {
    return [...teachingPhilosophy, "Leader guides should prepare care, facilitation, and student misconceptions, not just repeat sermon notes."];
  }
  return teachingPhilosophy;
}

function audienceForTask(taskType: MeridianSynthesisTaskType) {
  if (taskType === "leader_guide") return "volunteer small-group leaders";
  if (taskType === "small_group_questions") return "teenagers in a small group";
  if (taskType === "journey_journal" || taskType === "discussion_prompt") return "students with leader review";
  return DEFAULT_AUDIENCE;
}

function influenceForMatch(match: StudentDiscussionKnowledgeContext) {
  const references = match.scriptureReferences.length ? ` using ${match.scriptureReferences.slice(0, 3).join(", ")}` : "";
  const firstQuestion = match.digQuestions[0] ? ` It contributes this question: ${match.digQuestions[0]}` : "";
  return `Shape the artifact around ${match.title}${references}.${firstQuestion}`;
}

function minimumContentLength(taskType: MeridianSynthesisTaskType) {
  if (taskType === "discussion_prompt") return 25;
  if (taskType === "reading_plan") return 60;
  if (taskType === "small_group_questions") return 220;
  if (taskType === "leader_guide") return 420;
  return 120;
}

function normalizeText(value: string | undefined, maxLength: number) {
  const normalized = (value ?? "").normalize("NFKC").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : normalized;
}

function tokenizeForTags(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 3 && !["that", "this", "with", "from", "then", "than"].includes(item))
    )
  );
}
