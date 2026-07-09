import { scripturePlans, scriptureResources } from "@/lib/scripture/mock-data";
import type { StudentKnowledgeMatch, StudentSavedQuestionRecommendation } from "@/lib/scripture/knowledge";
import type { ScripturePlan, ScriptureResource, StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";

export type StudentGroupDiscussionItem = {
  id: string;
  groupId?: string;
  question: string;
  scriptureReference: string;
  discussionPrompt: string;
  status: Extract<StudentDiscussionStatus, "approved" | "posted">;
  createdAt: string;
};

export type StudentKeepReadingItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
};

export type StudentQuestionNextStep = {
  promptId: string;
  label: string;
  title: string;
  summary: string;
  careNote?: string;
  digQuestions: string[];
  readingPlan: StudentKeepReadingItem;
  resource: StudentKeepReadingItem;
};

export type StudentHomeFeed = {
  forGroup: StudentGroupDiscussionItem[];
  recentQuestions: StudentDiscussionPrompt[];
  keepReading: StudentKeepReadingItem[];
  questionNextSteps: StudentQuestionNextStep[];
};

type ReadingSource = {
  question: string;
  scriptureReference: string;
  metanarrativeMovement?: StudentDiscussionPrompt["metanarrativeMovement"];
  topicTags?: string[];
};

export function buildStudentHomeFeed(
  prompts: StudentDiscussionPrompt[],
  userId: string,
  approvedGroupPrompts: StudentGroupDiscussionItem[] = toGroupDiscussionItems(prompts),
  savedRecommendations: Record<string, StudentSavedQuestionRecommendation[]> = {}
): StudentHomeFeed {
  const recentQuestions = prompts.filter((prompt) => prompt.submittedByUserId === userId).slice(0, 4);
  const forGroup = approvedGroupPrompts.slice(0, 4);
  const questionNextSteps = recentQuestions.map((prompt) => {
    return savedRecommendationsToNextStep(prompt, savedRecommendations[prompt.id]) ?? buildQuestionNextStep(prompt, prompt.knowledgeContext ?? []);
  });

  return {
    forGroup,
    recentQuestions,
    keepReading: buildKeepReadingItems(recentQuestions, forGroup, questionNextSteps),
    questionNextSteps
  };
}

export function toGroupDiscussionItems(prompts: StudentDiscussionPrompt[]): StudentGroupDiscussionItem[] {
  return prompts
    .filter((prompt) => (prompt.status === "approved" || prompt.status === "posted") && Boolean(prompt.discussionPrompt))
    .map((prompt) => ({
      id: prompt.id,
      groupId: prompt.groupId,
      question: prompt.question,
      scriptureReference: prompt.scriptureReference,
      discussionPrompt: prompt.discussionPrompt,
      status: prompt.status as Extract<StudentDiscussionStatus, "approved" | "posted">,
      createdAt: prompt.createdAt
    }));
}

export function buildQuestionNextStep(prompt: ReadingSource & { id?: string }, knowledgeMatches: StudentKnowledgeMatch[] = []): StudentQuestionNextStep {
  const plan = planForPrompt(prompt) ?? scripturePlans[0];
  const resource = resourceForPrompt(prompt) ?? scriptureResources.find((item) => item.id === "better-questions") ?? scriptureResources[0];
  const topic = topicLabelForPrompt(prompt);
  const primaryKnowledge = knowledgeMatches[0];
  const secondaryKnowledge = knowledgeMatches[1];

  return {
    promptId: prompt.id ?? "current-question",
    label: primaryKnowledge?.label ?? (topic ? `Because you asked about ${topic}` : "Keep exploring"),
    title: "Start digging before group",
    summary:
      primaryKnowledge?.description ??
      "Your leader can still shape this for discussion, but you do not have to wait to start reading carefully.",
    careNote: careNoteForPrompt(prompt),
    digQuestions: primaryKnowledge?.digQuestions?.length ? primaryKnowledge.digQuestions : digQuestionsForPrompt(prompt),
    readingPlan: primaryKnowledge ? knowledgeItem(primaryKnowledge, primaryKnowledge.label) : planItem(plan, topic ? `Because you asked about ${topic}` : "Suggested plan"),
    resource: secondaryKnowledge ? knowledgeItem(secondaryKnowledge, "Keep digging") : resourceItem(resource, "Practice this")
  };
}

