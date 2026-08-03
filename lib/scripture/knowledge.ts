import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { measureServerOperation } from "@/lib/performance/timing";
import { studentLeaderFormationMeridianContext } from "@/lib/scripture/student-formation-journeys";
import type { StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentDiscussionKnowledgeContext } from "@/lib/scripture/types";
import { SupabaseMeridianKnowledgeRepository } from "@/lib/meridian/knowledge/repository";
import { prepareMeridianGeneration } from "@/lib/meridian/knowledge/service";
import { summarizeMeridianEvidenceMap, unavailableMeridianEvidenceMapSummary } from "@/lib/meridian/knowledge/evidence-map";
import { classifyMeridianIntent, deriveMeridianResponseRequirements } from "@/lib/meridian/knowledge/question-plan";
import type { MeridianClaimAttributionBridge, MeridianEvidenceMap, MeridianEvidenceMapSummary } from "@/lib/meridian/knowledge/types";

export type StudentKnowledgeMatch = StudentDiscussionKnowledgeContext;

export type MeridianGroundingStatus = "grounded" | "partially_grounded" | "ungrounded" | "unavailable";

export type ApprovedMeridianGrounding = {
  status: MeridianGroundingStatus;
  decision: "generate" | "generate_for_review" | "abstain" | "unavailable";
  providerContext: string;
  evidenceMap?: MeridianEvidenceMap;
  attributionBridge?: MeridianClaimAttributionBridge;
  shadowTrace: MeridianEvidenceMapSummary;
  approvedClaimCount: number;
  approvedSourceCount: number;
  supportedFacetCount: number;
  requiredFacetCount: number;
  missingFacets: string[];
  message: string;
};

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

