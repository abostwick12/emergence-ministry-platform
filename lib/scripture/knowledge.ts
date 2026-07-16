import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { measureServerOperation } from "@/lib/performance/timing";
import type { StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentDiscussionKnowledgeContext } from "@/lib/scripture/types";

export type StudentKnowledgeMatch = StudentDiscussionKnowledgeContext;

export type StudentQuestionRecommendationKind =
  | "wrestle_question"
  | "dig_question"
  | "journal_prompt"
  | "prayer_prompt"
  | "wrestle_together"
  | "reading_plan"
  | "resource"
  | "scripture_lookup"
  | "leader_context";

export type StudentSavedQuestionRecommendation = {
  promptId: string;
  kind: StudentQuestionRecommendationKind;
  label: string;
  title: string;
  description: string;
  href: string;
  rank: number;
  sourceChunkId?: string;
};

type KnowledgeSearchInput = {
  id?: string;
  question: string;
  scriptureReference?: string;
  topicTags?: string[];
};

type KnowledgeChunkRow = {
  id: string;
  title: string;
  body: string;
  student_summary: string | null;
  topic_tags: string[] | null;
  concepts: string[] | null;
  scripture_references: string[] | null;
};

type StudentQuestionRecommendationRow = {
  prompt_id: string;
  recommendation_kind: StudentQuestionRecommendationKind;
  label: string;
  title: string;
  description: string;
  href: string;
  rank: number;
  source_chunk_id: string | null;
};

const MAX_MATCHES = 3;

const launchKnowledgePack: StudentKnowledgeMatch[] = [
  {
    id: "launch-garden-trust",
    label: "Because you asked about the garden",
    title: "Trust before the tree",
    description: "Start with what God gives in Genesis before moving to the command, failure, and God's pursuit after sin.",
    href: "/student/scripture/plans",
    topicTags: ["garden", "creation", "trust", "evil", "genesis"],
    scriptureReferences: ["Genesis 2", "Genesis 3"],
    digQuestions: [
      "What good gifts appear before the command in the garden?",
      "What kind of trust is being tested by the tree?",
      "Where does God move toward people after failure instead of abandoning them?"
    ]
  },
  {
    id: "launch-lament-trust",
    label: "Because you asked about pain",
    title: "Lament and honest trust",
    description: "Scripture gives students language for grief without rushing them into a clean answer.",
    href: "/student/scripture/resources",
    topicTags: ["suffering", "grief", "pain", "lament", "trust"],
    scriptureReferences: ["Psalm 13", "Romans 8:18"],
    digQuestions: [
      "Where does the passage make room for honest grief?",
      "What does it reveal about God's nearness when life hurts?",
      "What response would be faithful without forcing a quick answer?"
    ]
  },
  {
    id: "launch-doubt-questions",
    label: "Because you asked honestly",
    title: "Better questions before quick answers",
    description: "Move from what is happening, to why it matters, to what it reveals, before deciding how to respond.",
    href: "/student/scripture/resources",
    topicTags: ["doubt", "questions", "confused", "deconstruction", "honest"],
    scriptureReferences: [],
    digQuestions: [
      "What is the question underneath the first question?",
      "What would you need to understand from Scripture before answering?",
      "Who should help carry this question with wisdom and care?"
    ]
  },
  {
    id: "launch-exodus-formation",
    label: "Next for your group",
    title: "Rescue that forms a people",
    description: "Exodus connects deliverance, worship, covenant, and community identity instead of treating rescue as an isolated moment.",
    href: "/student/scripture/plans",
    topicTags: ["exodus", "deliverance", "wilderness", "formation", "worship"],
    scriptureReferences: ["Exodus 1", "Exodus 12", "Exodus 20"],
    digQuestions: [
      "What does God rescue his people from?",
      "What does God rescue his people for?",
      "How does worship shape the community after deliverance?"
    ]
  },
  {
    id: "launch-identity-belonging",
    label: "Because you asked about identity",
    title: "Belonging before performance",
    description: "Read identity questions through what God says is true before reducing them to achievement, reputation, or comparison.",
    href: "/student/scripture/resources",
    topicTags: ["identity", "belonging", "worth", "purpose", "image"],
    scriptureReferences: ["Genesis 1:26-28", "Ephesians 1"],
    digQuestions: [
      "What does this passage say is given before anything is achieved?",
      "What false measure of worth is being challenged?",
      "How could the group practice belonging instead of comparison?"
    ]
  }
];

export async function getStudentKnowledgeMatches(session: AuthSession, input: KnowledgeSearchInput): Promise<StudentKnowledgeMatch[]> {
  const liveMatches = await getLiveKnowledgeMatches(session, input);
  if (liveMatches.length > 0) return liveMatches;
  return rankKnowledgeMatches(launchKnowledgePack, input).slice(0, MAX_MATCHES);
}

