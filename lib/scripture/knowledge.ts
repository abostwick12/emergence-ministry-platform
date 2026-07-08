import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import type { StudentQuestionNextStep } from "@/lib/scripture/student-home";

export type StudentKnowledgeMatch = {
  id: string;
  sourceChunkId?: string;
  label: string;
  title: string;
  description: string;
  href: string;
  digQuestions: string[];
  topicTags: string[];
  scriptureReferences: string[];
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

export async function saveStudentQuestionRecommendations(
  session: AuthSession,
  promptId: string,
  nextStep: StudentQuestionNextStep,
  matches: StudentKnowledgeMatch[]
) {
  if (!session.accessToken || !isSupabaseConfigured()) return;

  const rows = [
    ...nextStep.digQuestions.map((question, index) => ({
      recommendation_kind: "dig_question",
      label: nextStep.label,
      title: question,
      description: "A question to explore while your leader reviews the group prompt.",
      href: "/student",
      reason: "Generated from the student's question and launch-safe knowledge matches.",
      rank: index,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    })),
    {
      recommendation_kind: "reading_plan",
      label: nextStep.readingPlan.label,
      title: nextStep.readingPlan.title,
      description: nextStep.readingPlan.description,
      href: nextStep.readingPlan.href,
      reason: "Suggested as the next reading direction for this student question.",
      rank: 10,
      source_chunk_id: matches[0]?.sourceChunkId ?? null
    },
    {
      recommendation_kind: "resource",
      label: nextStep.resource.label,
      title: nextStep.resource.title,
      description: nextStep.resource.description,
      href: nextStep.resource.href,
      reason: "Suggested as a careful reading practice for this student question.",
      rank: 11,
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

async function getLiveKnowledgeMatches(session: AuthSession, input: KnowledgeSearchInput) {
  if (!isSupabaseAdminConfigured()) return [];

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return [];

  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("knowledge_chunks")
      .select("id,title,body,student_summary,topic_tags,concepts,scripture_references")
      .eq("ministry_id", ministryId)
      .eq("visibility", "student_visible")
      .order("updated_at", { ascending: false })
      .limit(60)
      .returns<KnowledgeChunkRow[]>();

    if (result.error) {
      console.warn("[scripture] knowledge match query failed", { message: result.error.message });
      return [];
    }

    return rankKnowledgeMatches((result.data ?? []).map(toKnowledgeMatch), input).slice(0, MAX_MATCHES);
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
