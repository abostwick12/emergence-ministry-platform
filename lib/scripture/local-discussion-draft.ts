import type { MetanarrativeMovement, StudentDiscussionKnowledgeContext, StudentDiscussionPrompt } from "@/lib/scripture/types";

type LocalDiscussionDraftInput = {
  question: string;
  scriptureReference?: string;
  metanarrativeMovement?: MetanarrativeMovement;
  topicTags?: string[];
  knowledgeContext?: StudentDiscussionKnowledgeContext[];
};

export type LocalDiscussionDraft = {
  discussionPrompt: string;
  safetyLabel: "safe" | "needs_leader_care" | "pastoral_escalation";
  safetyNotes: string;
  escalationReason: string;
  topicTags: string[];
};

export function buildLocalDiscussionDraft(input: LocalDiscussionDraftInput): LocalDiscussionDraft {
  const text = promptSearchText(input);
  const sensitiveFlags = sensitiveTopicFlags(text);
  const primaryContext = input.knowledgeContext?.[0];
  const contextQuestion = primaryContext?.digQuestions.find(Boolean);
  const reference = input.scriptureReference?.trim();
  const topicTags = normalizeTopicTags([...(input.topicTags ?? []), ...(primaryContext?.topicTags ?? []), ...sensitiveFlags]);
  const safetyLabel = safetyLabelForFlags(sensitiveFlags);

  return {
    discussionPrompt: buildDiscussionPrompt(input.question, reference, contextQuestion, primaryContext?.title),
    safetyLabel,
    safetyNotes: safetyNotesForFlags(sensitiveFlags, primaryContext?.description),
    escalationReason: sensitiveFlags.length ? sensitiveFlags.join(", ") : "",
    topicTags
  };
}

export function buildLocalDiscussionDraftForPrompt(prompt: StudentDiscussionPrompt) {
  return buildLocalDiscussionDraft({
    question: prompt.question,
    scriptureReference: prompt.scriptureReference,
    metanarrativeMovement: prompt.metanarrativeMovement,
    topicTags: prompt.topicTags,
    knowledgeContext: prompt.knowledgeContext
  });
}

function buildDiscussionPrompt(question: string, reference: string | undefined, contextQuestion: string | undefined, contextTitle: string | undefined) {
  if (contextQuestion) return contextQuestion;

  const text = question.toLowerCase();
  const anchor = reference ? ` as you read ${reference}` : " as you listen to Scripture together";

  if (/\b(garden|eden|tree|creation|evil)\b/.test(text)) {
    return `What does the garden story show us about God's gifts, human trust, and God's pursuit after failure${anchor}?`;
  }

  if (/\b(suffer|suffering|pain|grief|death|trauma|anxiety|depression)\b/.test(text)) {
    return `Where does Scripture give us room for honest pain while still helping us look for God's nearness and hope${anchor}?`;
  }

  if (/\b(doubt|deconstruct|confus\w*|unbelief|faith crisis)\b/.test(text)) {
    return `What question is underneath this question, and how can we bring it into the light with honesty, humility, and Scripture${anchor}?`;
  }

  if (/\b(identity|belong|worth|purpose)\b/.test(text)) {
    return `What does this passage show is true about God, people, and belonging before we measure ourselves by performance${anchor}?`;
  }

  if (contextTitle) {
    return `What does ${contextTitle} help us notice about God, people, brokenness, and hope${anchor}?`;
  }

  return `What does this question reveal about God, people, brokenness, or hope, and how should our group respond faithfully${anchor}?`;
}

function safetyNotesForFlags(flags: string[], contextDescription: string | undefined) {
  if (flags.some((flag) => flag === "abuse_family_crisis" || flag === "self_harm")) {
    return "Do not handle this as a normal group discussion only. A trusted leader should follow up directly and use established care and safety procedures.";
  }

  if (flags.length) {
    return "Use this as a leader-shaped discussion starter. Move slowly, avoid quick answers, and invite direct leader follow-up if the student needs care.";
  }

  return contextDescription || "Knowledge-guided fallback draft prepared for leader review when the AI provider is unavailable.";
}

function safetyLabelForFlags(flags: string[]): LocalDiscussionDraft["safetyLabel"] {
  if (flags.some((flag) => flag === "abuse_family_crisis" || flag === "self_harm")) return "pastoral_escalation";
  if (flags.length) return "needs_leader_care";
  return "safe";
}

function sensitiveTopicFlags(text: string) {
  const checks: Array<[string, RegExp]> = [
    ["suffering", /\b(suffer|suffering|pain|grief|grieving|death|trauma|tragedy|loss)\b/],
    ["sexuality_identity", /\b(sexuality|gender|identity|lgbt|gay|lesbian|trans|same-sex|same sex)\b/],
    ["hell_judgment", /\b(hell|judgment|judgement|wrath|condemn|damnation)\b/],
    ["doubt_deconstruction", /\b(doubt\w*|deconstruct\w*|unbelief|faith crisis|walk away)\b/],
    ["self_harm", /\b(self-harm|self harm|suicide|suicidal|kill myself|hurt myself)\b/],
    ["abuse_family_crisis", /\b(abuse|abusive|assault|family crisis|divorce|neglect|unsafe at home)\b/],
    ["old_testament_violence", /\b(violence|genocide|slavery|conquest|canaan|canaanite|war|kill|killing)\b/]
  ];

  return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function normalizeTopicTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean))).slice(0, 8);
}

function promptSearchText(input: LocalDiscussionDraftInput) {
  return `${input.question} ${input.scriptureReference ?? ""} ${(input.topicTags ?? []).join(" ")} ${(input.knowledgeContext ?? [])
    .flatMap((match) => [match.title, match.description, ...match.topicTags, ...match.scriptureReferences])
    .join(" ")}`.toLowerCase();
}
