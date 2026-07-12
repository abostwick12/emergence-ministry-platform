export const studentCuratedResourceKinds = ["guide", "video", "prayer", "reading_tool", "practice", "discussion_prompt"] as const;
export const studentCuratedResourceStages = ["ask", "read", "reflect", "practice", "discuss"] as const;

export type StudentCuratedResourceKind = (typeof studentCuratedResourceKinds)[number];
export type StudentCuratedResourceStage = (typeof studentCuratedResourceStages)[number];

export const studentCuratedResourceStageLabels: Record<StudentCuratedResourceStage, string> = {
  ask: "Ask",
  read: "Read",
  reflect: "Reflect",
  practice: "Practice",
  discuss: "Discuss"
};

export type StudentCuratedResource = {
  id: string;
  kind: StudentCuratedResourceKind;
  journeyStage: StudentCuratedResourceStage;
  title: string;
  summary: string;
  body: string;
  scriptureReferences: string[];
  themes: string[];
  questionPatterns: string[];
  practicePrompt: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentCuratedResourceState = {
  readiness: {
    storage: "live" | "local";
    message: string;
  };
  resources: StudentCuratedResource[];
  stats: {
    total: number;
    active: number;
    drafted: number;
  };
};

const MAX_RESOURCES_FOR_STUDENTS = 6;
const MAX_RESOURCES_PER_STAGE = 2;

export function matchCuratedResourcesToPrompt(
  prompt: { question: string; scriptureReference?: string; topicTags?: string[] },
  resources: StudentCuratedResource[]
) {
  const activeResources = resources.filter((resource) => resource.isActive);
  const query = `${prompt.question} ${prompt.scriptureReference ?? ""} ${(prompt.topicTags ?? []).join(" ")}`;
  const queryText = query.toLowerCase();
  const queryTokens = tokenize(query);
  const scored = activeResources
    .map((resource, index) => ({
      resource,
      score: scoreResource(resource, queryText, queryTokens, index)
    }))
    .filter((item) => item.score > 0 || activeResources.length <= MAX_RESOURCES_FOR_STUDENTS)
    .sort((a, b) => b.score - a.score || a.resource.sortOrder - b.resource.sortOrder)
    .map((item) => item.resource);

  return balanceResourcesByStage(scored);
}

function scoreResource(resource: StudentCuratedResource, queryText: string, queryTokens: Set<string>, index: number) {
  const resourceText = `${resource.title} ${resource.summary} ${resource.scriptureReferences.join(" ")} ${resource.themes.join(" ")} ${resource.questionPatterns.join(" ")}`;
  const resourceTokens = tokenize(resourceText);
  let score = Math.max(0, 5 - index) * 0.01;

  for (const token of Array.from(queryTokens)) {
    if (resourceTokens.has(token)) score += 2;
  }

  for (const theme of resource.themes) {
    if (queryText.includes(theme.toLowerCase())) score += 4;
  }

  for (const pattern of resource.questionPatterns) {
    if (pattern && queryText.includes(pattern.toLowerCase())) score += 5;
  }

  for (const reference of resource.scriptureReferences) {
    const [book] = reference.toLowerCase().split(/\s+/);
    if (book && queryText.includes(book)) score += 3;
  }

  return score;
}

function balanceResourcesByStage(resources: StudentCuratedResource[]) {
  const selected: StudentCuratedResource[] = [];

  for (const stage of studentCuratedResourceStages) {
    const stageResources = resources.filter((resource) => resource.journeyStage === stage).slice(0, MAX_RESOURCES_PER_STAGE);
    for (const resource of stageResources) {
      if (!selected.some((item) => item.id === resource.id)) selected.push(resource);
      if (selected.length >= MAX_RESOURCES_FOR_STUDENTS) return selected;
    }
  }

  for (const resource of resources) {
    if (!selected.some((item) => item.id === resource.id)) selected.push(resource);
    if (selected.length >= MAX_RESOURCES_FOR_STUDENTS) break;
  }

  return selected;
}

function tokenize(input: string) {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !["the", "and", "for", "with", "that", "this", "what", "why", "how", "does"].includes(token))
  );
}