export async function getStudentKnowledgeMatchesBatch(
  session: AuthSession,
  inputs: KnowledgeSearchInput[]
): Promise<StudentKnowledgeMatch[][]> {
  if (!inputs.length) return [];
  const livePack = await getLiveKnowledgePack(session);
  return inputs.map((input) => {
    const liveMatches = rankKnowledgeMatches(livePack, input).slice(0, MAX_MATCHES);
    return liveMatches.length > 0
      ? liveMatches
      : rankKnowledgeMatches(launchKnowledgePack, input).slice(0, MAX_MATCHES);
  });
}

export function formatStudentKnowledgeContextForGloo(matches: StudentKnowledgeMatch[]) {
  if (!matches.length) return "";

  return matches
    .slice(0, MAX_MATCHES)
    .map((match, index) => {
      const references = match.scriptureReferences.length ? match.scriptureReferences.join(", ") : "No direct passage";
      const tags = match.topicTags.length ? match.topicTags.slice(0, 6).join(", ") : "general";
      const questions = match.digQuestions.slice(0, 3).map((question) => `- ${question}`).join("\n");
      return [
        `Source ${index + 1}: ${match.title}`,
        `Label: ${match.label}`,
        `Summary: ${match.description}`,
        `References: ${references}`,
        `Tags: ${tags}`,
        questions ? `Student exploration questions:\n${questions}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export async function saveStudentQuestionRecommendations(
  session: AuthSession,
  promptId: string,
  nextStep: StudentQuestionNextStep,
  matches: StudentKnowledgeMatch[]
) {
  if (!session.accessToken || !isSupabaseConfigured()) return;

  const rows = [
    ...nextStep.wrestleQuestions.map((question, index) => ({
      recommendation_kind: "wrestle_question",
      label: "Wrestle with it",
      title: question,
      description: "A question to help the student name what they are really asking.",
      href: "/student",
      reason: "Generated from the student's question as a rabbinic-style reflection prompt.",
      rank: index,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    })),
    ...nextStep.digQuestions.map((question, index) => ({
      recommendation_kind: "dig_question",
      label: "Dig deeper",
      title: question,
      description: "A Scripture-facing question to explore while the leader reviews the group prompt.",
      href: "/student",
      reason: "Generated from the student's question and launch-safe knowledge matches.",
      rank: 10 + index,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    })),
    ...nextStep.journalPrompts.map((prompt, index) => ({
      recommendation_kind: "journal_prompt",
      label: "Reflect",
      title: prompt,
      description: "A private reflection prompt for the student to consider before group.",
      href: "/student",
      reason: "Generated from the student's question to support slower discipleship reflection.",
      rank: 20 + index,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    })),
    ...nextStep.prayerPrompts.map((prompt, index) => ({
      recommendation_kind: "prayer_prompt",
      label: "Pray",
      title: prompt,
      description: "A short prayer prompt connected to the student's question.",
      href: "/student",
      reason: "Generated from the student's question to support prayerful formation.",
      rank: 30 + index,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    })),
    {
      recommendation_kind: "wrestle_together",
      label: "Wrestle together",
      title: nextStep.wrestleTogetherPrompt,
      description: "A bridge from private reflection into leader-reviewed group discussion.",
      href: "/student",
      reason: "Generated from the student's question to prepare for group conversation.",
      rank: 40,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    },
    {
      recommendation_kind: "reading_plan",
      label: nextStep.readingPlan.label,
      title: nextStep.readingPlan.title,
      description: nextStep.readingPlan.description,
      href: nextStep.readingPlan.href,
      reason: "Suggested as the next reading direction for this student question.",
      rank: 50,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    },
    {
      recommendation_kind: "resource",
      label: nextStep.resource.label,
      title: nextStep.resource.title,
      description: nextStep.resource.description,
      href: nextStep.resource.href,
      reason: "Suggested as a careful reading practice for this student question.",
      rank: 51,
      source_chunk_id: matches[1]?.sourceChunkId ?? matches[0]?.sourceChunkId ?? null
    }
  ].map((row) => ({
    ...row,
    prompt_id: promptId,
    student_user_id: session.user.id
  }));

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase.from("student_question_recommendations").insert(rows);
    if (result.error) {
      console.warn("[scripture] recommendation persistence failed", { message: result.error.message });
    }
  } catch (error) {
    console.warn("[scripture] recommendation persistence unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function getSavedStudentQuestionRecommendations(
  session: AuthSession,
  promptIds: string[]
): Promise<Record<string, StudentSavedQuestionRecommendation[]>> {
  if (!session.accessToken || !isSupabaseConfigured() || promptIds.length === 0) return {};

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("student_question_recommendations")
      .select("prompt_id,recommendation_kind,label,title,description,href,rank,source_chunk_id")
      .eq("student_user_id", session.user.id)
      .in("prompt_id", promptIds)
      .order("rank", { ascending: true })
      .returns<StudentQuestionRecommendationRow[]>();

    if (result.error) {
      console.warn("[scripture] saved recommendation query failed", { message: result.error.message });
      return {};
    }

    return groupRecommendationsByPrompt(result.data ?? []);
  } catch (error) {
    console.warn("[scripture] saved recommendation query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return {};
  }
}

async function getLiveKnowledgeMatches(session: AuthSession, input: KnowledgeSearchInput) {
  return rankKnowledgeMatches(await getLiveKnowledgePack(session), input).slice(0, MAX_MATCHES);
}

async function getLiveKnowledgePack(session: AuthSession) {
  if (!isSupabaseAdminConfigured()) return [];

  try {
    const ministryId = await resolveMinistryScope(session);
    if (!ministryId) return [];

    const supabase = getSupabaseAdminClient();
    const result = await measureServerOperation("supabase.knowledge.visible", async () => supabase
        .from("knowledge_chunks")
        .select("id,title,body,student_summary,topic_tags,concepts,scripture_references")
        .eq("ministry_id", ministryId)
        .eq("visibility", "student_visible")
        .order("updated_at", { ascending: false })
        .limit(60)
        .returns<KnowledgeChunkRow[]>());

    if (result.error) {
      console.warn("[scripture] knowledge match query failed", { message: result.error.message });
      return [];
    }

    return (result.data ?? []).map(toKnowledgeMatch);
  } catch (error) {
    console.warn("[scripture] knowledge match query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return [];
  }
}

function toKnowledgeMatch(row: KnowledgeChunkRow): StudentKnowledgeMatch {
  const topicTags = normalizeList(row.topic_tags);
  const scriptureReferences = normalizeList(row.scripture_references);
  const concepts = normalizeList(row.concepts);
  const labelTopic = topicTags[0] ?? concepts[0]?.replace(/-/g, " ");

  return {
    id: `chunk-${row.id}`,
    sourceChunkId: row.id,
    label: labelTopic ? `Because you asked about ${labelTopic}` : "Keep exploring",
    title: row.title,
    description: row.student_summary?.trim() || limitText(row.body, 240),
    href: "/student/scripture/resources",
    topicTags: [...topicTags, ...concepts],
    scriptureReferences,
    digQuestions: questionsFromChunk(row)
  };
}

function groupRecommendationsByPrompt(rows: StudentQuestionRecommendationRow[]) {
  return rows.reduce<Record<string, StudentSavedQuestionRecommendation[]>>((groups, row) => {
    const promptRecommendations = groups[row.prompt_id] ?? [];
    promptRecommendations.push({
      promptId: row.prompt_id,
      kind: row.recommendation_kind,
      label: row.label,
      title: row.title,
      description: row.description,
      href: row.href,
      rank: row.rank,
      sourceChunkId: row.source_chunk_id ?? undefined
    });
    groups[row.prompt_id] = promptRecommendations;
    return groups;
  }, {});
}

function rankKnowledgeMatches(matches: StudentKnowledgeMatch[], input: KnowledgeSearchInput) {
  const queryText = `${input.question} ${input.scriptureReference ?? ""} ${(input.topicTags ?? []).join(" ")}`;
  const queryTokens = tokenize(queryText);

  return matches
    .map((match, index) => ({
      match,
      score: scoreMatch(match, queryTokens, queryText.toLowerCase(), index)
    }))
    .filter((item) => item.score > 0 || queryTokens.size === 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.match);
}

function scoreMatch(match: StudentKnowledgeMatch, queryTokens: Set<string>, queryText: string, index: number) {
  const matchText = `${match.title} ${match.description} ${match.topicTags.join(" ")} ${match.scriptureReferences.join(" ")}`.toLowerCase();
  const matchTokens = tokenize(matchText);
  let score = Math.max(0, 5 - index) * 0.01;

  for (const token of Array.from(queryTokens)) {
    if (matchTokens.has(token)) score += 2;
  }

  for (const tag of match.topicTags) {
    if (queryText.includes(tag.toLowerCase())) score += 4;
  }

  for (const reference of match.scriptureReferences) {
    const book = reference.toLowerCase().split(/\s+/)[0];
    if (book && queryText.includes(book)) score += 3;
  }

  return score;
}

function questionsFromChunk(row: KnowledgeChunkRow) {
  const body = row.body.toLowerCase();

  if (/\b(garden|eden|tree|creation)\b/.test(body)) {
    return launchKnowledgePack[0].digQuestions;
  }

  if (/\b(lament|grief|suffering|pain)\b/.test(body)) {
    return launchKnowledgePack[1].digQuestions;
  }

  if (/\b(exodus|deliverance|wilderness)\b/.test(body)) {
    return launchKnowledgePack[3].digQuestions;
  }

  return [
    "What is happening in the passage or story behind this question?",
    "What does this reveal about God, people, brokenness, or hope?",
    "How could your group respond together without forcing a quick answer?"
  ];
}

function tokenize(input: string) {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !["the", "and", "for", "with", "that", "this", "what", "why", "how"].includes(token))
  );
}

function normalizeList(value: string[] | null | undefined) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

function limitText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}
