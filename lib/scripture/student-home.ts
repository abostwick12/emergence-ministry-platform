import { scripturePlans, scriptureResources } from "@/lib/scripture/mock-data";
import type { ScripturePlan, ScriptureResource, StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";

export type StudentGroupDiscussionItem = {
  id: string;
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
  digQuestions: string[];
  readingPlan: StudentKeepReadingItem;
  resource: StudentKeepReadingItem;
};

export type StudentHomeFeed = {
  forGroup: StudentGroupDiscussionItem[];
  recentQuestions: StudentDiscussionPrompt[];
  keepReading: StudentKeepReadingItem[];
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
  approvedGroupPrompts: StudentGroupDiscussionItem[] = toGroupDiscussionItems(prompts)
): StudentHomeFeed {
  const recentQuestions = prompts.filter((prompt) => prompt.submittedByUserId === userId).slice(0, 4);
  const forGroup = approvedGroupPrompts.slice(0, 4);

  return {
    forGroup,
    recentQuestions,
    keepReading: buildKeepReadingItems(recentQuestions, forGroup)
  };
}

export function toGroupDiscussionItems(prompts: StudentDiscussionPrompt[]): StudentGroupDiscussionItem[] {
  return prompts
    .filter((prompt) => (prompt.status === "approved" || prompt.status === "posted") && Boolean(prompt.discussionPrompt))
    .map((prompt) => ({
      id: prompt.id,
      question: prompt.question,
      scriptureReference: prompt.scriptureReference,
      discussionPrompt: prompt.discussionPrompt,
      status: prompt.status as Extract<StudentDiscussionStatus, "approved" | "posted">,
      createdAt: prompt.createdAt
    }));
}

export function buildQuestionNextStep(prompt: ReadingSource & { id?: string }): StudentQuestionNextStep {
  const plan = planForPrompt(prompt) ?? scripturePlans[0];
  const resource = resourceForPrompt(prompt) ?? scriptureResources.find((item) => item.id === "better-questions") ?? scriptureResources[0];
  const topic = topicLabelForPrompt(prompt);

  return {
    promptId: prompt.id ?? "current-question",
    label: topic ? `Because you asked about ${topic}` : "Keep exploring",
    title: "Start digging before group",
    summary: "Your leader can still shape this for discussion, but you do not have to wait to start reading carefully.",
    digQuestions: digQuestionsForPrompt(prompt),
    readingPlan: planItem(plan, topic ? `Reading for ${topic}` : "Suggested plan"),
    resource: resourceItem(resource, "Practice this")
  };
}

function buildKeepReadingItems(recentQuestions: StudentDiscussionPrompt[], forGroup: StudentGroupDiscussionItem[]) {
  const sourcePrompts = [...recentQuestions, ...forGroup];
  const items: StudentKeepReadingItem[] = [];

  for (const prompt of sourcePrompts) {
    const plan = planForPrompt(prompt);
    if (plan && !items.some((item) => item.id === `plan-${plan.id}`)) {
      items.push({
        id: `plan-${plan.id}`,
        label: promptLabel(prompt),
        title: plan.title,
        description: plan.summary,
        href: "/student/scripture/plans"
      });
    }

    const resource = resourceForPrompt(prompt);
    if (resource && !items.some((item) => item.id === `resource-${resource.id}`)) {
      items.push({
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
    if (!items.some((current) => current.id === item.id)) items.push(item);
    if (items.length >= 3) break;
  }

  return items;
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

  if (/\b(trust|faith|believe|prayer|pray|anxiety|worry)\b/.test(text)) {
    return [
      "What does the passage show about God's character before it asks for a response?",
      "What makes trust hard in this situation?",
      "What would it look like for your group to practice honest faith together this week?"
    ];
  }

  if (/\b(suffer|pain|grief|death|trauma|hard things)\b/.test(text)) {
    return [
      "Where does Scripture make room for honest grief or lament?",
      "What does the passage reveal about God's nearness when life is painful?",
      "What would be a careful, non-rushed way for the group to respond?"
    ];
  }

  return [
    "What is happening in the passage or story behind this question?",
    "What does this reveal about God, people, brokenness, or hope?",
    "How could your group respond together without forcing a quick answer?"
  ];
}

function promptSearchText(prompt: ReadingSource) {
  return `${prompt.question} ${prompt.scriptureReference} ${(prompt.topicTags ?? []).join(" ")}`.toLowerCase();
}

function promptSearchTextForPlan(plan: ScripturePlan) {
  return `${plan.title} ${plan.primaryScripture} ${plan.summary} ${plan.contextFocus}`.toLowerCase();
}
