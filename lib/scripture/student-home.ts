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
  return scripturePlans.find((plan) => promptSearchTextForPlan(plan).split(" ").some((word) => word.length > 5 && text.includes(word)));
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

function promptSearchText(prompt: ReadingSource) {
  return `${prompt.question} ${prompt.scriptureReference} ${(prompt.topicTags ?? []).join(" ")}`.toLowerCase();
}

function promptSearchTextForPlan(plan: ScripturePlan) {
  return `${plan.title} ${plan.primaryScripture} ${plan.summary} ${plan.contextFocus}`.toLowerCase();
}