function buildKeepReadingItems(
  recentQuestions: StudentDiscussionPrompt[],
  forGroup: StudentGroupDiscussionItem[],
  questionNextSteps: StudentQuestionNextStep[] = []
) {
  const sourcePrompts = [...recentQuestions, ...forGroup];
  const items: StudentKeepReadingItem[] = [];

  for (const nextStep of questionNextSteps) {
    pushUniqueKeepReadingItem(items, nextStep.readingPlan);
    pushUniqueKeepReadingItem(items, nextStep.resource);
    if (items.length >= 3) return items.slice(0, 3);
  }

  for (const prompt of sourcePrompts) {
    const plan = planForPrompt(prompt);
    if (plan) {
      pushUniqueKeepReadingItem(items, {
        id: `plan-${plan.id}`,
        label: promptLabel(prompt),
        title: plan.title,
        description: plan.summary,
        href: "/student/scripture/plans"
      });
    }

    const resource = resourceForPrompt(prompt);
    if (resource) {
      pushUniqueKeepReadingItem(items, {
        id: `resource-${resource.id}`,
        label: prompt.scriptureReference ? `Because you opened ${prompt.scriptureReference}` : "Because you asked honestly",
        title: resource.title,
        description: resource.studentPractice,
        href: "/student/scripture/resources"
      });
    }

    if (items.length >= 3) return items;
  }

  return fillFallbackItems(items);
}

function savedRecommendationsToNextStep(
  prompt: StudentDiscussionPrompt,
  recommendations: StudentSavedQuestionRecommendation[] | undefined
): StudentQuestionNextStep | undefined {
  if (!recommendations?.length) return undefined;

  const sorted = [...recommendations].sort((a, b) => a.rank - b.rank);
  const digQuestions = sorted.filter((item) => item.kind === "dig_question").map((item) => item.title).filter(Boolean).slice(0, 3);
  const readingPlan = sorted.find((item) => item.kind === "reading_plan");
  const resource = sorted.find((item) => item.kind === "resource" || item.kind === "scripture_lookup");
  const fallback = buildQuestionNextStep(prompt, prompt.knowledgeContext ?? []);
  const firstRecommendation = sorted[0];

  return {
    promptId: prompt.id,
    label: firstRecommendation?.label || fallback.label,
    title: "Keep digging before group",
    summary:
      readingPlan?.description ||
      resource?.description ||
      "These next steps were saved from your question so you can keep reading while your leader reviews it.",
    careNote: fallback.careNote,
    digQuestions: digQuestions.length ? digQuestions : fallback.digQuestions,
    readingPlan: readingPlan ? recommendationItem(readingPlan, prompt.id) : fallback.readingPlan,
    resource: resource ? recommendationItem(resource, prompt.id) : fallback.resource
  };
}

function recommendationItem(recommendation: StudentSavedQuestionRecommendation, promptId: string): StudentKeepReadingItem {
  return {
    id: `recommendation-${promptId}-${recommendation.kind}-${recommendation.rank}`,
    label: recommendation.label,
    title: recommendation.title,
    description: recommendation.description,
    href: recommendation.href
  };
}

function fillFallbackItems(items: StudentKeepReadingItem[]) {
  const fallbackPlan = scripturePlans[0];
  const questionResource = scriptureResources.find((resource) => resource.id === "better-questions") ?? scriptureResources[0];
  const contextResource = scriptureResources.find((resource) => resource.id === "context") ?? scriptureResources[1];

  const fallbacks: StudentKeepReadingItem[] = [
    planItem(fallbackPlan, "Start here"),
    resourceItem(questionResource, "Ask better"),
    {
      id: "lookup-scripture",
      label: "Look it up",
      title: "Scripture lookup",
      description: "Open a passage before group so the conversation starts with the text.",
      href: "/student/scripture/resources"
    },
    resourceItem(contextResource, "Read carefully")
  ];

  for (const item of fallbacks) {
    pushUniqueKeepReadingItem(items, item);
    if (items.length >= 3) break;
  }

  return items.slice(0, 3);
}

function pushUniqueKeepReadingItem(items: StudentKeepReadingItem[], item: StudentKeepReadingItem) {
  if (!items.some((current) => current.id === item.id || current.title === item.title)) items.push(item);
}

function planItem(plan: ScripturePlan, label: string): StudentKeepReadingItem {
  return {
    id: `plan-${plan.id}`,
    label,
    title: plan.title,
    description: plan.summary,
    href: "/student/scripture/plans"
  };
}

function resourceItem(resource: ScriptureResource, label: string): StudentKeepReadingItem {
  return {
    id: `resource-${resource.id}`,
    label,
    title: resource.title,
    description: resource.studentPractice,
    href: "/student/scripture/resources"
  };
}

function knowledgeItem(match: StudentKnowledgeMatch, label: string): StudentKeepReadingItem {
  return {
    id: `knowledge-${match.id}`,
    label,
    title: match.title,
    description: match.description,
    href: match.href
  };
}