type InternalGroundingChunkRow = {
  id: string;
  title: string;
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
const MAX_GROUNDING_MATCHES = 5;

const gospelContextMap: StudentKnowledgeMatch = {
  id: "context-map-gospel",
  label: "Because you asked about the gospel",
  title: "Gospel context map",
  description:
    "Steer gospel questions through Scripture's announcement about Jesus before reducing the gospel to advice, self-improvement, private forgiveness, or a slogan. Hold together Jesus as King, Jesus saves, Jesus makes new, and Jesus forms a people for witness.",
  href: "/student/scripture/resources",
  topicTags: [
    "gospel",
    "good_news",
    "jesus",
    "kingdom",
    "cross",
    "resurrection",
    "grace",
    "salvation",
    "new_creation",
    "witness"
  ],
  scriptureReferences: [
    "Mark 1:14-15",
    "1 Corinthians 15:1-8",
    "Romans 3:21-26",
    "Ephesians 2:1-10",
    "2 Corinthians 5:17-21"
  ],
  digQuestions: [
    "What good news is being announced, and who is at the center of it?",
    "What problem does the gospel answer: guilt, shame, death, false kingdoms, broken relationship, or all of these?",
    "How does the gospel call us to receive, trust, turn, belong, and witness without reducing it to performance?"
  ]
};

const gardenContextMap: StudentKnowledgeMatch = {
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
};

const lamentContextMap: StudentKnowledgeMatch = {
  id: "context-map-lament",
  label: "Because you asked about pain",
  title: "Lament and honest trust",
  description:
    "Steer pain, grief, anxiety, and suffering questions through Scripture's permission to tell the truth, seek God's nearness, and resist forced quick answers.",
  href: "/student/scripture/resources",
  topicTags: ["suffering", "grief", "pain", "lament", "anxiety", "trust"],
  scriptureReferences: ["Psalm 13", "Psalm 22", "Romans 8:18-28", "John 11:32-36"],
  digQuestions: [
    "Where does Scripture give people room to tell the truth about pain?",
    "What does this passage reveal about God's nearness when life hurts?",
    "What would faithful hope look like without pretending the pain is small?"
  ]
};

const doubtContextMap: StudentKnowledgeMatch = {
  id: "context-map-doubt",
  label: "Because you asked honestly",
  title: "Honest questions without panic",
  description:
    "Steer doubt and deconstruction questions toward patient honesty, Scripture-shaped inquiry, wise community, and care for the question underneath the first question.",
  href: "/student/scripture/resources",
  topicTags: ["doubt", "questions", "confused", "deconstruction", "honest", "faith"],
  scriptureReferences: ["Mark 9:24", "John 20:24-29", "Psalm 73", "Jude 22"],
  digQuestions: [
    "What question seems to be underneath the first question?",
    "What would you need to understand from Scripture before answering too quickly?",
    "Who could help carry this question with honesty, humility, and care?"
  ]
};

const exodusContextMap: StudentKnowledgeMatch = {
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
};

const identityContextMap: StudentKnowledgeMatch = {
  id: "context-map-identity",
  label: "Because you asked about identity",
  title: "Belonging before performance",
  description:
    "Steer identity, worth, belonging, and comparison questions through image of God, union with Christ, adoption, embodied community, and gift before performance.",
  href: "/student/scripture/resources",
  topicTags: ["identity", "belonging", "worth", "purpose", "image", "adoption"],
  scriptureReferences: ["Genesis 1:26-28", "Ephesians 1:3-14", "Galatians 3:26-28", "1 Peter 2:9-10"],
  digQuestions: [
    "What does this passage say is given before anything is achieved?",
    "What false measure of worth is being challenged?",
    "How could the group practice belonging instead of comparison?"
  ]
};

const sexualityGenderContextMap: StudentKnowledgeMatch = {
  id: "context-map-sexuality-gender",
  label: "Because you asked about sexuality or gender",
  title: "Embodied dignity and patient care",
  description:
    "Steer sexuality and gender questions through human dignity, embodied discipleship, holiness, compassion, and leader care. Do not flatten a person into an issue or force a public group debate.",
  href: "/student/scripture/resources",
  topicTags: ["sexuality", "gender", "body", "dignity", "holiness", "pastoral_care"],
  scriptureReferences: ["Genesis 1:26-28", "Psalm 139:13-16", "Matthew 19:4-6", "1 Corinthians 6:18-20"],
  digQuestions: [
    "What does Scripture say is true about human dignity before it addresses behavior?",
    "Where would this question need gentleness, privacy, or direct leader care instead of public debate?",
    "How can we talk about holiness and compassion without turning people into projects?"
  ]
};

const hellJudgmentContextMap: StudentKnowledgeMatch = {
  id: "context-map-hell-judgment",
  label: "Because you asked about judgment",
  title: "Judgment, mercy, and God's justice",
  description:
    "Steer hell, wrath, and judgment questions through God's goodness, justice against evil, mercy in Christ, and the seriousness of human response without using fear as a shortcut.",
  href: "/student/scripture/resources",
  topicTags: ["hell", "judgment", "wrath", "justice", "mercy", "repentance"],
  scriptureReferences: ["John 3:16-21", "Romans 2:1-11", "Revelation 21:1-8", "2 Peter 3:9"],
  digQuestions: [
    "What evil or injustice would be hard to call good if God never judged it?",
    "Where does this passage hold together warning, mercy, and God's patience?",
    "How can we take judgment seriously without using fear to manipulate people?"
  ]
};

const scriptureViolenceContextMap: StudentKnowledgeMatch = {
  id: "context-map-scripture-violence",
  label: "Because you asked about violence in Scripture",
  title: "Violence, judgment, and the whole story",
  description:
    "Steer violence, conquest, slavery, and hard Old Testament questions through context, genre, God's patience and judgment, the Bible's whole story, and humility about unresolved tensions.",
  href: "/student/scripture/resources",
  topicTags: ["violence", "old_testament", "judgment", "conquest", "slavery", "tension"],
  scriptureReferences: ["Genesis 15:13-16", "Exodus 34:6-7", "Micah 6:8", "Matthew 5:38-48"],
  digQuestions: [
    "What context would we need before deciding what this passage is doing?",
    "Where do you feel the tension between God's justice, mercy, and human violence?",
    "How does Jesus shape the way we read hard passages without pretending they are easy?"
  ]
};

const prayerContextMap: StudentKnowledgeMatch = {
  id: "context-map-prayer",
  label: "Because you asked about prayer",
  title: "Prayer as honest communion",
  description:
    "Steer prayer questions through relationship with God, honest speech, waiting, dependence, and formation rather than treating prayer like a technique for guaranteed outcomes.",
  href: "/student/scripture/resources",
  topicTags: ["prayer", "waiting", "trust", "silence", "dependence", "communion"],
  scriptureReferences: ["Matthew 6:9-13", "Psalm 13", "Luke 11:1-13", "Romans 8:26-27"],
  digQuestions: [
    "What does this passage show prayer is for besides getting an outcome?",
    "Where does Scripture make room for waiting, silence, or repeated asking?",
    "How could prayer form trust even before circumstances change?"
  ]
};

const callingPurposeContextMap: StudentKnowledgeMatch = {
  id: "context-map-calling-purpose",
  label: "Because you asked about purpose",
  title: "Calling, wisdom, and faithful presence",
  description:
    "Steer calling and purpose questions through belonging to God, wisdom, gifts, ordinary faithfulness, vocation, and love of neighbor before rushing to a dramatic life plan.",
  href: "/student/scripture/resources",
  topicTags: ["calling", "purpose", "vocation", "gifts", "wisdom", "faithfulness"],
  scriptureReferences: ["Micah 6:8", "Romans 12:1-8", "Colossians 3:17", "Ephesians 2:10"],
  digQuestions: [
    "What faithful next step is already clear before the whole future is clear?",
    "Where do your gifts, responsibilities, and love of neighbor overlap right now?",
    "How does belonging to God change the pressure to discover one perfect life plan?"
  ]
};

const contextMapRoutes: Array<{ map: StudentKnowledgeMatch; pattern: RegExp }> = [
  {
    map: gospelContextMap,
    pattern: /\b(gospel|good news|salvation|saved|save me|cross|resurrection|atonement|forgiven|forgiveness|grace through faith)\b/
  },
  {
    map: lamentContextMap,
    pattern: /\b(suffer|suffering|pain|grief|grieving|death|trauma|tragedy|loss|anxiety|depression|lament)\b/
  },
  {
    map: doubtContextMap,
    pattern: /\b(doubt\w*|deconstruct\w*|unbelief|faith crisis|walk away|confus\w*|skeptic\w*)\b/
  },
  {
    map: identityContextMap,
    pattern: /\b(identity|belong|worth|image of god|comparison|performance)\b/
  },
  {
    map: sexualityGenderContextMap,
    pattern: /\b(sexuality|gender|lgbt|gay|lesbian|trans|same-sex|same sex|body|porn|purity)\b/
  },
  {
    map: hellJudgmentContextMap,
    pattern: /\b(hell|judg(e)?ment|wrath|condemn|damnation|punish|punishment)\b/
  },
  {
    map: scriptureViolenceContextMap,
    pattern: /\b(violence|genocide|slavery|conquest|canaan|canaanite|war|kill|killing|old testament violence)\b/
  },
  {
    map: prayerContextMap,
    pattern: /\b(pray|prayer|praying|silence|unanswered|ask god|talk to god)\b/
  },
  {
    map: callingPurposeContextMap,
    pattern: /\b(calling|purpose|vocation|career|future|gifts|what should i do with my life)\b/
  },
  {
    map: studentLeaderFormationMeridianContext,
    pattern: /\b(student leader|leadership|lead well|delegate|delegation|teachab\w*|feedback|serve|service|sabbath|spiritual gifts?|shared leadership)\b/
  }
];

const launchKnowledgePack: StudentKnowledgeMatch[] = [
  gospelContextMap,
  lamentContextMap,
  doubtContextMap,
  identityContextMap,
  sexualityGenderContextMap,
  hellJudgmentContextMap,
  scriptureViolenceContextMap,
  prayerContextMap,
  callingPurposeContextMap,
  studentLeaderFormationMeridianContext,
  gardenContextMap,
  exodusContextMap
];

export async function getStudentKnowledgeMatches(session: AuthSession, input: KnowledgeSearchInput): Promise<StudentKnowledgeMatch[]> {
  const liveMatches = await getLiveKnowledgeMatches(session, input);
  return applyContextMaps(input, liveMatches.length > 0 ? liveMatches : rankKnowledgeMatches(launchKnowledgePack, input));
}

export async function getStudentKnowledgeMatchesBatch(
  session: AuthSession,
  inputs: KnowledgeSearchInput[]
): Promise<StudentKnowledgeMatch[][]> {
  if (!inputs.length) return [];
  const livePack = await getLiveKnowledgePack(session);
  return inputs.map((input) => {
    const liveMatches = rankKnowledgeMatches(livePack, input).slice(0, MAX_MATCHES);
    return applyContextMaps(input, liveMatches.length > 0 ? liveMatches : rankKnowledgeMatches(launchKnowledgePack, input));
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

export async function getInternalGroundingContext(session: AuthSession, input: KnowledgeSearchInput): Promise<string> {
  // Compatibility adapter: legacy `internal_grounding` chunks are intentionally
  // no longer sent to providers. Only approved, claim-first primitive evidence
  // can cross this boundary, and students/guests never retrieve it directly.
  return (await getApprovedMeridianGrounding(session, input)).providerContext;
}

export async function getApprovedMeridianGrounding(
  session: AuthSession,
  input: KnowledgeSearchInput
): Promise<ApprovedMeridianGrounding> {
  if (!session.accessToken || !["admin", "leader", "staff"].includes(session.user.role.trim().toLowerCase())) {
    return unavailableGrounding(input, "Approved Meridian evidence is unavailable for this session.");
  }

  try {
    const ministryId = await resolveMinistryScope(session);
    if (!ministryId) return unavailableGrounding(input, "No ministry scope is available for approved Meridian evidence.");
    const prepared = await measureServerOperation("supabase.meridian.approved_evidence", () =>
      prepareMeridianGeneration(new SupabaseMeridianKnowledgeRepository(), session, {
        ministryId,
        audience: "students",
        taskType: "discussion_prompt",
        query: input.question,
        scriptureReferences: input.scriptureReference ? [input.scriptureReference] : [],
        sensitivity: "internal",
        at: new Date().toISOString(),
        externalCommunication: false
      })
    );
    const requiredFacets = prepared.pack.facetCoverage.filter((facet) => facet.required);
    const supportedFacets = requiredFacets.filter((facet) => facet.claimIds.length > 0);
    const missingFacets = requiredFacets
      .filter((facet) => facet.claimIds.length === 0)
      .map((facet) => facet.query);
    const status: MeridianGroundingStatus = prepared.decision === "abstain"
      ? supportedFacets.length > 0
        ? "partially_grounded"
        : "ungrounded"
      : "grounded";

    return {
      status,
      decision: prepared.decision,
      providerContext: status === "grounded" ? prepared.providerContext ?? "" : "",
      evidenceMap: prepared.evidenceMap,
      attributionBridge: status === "grounded" ? prepared.attributionBridge : undefined,
      shadowTrace: summarizeMeridianEvidenceMap(prepared.evidenceMap),
      approvedClaimCount: prepared.pack.approvedClaims.length,
      approvedSourceCount: prepared.pack.sources.length,
      supportedFacetCount: supportedFacets.length,
      requiredFacetCount: requiredFacets.length,
      missingFacets,
      message: groundingMessage(status, supportedFacets.length, requiredFacets.length, prepared.pack.abstentionReason)
    };
  } catch (error) {
    console.warn("[scripture] approved Meridian evidence unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return unavailableGrounding(input, "Approved Meridian evidence could not be loaded. Related resources are not being counted as answer evidence.");
  }
}

function unavailableGrounding(input: KnowledgeSearchInput, message: string): ApprovedMeridianGrounding {
  const scriptureReferences = input.scriptureReference ? [input.scriptureReference] : [];
  return {
    status: "unavailable",
    decision: "unavailable",
    providerContext: "",
    shadowTrace: unavailableMeridianEvidenceMapSummary({
      intentRoute: classifyMeridianIntent(input.question, scriptureReferences),
      suppliedScriptureAnchors: scriptureReferences,
      requirements: deriveMeridianResponseRequirements(input.question),
      reason: message
    }),
    approvedClaimCount: 0,
    approvedSourceCount: 0,
    supportedFacetCount: 0,
    requiredFacetCount: 0,
    missingFacets: [],
    message
  };
}

function groundingMessage(
  status: MeridianGroundingStatus,
  supportedFacetCount: number,
  requiredFacetCount: number,
  abstentionReason?: string
) {
  if (status === "grounded") {
    return `Approved evidence covers ${supportedFacetCount} of ${requiredFacetCount} required question parts.`;
  }
  if (status === "partially_grounded") {
    return `Approved evidence covers ${supportedFacetCount} of ${requiredFacetCount} required question parts. Meridian withheld it from generation because coverage is incomplete.`;
  }
  return abstentionReason || "No approved, generation-permitted evidence covers the required question parts.";
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

function applyContextMaps(input: KnowledgeSearchInput, matches: StudentKnowledgeMatch[]) {
  const contextMaps = contextMapsForInput(input);
  return uniqueKnowledgeMatches([...contextMaps, ...matches]).slice(0, MAX_MATCHES);
}

function contextMapsForInput(input: KnowledgeSearchInput) {
  const text = searchText(input);
  return contextMapRoutes.filter((route) => route.pattern.test(text)).map((route) => route.map);
}

function isGospelContextQuestion(input: KnowledgeSearchInput) {
  return contextMapRoutes[0]?.pattern.test(searchText(input)) ?? false;
}

function searchText(input: KnowledgeSearchInput) {
  return `${input.question} ${input.scriptureReference ?? ""} ${(input.topicTags ?? []).join(" ")}`.toLowerCase();
}

function uniqueKnowledgeMatches(matches: StudentKnowledgeMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = match.sourceChunkId ? `chunk:${match.sourceChunkId}` : `id:${match.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  if (isGospelContextQuestion({
    question: body,
    scriptureReference: row.scripture_references?.join(" "),
    topicTags: row.topic_tags ?? []
  })) {
    return gospelContextMap.digQuestions;
  }

  if (/\b(garden|eden|tree|creation)\b/.test(body)) {
    return gardenContextMap.digQuestions;
  }

  if (/\b(lament|grief|suffering|pain)\b/.test(body)) {
    return lamentContextMap.digQuestions;
  }

  if (/\b(exodus|deliverance|wilderness)\b/.test(body)) {
    return exodusContextMap.digQuestions;
  }

  return [
    "What is happening in the passage or story behind this question?",
    "What does this reveal about God, people, brokenness, or hope?",
    "How could your group respond together without forcing a quick answer?"
  ];
}

function rankInternalGrounding(rows: InternalGroundingChunkRow[], input: KnowledgeSearchInput) {
  const queryText = `${input.question} ${input.scriptureReference ?? ""} ${(input.topicTags ?? []).join(" ")}`;
  const queryTokens = tokenize(queryText);

  return rows
    .map((row, index) => ({
      row,
      score: scoreInternalGrounding(row, queryTokens, queryText.toLowerCase(), index)
    }))
    .filter((item) => item.score > 0 || queryTokens.size === 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
}

function scoreInternalGrounding(row: InternalGroundingChunkRow, queryTokens: Set<string>, queryText: string, index: number) {
  const tags = normalizeList(row.topic_tags);
  const concepts = normalizeList(row.concepts);
  const references = normalizeList(row.scripture_references);
  const text = `${row.student_summary ?? ""} ${tags.join(" ")} ${concepts.join(" ")} ${references.join(" ")}`.toLowerCase();
  const tokens = tokenize(text);
  let score = Math.max(0, 5 - index) * 0.01;

  for (const token of Array.from(queryTokens)) {
    if (tokens.has(token)) score += 2;
  }

  for (const tag of [...tags, ...concepts]) {
    if (queryText.includes(tag.toLowerCase())) score += 4;
  }

  for (const reference of references) {
    const book = reference.toLowerCase().split(/\s+/)[0];
    if (book && queryText.includes(book)) score += 3;
  }

  return score;
}

function formatInternalGroundingContext(rows: InternalGroundingChunkRow[]) {
  if (!rows.length) return "";

  return rows
    .map((row, index) => {
      const summary = limitText(row.student_summary ?? "", 520);
      const tags = normalizeList([...(row.topic_tags ?? []), ...(row.concepts ?? [])]).slice(0, 8);
      const references = normalizeList(row.scripture_references).slice(0, 6);
      return [
        `Grounding signal ${index + 1}:`,
        summary ? `Synthesis: ${summary}` : "",
        tags.length ? `Posture tags: ${tags.join(", ")}` : "",
        references.length ? `Biblical neighborhood: ${references.join(", ")}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
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