function planForPrompt(prompt: ReadingSource) {
  if (prompt.metanarrativeMovement) {
    const movementMatch = scripturePlans.find((plan) => plan.movement === prompt.metanarrativeMovement);
    if (movementMatch) return movementMatch;
  }

  const text = promptSearchText(prompt);
  const patternMatch = planForText(text);
  if (patternMatch) return patternMatch;

  return scripturePlans.find((plan) => promptSearchTextForPlan(plan).split(" ").some((word) => word.length > 5 && text.includes(word)));
}

function planForText(text: string) {
  const checks: Array<[string, RegExp]> = [
    ["creation-covenant", /\b(genesis|beginning|creation|created|garden|tree|eden|evil|fall|covenant|abraham|blessing)\b/],
    ["exodus-formation", /\b(exodus|deliverance|slavery|wilderness|passover|law|commandments|sinai|rescue)\b/],
    ["kingdom-waiting", /\b(king|kingdom|david|psalm|prophet|exile|isaiah|waiting|wisdom)\b/]
  ];
  const match = checks.find(([, pattern]) => pattern.test(text));
  return match ? scripturePlans.find((plan) => plan.id === match[0]) : undefined;
}

function resourceForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);
  const checks: Array<[string, RegExp]> = [
    ["context", /\b(context|where|before|after|mean|meaning|passage)\b/],
    ["discussion", /\b(group|talk|discuss|conversation|question)\b/],
    ["prayer", /\b(pray|prayer|trust|worry|anxiety)\b/],
    ["proof-texting", /\b(verse|prove|argument|win)\b/],
    ["typology", /\b(symbol|represent|point to|connection)\b/],
    ["better-questions", /\b(why|how|confused|wonder|struggle)\b/]
  ];
  const match = checks.find(([, pattern]) => pattern.test(text));
  if (match) return scriptureResources.find((resource) => resource.id === match[0]);
  return scriptureResources.find((resource) => resource.id === "better-questions");
}

function promptLabel(prompt: ReadingSource) {
  if (prompt.scriptureReference) return `Because you asked about ${prompt.scriptureReference}`;
  if (prompt.topicTags?.[0]) return `Because you asked about ${prompt.topicTags[0].replace(/_/g, " ")}`;
  return "Next for your group";
}

function topicLabelForPrompt(prompt: ReadingSource) {
  if (prompt.scriptureReference) return prompt.scriptureReference;
  if (prompt.topicTags?.[0]) return prompt.topicTags[0].replace(/_/g, " ");

  const text = promptSearchText(prompt);
  const checks: Array<[string, RegExp]> = [
    ["trust", /\b(trust|faith|believe|prayer|pray|anxiety|worry)\b/],
    ["suffering", /\b(suffer|pain|grief|death|trauma|hard things)\b/],
    ["the garden", /\b(garden|eden|tree|evil|genesis|creation)\b/],
    ["doubt", /\b(doubt|deconstruct|confused|questioning)\b/],
    ["identity", /\b(identity|belong|purpose|worth)\b/],
    ["forgiveness", /\b(forgive|forgiveness|mercy|grace)\b/]
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] ?? "";
}

function digQuestionsForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);

  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return [
      "What good things does God give before the command appears?",
      "What kind of trust is being tested in the story?",
      "Where do you see both human choice and God's pursuit after failure?"
    ];
  }

  if (/\b(suffer|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
    return [
      "Where does Scripture make room for honest grief or lament?",
      "What does the passage reveal about God's nearness when life is painful?",
      "What would be a careful, non-rushed way for the group to respond?"
    ];
  }

  if (/\b(trust|faith|believe|prayer|pray|anxiety|worry)\b/.test(text)) {
    return [
      "What does the passage show about God's character before it asks for a response?",
      "What makes trust hard in this situation?",
      "What would it look like for your group to practice honest faith together this week?"
    ];
  }

  return [
    "What is happening in the passage or story behind this question?",
    "What does this reveal about God, people, brokenness, or hope?",
    "How could your group respond together without forcing a quick answer?"
  ];
}

function careNoteForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);
  if (/\b(abuse|assault|self harm|suicide|kill myself|hurt myself|trauma|family crisis|unsafe)\b/.test(text)) {
    return "This is important enough to bring to a trusted leader right away. Keep reading carefully, but do not carry it alone.";
  }

  if (/\b(grief|death|depression|anxiety|panic|sexuality|identity|deconstruct|hell|judgment)\b/.test(text)) {
    return "This may need a slower conversation with a trusted leader. Use these questions to prepare, not to force a quick answer.";
  }

  return undefined;
}

function promptSearchText(prompt: ReadingSource) {
  return `${prompt.question} ${prompt.scriptureReference} ${(prompt.topicTags ?? []).join(" ")}`.toLowerCase();
}

function promptSearchTextForPlan(plan: ScripturePlan) {
  return `${plan.title} ${plan.primaryScripture} ${plan.summary} ${plan.contextFocus}`.toLowerCase();
}
