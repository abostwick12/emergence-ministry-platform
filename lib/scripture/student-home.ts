import { scripturePlans, scriptureResources } from "@/lib/scripture/mock-data";
import { matchCuratedResourcesToPrompt, type StudentCuratedResource } from "@/lib/scripture/curated-resource-shared";
import type { StudentKnowledgeMatch, StudentSavedQuestionRecommendation } from "@/lib/scripture/knowledge";
import { matchQuestionToStoryline, type StorylineQuestionMatch } from "@/lib/scripture/storyline-guide";
import type { ScripturePlan, ScriptureResource, StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";

export type StudentGroupDiscussionItem = {
  id: string;
  groupId?: string;
  question: string;
  scriptureReference: string;
  discussionPrompt: string;
  status: Extract<StudentDiscussionStatus, "approved" | "posted">;
  createdAt: string;
  leaderDiscussedAt?: string;
};

export type StudentKeepReadingItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
};

export type StudentResourceStep = {
  id: "read" | "journal" | "group";
  label: string;
  title: string;
  description: string;
  href: string;
  sourceLabel: string;
};

export type StudentJourneyQuestion = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
};

export type StudentJourneyReading = {
  id: string;
  reference: string;
  lookupReference: string;
  title: string;
  guidance: string;
  practice: string;
};

export type StudentJourneyKeyword = {
  term: string;
  transliteration?: string;
  originalLanguage?: string;
  lexicalUrl?: string;
  meaning: string;
  invitation: string;
};

export type StudentGuidedPrayer = {
  title: string;
  durationLabel: string;
  backgroundHint: string;
  prompts: string[];
};

export type StudentJourneyPractice = {
  title: string;
  summary: string;
  steps: string[];
  reflectionPrompt: string;
  guidedPrayer?: StudentGuidedPrayer;
};

export type StudentJourneyJournal = {
  id: string;
  title: string;
  subtitle: string;
  openingPrompt: string;
  followUpQuestions: StudentJourneyQuestion[];
  readingPath: StudentJourneyReading[];
  keyWords: StudentJourneyKeyword[];
  spiritualPractice: StudentJourneyPractice;
};

export type StudentQuestionNextStep = {
  promptId: string;
  label: string;
  title: string;
  summary: string;
  careNote?: string;
  knowledgeMatches: StudentKnowledgeMatch[];
  curatedResources: StudentCuratedResource[];
  wrestleQuestions: string[];
  digQuestions: string[];
  journalPrompts: string[];
  prayerPrompts: string[];
  wrestleTogetherPrompt: string;
  readingPlan: StudentKeepReadingItem;
  resource: StudentKeepReadingItem;
  resourceSteps: StudentResourceStep[];
  storylineMatch: StorylineQuestionMatch;
  journeyJournal: StudentJourneyJournal;
  journeyJournalEntries: StudentJourneyJournal[];
};

export type StudentHomeFeed = {
  forGroup: StudentGroupDiscussionItem[];
  recentQuestions: StudentDiscussionPrompt[];
  keepReading: StudentKeepReadingItem[];
  questionNextSteps: StudentQuestionNextStep[];
  groupNextSteps: StudentQuestionNextStep[];
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
  savedRecommendations: Record<string, StudentSavedQuestionRecommendation[]> = {},
  curatedResources: StudentCuratedResource[] = []
): StudentHomeFeed {
  const recentQuestions = prompts.filter((prompt) => prompt.submittedByUserId === userId).slice(0, 4);
  const forGroup = approvedGroupPrompts.slice(0, 4);
  const questionNextSteps = recentQuestions.map((prompt) => {
    return (
      savedRecommendationsToNextStep(prompt, savedRecommendations[prompt.id], curatedResources) ??
      buildQuestionNextStep(prompt, prompt.knowledgeContext ?? [], { curatedResources })
    );
  });
  const groupNextSteps = forGroup.map((prompt) => buildGroupDiscussionNextStep(prompt, { curatedResources }));

  return {
    forGroup,
    recentQuestions,
    keepReading: buildKeepReadingItems(recentQuestions, forGroup, [...questionNextSteps, ...groupNextSteps]),
    questionNextSteps,
    groupNextSteps
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
      createdAt: prompt.createdAt,
      ...(prompt.leaderDiscussedAt ? { leaderDiscussedAt: prompt.leaderDiscussedAt } : {})
    }));
}

export function buildQuestionNextStep(
  prompt: ReadingSource & { id?: string },
  knowledgeMatches: StudentKnowledgeMatch[] = [],
  options: { curatedResources?: StudentCuratedResource[] } = {}
): StudentQuestionNextStep {
  const resource = resourceForPrompt(prompt) ?? scriptureResources.find((item) => item.id === "better-questions") ?? scriptureResources[0];
  const topic = topicLabelForPrompt(prompt);
  const primaryKnowledge = knowledgeMatches[0];
  const secondaryKnowledge = knowledgeMatches[1];
  const storylineMatch = matchQuestionToStoryline(prompt);
  const wrestleQuestions = wrestleQuestionsForPrompt(prompt);
  const promptDigQuestions = digQuestionsForPrompt(prompt);
  const digQuestions = primaryKnowledge?.digQuestions?.length
    ? primaryKnowledge.digQuestions
    : isGospelQuestion(promptSearchText(prompt))
      ? promptDigQuestions
      : uniqueQuestions([...storylineMatch.studentQuestions, ...promptDigQuestions], 3);
  const journalPrompts = journalPromptsForPrompt(prompt);
  const prayerPrompts = prayerPromptsForPrompt(prompt);
  const wrestleTogetherPrompt = wrestleTogetherPromptForPrompt(prompt, primaryKnowledge);
  const readingPlan = primaryKnowledge ? knowledgeItem(primaryKnowledge, primaryKnowledge.label) : storylineItem(storylineMatch);
  const nextResource = secondaryKnowledge ? knowledgeItem(secondaryKnowledge, "Keep digging") : resourceItem(resource, "Practice this");
  const baseJourneyJournal = buildJourneyJournal(prompt, storylineMatch, primaryKnowledge);
  const journeyJournalEntries = buildJourneyJournalEntries(prompt, storylineMatch, primaryKnowledge, baseJourneyJournal);
  const journeyJournal = journeyJournalEntries[0] ?? baseJourneyJournal;
  const curatedResources = matchCuratedResourcesToPrompt(
    {
      question: prompt.question,
      scriptureReference: prompt.scriptureReference,
      topicTags: prompt.topicTags
    },
    options.curatedResources ?? []
  );

  return {
    promptId: prompt.id ?? "current-question",
    label: primaryKnowledge?.label ?? (topic ? `Because you asked about ${topic}` : storylineMatch.label),
    title: "Wrestle with your question",
    summary:
      primaryKnowledge?.description ??
      storylineMatch.studentSummary ??
      "Your leader can still shape this for group discussion, but you do not have to wait to start seeking carefully.",
    careNote: careNoteForPrompt(prompt),
    knowledgeMatches: knowledgeMatches.slice(0, 3),
    curatedResources,
    wrestleQuestions,
    digQuestions,
    journalPrompts,
    prayerPrompts,
    wrestleTogetherPrompt,
    readingPlan,
    resource: nextResource,
    resourceSteps: buildResourceSteps({
      prompt,
      primaryKnowledge,
      readingPlan,
      resource: nextResource,
      journalPrompts,
      storylineMatch,
      wrestleTogetherPrompt
    }),
    storylineMatch,
    journeyJournal,
    journeyJournalEntries
  };
}

export function buildGroupDiscussionNextStep(
  prompt: StudentGroupDiscussionItem,
  options: { curatedResources?: StudentCuratedResource[] } = {}
): StudentQuestionNextStep {
  const wasDiscussed = Boolean(prompt.leaderDiscussedAt);
  const base = buildQuestionNextStep({
    id: prompt.id,
    question: `${prompt.question} ${prompt.discussionPrompt}`,
    scriptureReference: prompt.scriptureReference
  }, [], options);

  return {
    ...base,
    promptId: prompt.id,
    label: wasDiscussed ? "Discussed with your group" : prompt.status === "posted" ? "Shared with your group" : "Next for your group",
    title: wasDiscussed ? "Practice what you heard" : "Keep walking this out",
    summary: wasDiscussed
      ? "Your group has discussed this question. Return to Scripture, choose one practice, and notice the fruit forming this week."
      : "This leader-approved question is for your group. Read, reflect, and come ready to listen and respond together.",
    wrestleTogetherPrompt: prompt.discussionPrompt || base.wrestleTogetherPrompt
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
  recommendations: StudentSavedQuestionRecommendation[] | undefined,
  curatedResources: StudentCuratedResource[] = []
): StudentQuestionNextStep | undefined {
  if (!recommendations?.length) return undefined;

  const sorted = [...recommendations].sort((a, b) => a.rank - b.rank);
  const wrestleQuestions = sorted.filter((item) => item.kind === "wrestle_question").map((item) => item.title).filter(Boolean).slice(0, 4);
  const digQuestions = sorted.filter((item) => item.kind === "dig_question").map((item) => item.title).filter(Boolean).slice(0, 3);
  const journalPrompts = sorted.filter((item) => item.kind === "journal_prompt").map((item) => item.title).filter(Boolean).slice(0, 3);
  const prayerPrompts = sorted.filter((item) => item.kind === "prayer_prompt").map((item) => item.title).filter(Boolean).slice(0, 3);
  const wrestleTogether = sorted.find((item) => item.kind === "wrestle_together");
  const readingPlan = sorted.find((item) => item.kind === "reading_plan");
  const resource = sorted.find((item) => item.kind === "resource" || item.kind === "scripture_lookup");
  const fallback = buildQuestionNextStep(prompt, prompt.knowledgeContext ?? [], { curatedResources });
  const firstRecommendation = sorted[0];
  const readingPlanItem = readingPlan ? recommendationItem(readingPlan, prompt.id) : fallback.readingPlan;
  const resourceItem = resource ? recommendationItem(resource, prompt.id) : fallback.resource;
  const journeyJournalEntries = personalizeJourneyEntries(fallback.journeyJournalEntries, {
    wrestleQuestions,
    digQuestions,
    journalPrompts,
    prayerPrompts
  });

  return {
    promptId: prompt.id,
    label: firstRecommendation?.label || fallback.label,
    title: "Keep digging before group",
    summary:
      readingPlan?.description ||
      resource?.description ||
      "These next steps were saved from your question so you can wrestle, read, reflect, and pray while your leader reviews it.",
    careNote: fallback.careNote,
    knowledgeMatches: fallback.knowledgeMatches,
    curatedResources: fallback.curatedResources,
    wrestleQuestions: wrestleQuestions.length ? wrestleQuestions : fallback.wrestleQuestions,
    digQuestions: digQuestions.length ? digQuestions : fallback.digQuestions,
    journalPrompts: journalPrompts.length ? journalPrompts : fallback.journalPrompts,
    prayerPrompts: prayerPrompts.length ? prayerPrompts : fallback.prayerPrompts,
    wrestleTogetherPrompt: wrestleTogether?.title || fallback.wrestleTogetherPrompt,
    readingPlan: readingPlanItem,
    resource: resourceItem,
    resourceSteps: buildResourceSteps({
      prompt,
      primaryKnowledge: fallback.knowledgeMatches[0],
      readingPlan: readingPlanItem,
      resource: resourceItem,
      journalPrompts: journalPrompts.length ? journalPrompts : fallback.journalPrompts,
      storylineMatch: fallback.storylineMatch,
      wrestleTogetherPrompt: wrestleTogether?.title || fallback.wrestleTogetherPrompt
    }),
    storylineMatch: fallback.storylineMatch,
    journeyJournal: journeyJournalEntries[0] ?? fallback.journeyJournal,
    journeyJournalEntries
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
      title: "Bible App reader",
      description: "Open a passage with YouVersion tools before group so the conversation starts with Scripture.",
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

function storylineItem(match: StorylineQuestionMatch): StudentKeepReadingItem {
  return {
    id: `storyline-${match.id}`,
    label: match.label,
    title: match.title,
    description: match.studentSummary,
    href: "/student/scripture/resources"
  };
}

function buildResourceSteps({
  prompt,
  primaryKnowledge,
  readingPlan,
  resource,
  journalPrompts,
  storylineMatch,
  wrestleTogetherPrompt
}: {
  prompt: ReadingSource;
  primaryKnowledge?: StudentKnowledgeMatch;
  readingPlan: StudentKeepReadingItem;
  resource: StudentKeepReadingItem;
  journalPrompts: string[];
  storylineMatch: StorylineQuestionMatch;
  wrestleTogetherPrompt: string;
}): StudentResourceStep[] {
  const sourceLabel = primaryKnowledge?.sourceChunkId ? "Leader-curated guide" : "Starter guide";
  const groupPrompt = stripBringToGroupPrefix(wrestleTogetherPrompt);

  return [
    {
      id: "read",
      label: "Read this next",
      title: readingPlan.title,
      description: primaryKnowledge
        ? readingPlan.description
        : `Start with ${readingPlan.title} before trying to answer this question quickly.`,
      href: readingPlan.href,
      sourceLabel
    },
    {
      id: "journal",
      label: "Journal on this",
      title: journalPrompts[0] ?? "What are you noticing?",
      description: primaryKnowledge
        ? `Use ${resource.title} to slow down and name what you are seeing.`
        : `Connect your question to ${storylineMatch.title} and write what still feels unresolved.`,
      href: "/student",
      sourceLabel: "Private reflection"
    },
    {
      id: "group",
      label: "Bring this to group",
      title: groupPrompt,
      description: prompt.scriptureReference
        ? `Bring ${prompt.scriptureReference} with the question so your group starts from the text.`
        : "Bring one observation, one unresolved question, and one honest response to the discussion.",
      href: "/student",
      sourceLabel: "Wrestle together"
    }
  ];
}

function buildJourneyJournal(
  prompt: ReadingSource,
  storylineMatch: StorylineQuestionMatch,
  primaryKnowledge?: StudentKnowledgeMatch
): StudentJourneyJournal {
  const text = promptSearchText(prompt);
  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return {
      id: "garden-question-journey",
      title: "Garden Question Journey",
      subtitle: "Walk slowly through Genesis 1-3 before settling for a quick answer.",
      openingPrompt: "Start by naming the explanations you have heard, then read the garden story as a story about gift, vocation, trust, rupture, and God's pursuit.",
      followUpQuestions: [
        {
          id: "heard-before",
          label: "What answers have you heard before?",
          prompt: "Name the explanations people usually give for the tree, the command, and human choice.",
          placeholder: "It was a test, free will, choice, conflict..."
        },
        {
          id: "still-incomplete",
          label: "Why do those answers still feel incomplete?",
          prompt: "What do those explanations miss about God's character, the good garden, or human vocation?",
          placeholder: "They do not explain why the story begins with so much abundance..."
        },
        {
          id: "notice-gifts",
          label: "What do you notice before the command?",
          prompt: "List the gifts, blessings, and responsibilities God gives before the warning about the tree appears.",
          placeholder: "Image of God, food, blessing, work, keeping the garden..."
        }
      ],
      readingPath: [
        {
          id: "genesis-1-image",
          reference: "Genesis 1:26-31",
          lookupReference: "Genesis 1:26",
          title: "Gift and image before the problem",
          guidance: "Notice blessing, image, vocation, food, and God's repeated judgment that creation is good.",
          practice: "Write one sentence about what God gives before anyone has earned it."
        },
        {
          id: "genesis-2-vocation",
          reference: "Genesis 2:4-17",
          lookupReference: "Genesis 2:15",
          title: "The garden as vocation and trust",
          guidance: "Read the command inside abundance. Pay attention to the work of serving and guarding the garden.",
          practice: "Ask what trust would look like before sin enters the scene."
        },
        {
          id: "genesis-3-rupture",
          reference: "Genesis 3:1-13",
          lookupReference: "Genesis 3",
          title: "Desire, hiding, and God's pursuit",
          guidance: "Notice the movement from questioning God's goodness to shame, hiding, and God seeking them.",
          practice: "Name one place where distrust changes how people see God, themselves, or each other."
        },
        {
          id: "genesis-3-mercy",
          reference: "Genesis 3:14-24",
          lookupReference: "Genesis 3:14",
          title: "Judgment, mercy, and hope",
          guidance: "Look for both real consequences and signs that God has not abandoned the story.",
          practice: "Write one question you still want to bring to your leader or group."
        }
      ],
      keyWords: [
        {
          term: "work / serve",
          transliteration: "abad",
          originalLanguage: "עָבַד",
          lexicalUrl: "https://www.blueletterbible.org/lexicon/h5647/kjv/wlc/0-1/",
          meaning: "The garden task is more than busywork. The word can carry the sense of serving.",
          invitation: "Ask how human vocation might be worshipful service before it becomes toil."
        },
        {
          term: "keep / guard",
          transliteration: "shamar",
          originalLanguage: "שָׁמַר",
          lexicalUrl: "https://www.blueletterbible.org/lexicon/h8104/kjv/wlc/0-1/",
          meaning: "Humans are invited to keep, watch, and guard what God gives.",
          invitation: "Reflect on what it means that trust includes guarding God's good gift."
        },
        {
          term: "wind / breeze of the day",
          transliteration: "ruach hayom",
          originalLanguage: "רוּחַ הַיּוֹם",
          lexicalUrl: "https://www.blueletterbible.org/lexicon/h7307/kjv/wlc/0-1/",
          meaning: "Genesis describes God drawing near in the garden. Read carefully and avoid overclaiming the phrase.",
          invitation: "Let the scene invite imagination about God's nearness without turning every detail into a theory."
        }
      ],
      spiritualPractice: {
        title: "Walk the garden slowly",
        summary: "Take a silent walk, pay attention to creation, and imagine what it would mean to walk with God without hiding.",
        steps: [
          "Walk without music or scrolling for five minutes.",
          "Name three gifts in creation before asking your question again.",
          "Ask God where distrust or fear may be shaping the way you hear His command.",
          "End by praying one honest sentence about trust."
        ],
        reflectionPrompt: "What would trust feel like if God's command came inside abundance, not scarcity?",
        guidedPrayer: {
          title: "Pause in the garden",
          durationLabel: "2 minute prayer",
          backgroundHint: "Quiet evening walk",
          prompts: [
            "Slowly inhale and remember that God made a good world.",
            "As you exhale, release the pressure to solve the whole question at once.",
            "Ask: God, what have You given before You command?",
            "Invite God to meet you without hiding."
          ]
        }
      }
    };
  }

  const primaryPassage = prompt.scriptureReference || primaryKnowledge?.scriptureReferences?.[0] || storylineMatch.keyPassages[0] || "Genesis 1";
  const followUpQuestions = uniqueQuestions([...wrestleQuestionsForPrompt(prompt), ...storylineMatch.studentQuestions], 3);
  const passages = uniqueQuestions([primaryPassage, ...storylineMatch.keyPassages], 3);
  const topic = topicLabelForPrompt(prompt) || storylineMatch.title.toLowerCase();

  return {
    id: `journey-${storylineMatch.id}`,
    title: `${storylineMatch.title} Journey`,
    subtitle: "A guided way to read, ask better questions, pray, and bring something thoughtful to group.",
    openingPrompt: `Do not rush to an answer. Start with Scripture, then notice what this question reveals about ${topic}, God's character, people, brokenness, and hope.`,
    followUpQuestions: followUpQuestions.map((question, index) => ({
      id: `follow-up-${index + 1}`,
      label: index === 0 ? "What are you really asking?" : index === 1 ? "What feels unresolved?" : "What should you look for?",
      prompt: question,
      placeholder: index === 0 ? "I am wondering..." : index === 1 ? "This still feels hard because..." : "I want to notice..."
    })),
    readingPath: passages.map((reference, index) => ({
      id: `reading-${index + 1}`,
      reference,
      lookupReference: lookupReferenceFor(reference),
      title: index === 0 ? "Start with the closest passage" : index === 1 ? "Trace the storyline" : "Bring it toward hope",
      guidance: readingGuidanceFor(storylineMatch, index),
      practice: readingPracticeFor(storylineMatch, index)
    })),
    keyWords: keyWordsForJourney(storylineMatch),
    spiritualPractice: practiceForJourney(prompt, storylineMatch)
  };
}

function buildJourneyJournalEntries(
  prompt: ReadingSource,
  storylineMatch: StorylineQuestionMatch,
  primaryKnowledge: StudentKnowledgeMatch | undefined,
  baseJourney: StudentJourneyJournal
): StudentJourneyJournal[] {
  const text = promptSearchText(prompt);
  if (isGospelQuestion(text)) return buildGospelJourneyEntries();

  const primaryPassage = prompt.scriptureReference || primaryKnowledge?.scriptureReferences?.[0] || storylineMatch.keyPassages[0] || "Genesis 1";
  const secondaryPassages = uniqueQuestions([...storylineMatch.keyPassages.slice(1), primaryPassage, ...storylineMatch.keyPassages], 3);
  const practicePassages = uniqueQuestions([...storylineMatch.keyPassages.slice(2), primaryPassage, ...storylineMatch.keyPassages], 3);
  const topic = topicLabelForPrompt(prompt) || storylineMatch.title.toLowerCase();

  return [
    baseJourney,
    {
      ...baseJourney,
      id: `${baseJourney.id}-investigate`,
      title: `${storylineMatch.title} Investigation`,
      subtitle: "A second pass that looks underneath the first answer and checks context before application.",
      openingPrompt: `Now investigate the question more carefully. Ask what the passage actually says about ${topic}, what it does not say, and what needs more context.`,
      followUpQuestions: toJourneyQuestions(
        uniqueQuestions([...digQuestionsForPrompt(prompt), ...storylineMatch.studentQuestions], 3),
        "investigate",
        ["What does the text show?", "What context matters?", "What should stay unresolved?"],
        ["I notice...", "Before and after this passage...", "I should not rush..."]
      ),
      readingPath: buildReadingPathFromReferences(secondaryPassages, storylineMatch, [
        "Read the wider context",
        "Check the storyline connection",
        "Hold the question near Jesus"
      ]),
      keyWords: investigativeKeywords(storylineMatch),
      spiritualPractice: {
        title: "Map the question honestly",
        summary: "Separate what Scripture says, what you assume, and what you still need help understanding.",
        steps: [
          "Draw three columns: text, assumptions, and questions.",
          "Put one observation from the passage in the text column.",
          "Put one thing you may have assumed in the assumptions column.",
          "Bring one unresolved question to a leader or group."
        ],
        reflectionPrompt: "What changed when you separated the passage from your assumptions?",
        guidedPrayer: {
          title: "Prayer for careful attention",
          durationLabel: "2 minute prayer",
          backgroundHint: "Open Bible and a notebook",
          prompts: [
            "Ask God for patience before you answer.",
            "Name one assumption you are willing to let Scripture test.",
            "Ask for wisdom to hold what is clear and what is still unresolved.",
            "Pray for courage to bring the question into community."
          ]
        }
      }
    },
    {
      ...baseJourney,
      id: `${baseJourney.id}-practice`,
      title: `${storylineMatch.title} Practice`,
      subtitle: "A third pass that turns careful reading into one embodied response this week.",
      openingPrompt: `Do not leave the question as an idea only. Ask what faithful response fits this passage and this season of your life.`,
      followUpQuestions: toJourneyQuestions(
        uniqueQuestions([...journalPromptsForPrompt(prompt), ...wrestleQuestionsForPrompt(prompt)], 3),
        "practice",
        ["What is God forming?", "What response fits?", "Who should hear this?"],
        ["I think God may be forming...", "A faithful next step could be...", "I should bring this to..."]
      ),
      readingPath: buildReadingPathFromReferences(practicePassages, storylineMatch, [
        "Read for response",
        "Read with your group in mind",
        "Read toward hope"
      ]),
      keyWords: responseKeywords(storylineMatch),
      spiritualPractice: practiceForJourney(prompt, storylineMatch)
    },
    {
      ...baseJourney,
      id: `${baseJourney.id}-community`,
      title: `${storylineMatch.title} Community Path`,
      subtitle: "A fourth pass that prepares one thoughtful contribution for group discussion.",
      openingPrompt: "Prepare to bring something honest and useful to group: one observation, one question, and one response you are willing to practice.",
      followUpQuestions: toJourneyQuestions(
        uniqueQuestions([stripBringToGroupPrefix(wrestleTogetherPromptForPrompt(prompt, primaryKnowledge)), ...digQuestionsForPrompt(prompt)], 3),
        "community",
        ["What will you bring?", "What help do you need?", "What could we practice together?"],
        ["I can bring...", "I need help with...", "Our group could..."]
      ),
      readingPath: buildReadingPathFromReferences(uniqueQuestions([primaryPassage, ...storylineMatch.keyPassages].reverse(), 3), storylineMatch, [
        "Re-read the anchor passage",
        "Listen for the group question",
        "Name one shared practice"
      ]),
      keyWords: communityKeywords(),
      spiritualPractice: {
        title: "Prepare a group contribution",
        summary: "Turn the journal into one humble sentence you can actually say out loud.",
        steps: [
          "Write one sentence that starts with: I noticed...",
          "Write one sentence that starts with: I still wonder...",
          "Write one sentence that starts with: I think we could practice...",
          "Bring those three sentences to group."
        ],
        reflectionPrompt: "What would help your group seek a faithful answer together?",
        guidedPrayer: {
          title: "Prayer before group",
          durationLabel: "2 minute prayer",
          backgroundHint: "Quiet before conversation",
          prompts: [
            "Ask God for humility to listen.",
            "Ask God for courage to be honest.",
            "Ask God to protect the group from quick answers.",
            "Ask God to form real fruit from the conversation."
          ]
        }
      }
    }
  ];
}

function buildGospelJourneyEntries(): StudentJourneyJournal[] {
  return [
    {
      id: "gospel-scripture-journey",
      title: "Gospel Scripture Journey",
      subtitle: "Start with what Scripture announces before reducing the gospel to a slogan.",
      openingPrompt: "Ask what good news is being announced, who Jesus is, what problem He answers, and what response the announcement invites.",
      followUpQuestions: [
        {
          id: "gospel-announcement",
          label: "What is being announced?",
          prompt: "What does the passage call good news, and who is at the center of it?",
          placeholder: "The good news is..."
        },
        {
          id: "gospel-problem",
          label: "What problem does it answer?",
          prompt: "What does this passage reveal about sin, death, separation, injustice, or false kingdoms?",
          placeholder: "The problem underneath the good news is..."
        },
        {
          id: "gospel-response",
          label: "What response is invited?",
          prompt: "Where do you see repentance, faith, allegiance, joy, witness, or worship?",
          placeholder: "The response I see is..."
        }
      ],
      readingPath: [
        gospelReading("mark-1-good-news", "Mark 1:14-15", "Jesus announces good news", "Notice that Jesus connects gospel, kingdom, repentance, and belief.", "Write the announcement in one sentence."),
        gospelReading("corinthians-15-center", "1 Corinthians 15:1-8", "Death and resurrection at the center", "Watch how Paul summarizes the gospel around Jesus' death, burial, resurrection, witnesses, and grace.", "Circle what Paul says is of first importance."),
        gospelReading("romans-3-grace", "Romans 3:21-26", "Grace, justice, and faith", "Read slowly for righteousness, grace, redemption, faith, and what God does through Jesus.", "Name one word you need help understanding.")
      ],
      keyWords: [
        gospelKeyword("gospel", "euangelion", "Good news announced as public reality, not merely advice or private inspiration.", "Ask what has happened in Jesus that changes reality."),
        gospelKeyword("kingdom", "basileia", "God's reign arriving in and through Jesus.", "Ask how the gospel calls for allegiance, not just agreement."),
        gospelKeyword("grace", "charis", "God's generous favor that rescues rather than rewards our earning.", "Ask where the passage shows gift before response.")
      ],
      spiritualPractice: {
        title: "Summarize the announcement",
        summary: "Write the gospel as news about Jesus before writing what it means for you.",
        steps: [
          "Write one sentence beginning: The good news is that Jesus...",
          "Write one sentence naming the problem Jesus answers.",
          "Write one sentence naming the response Scripture invites.",
          "Ask a leader whether your summary stayed anchored in the passages."
        ],
        reflectionPrompt: "How is gospel different from advice, self-improvement, or just being nicer?",
        guidedPrayer: {
          title: "Receive good news",
          durationLabel: "2 minute prayer",
          backgroundHint: "Open hands and Scripture",
          prompts: [
            "Thank Jesus for what He has done before naming what you should do.",
            "Confess where you reduce the gospel to advice or performance.",
            "Ask for faith to receive grace honestly.",
            "Ask for courage to keep learning the whole story."
          ]
        }
      }
    },
    {
      id: "gospel-investigation-journey",
      title: "Gospel Investigation Journey",
      subtitle: "Look underneath the word gospel and trace what it restores.",
      openingPrompt: "Now ask how the gospel reaches guilt, shame, broken relationships, identity, mission, and creation instead of only answering one narrow question.",
      followUpQuestions: [
        {
          id: "gospel-scope",
          label: "How big is the gospel?",
          prompt: "Where does the passage show personal rescue, a new people, mission, or new creation hope?",
          placeholder: "The scope seems bigger because..."
        },
        {
          id: "gospel-grace-works",
          label: "How do grace and response fit?",
          prompt: "What does the passage say God does, and what response follows because of grace?",
          placeholder: "God acts first by..."
        },
        {
          id: "gospel-reconciliation",
          label: "What is restored?",
          prompt: "What relationships are being reconciled: with God, others, self, or the world?",
          placeholder: "The restoration I notice is..."
        }
      ],
      readingPath: [
        gospelReading("ephesians-2-grace", "Ephesians 2:1-10", "Grace that creates a new life", "Notice the movement from death to mercy to workmanship and good works.", "Underline what God does before any human boasting."),
        gospelReading("corinthians-5-reconcile", "2 Corinthians 5:17-21", "Reconciliation and new creation", "Watch how new creation and reconciliation belong together in Christ.", "Write who is reconciled and who becomes a witness."),
        gospelReading("luke-4-good-news", "Luke 4:16-21", "Good news for the poor", "Listen to the kingdom-shaped scope of Jesus' announcement.", "Name who the good news reaches in this scene.")
      ],
      keyWords: [
        gospelKeyword("reconciliation", "katallage", "Restored relationship made possible by God's action in Christ.", "Ask what hostility or distance the gospel overcomes."),
        gospelKeyword("faith", "pistis", "Trust, allegiance, and reliance rather than bare information.", "Ask what trusting Jesus would mean in real life."),
        gospelKeyword("new creation", "kaine ktisis", "God beginning renewal in Christ, not merely improving old habits.", "Ask what has become new and what is still being made new.")
      ],
      spiritualPractice: {
        title: "Draw the gospel map",
        summary: "Map what the gospel restores so your answer is bigger than a formula.",
        steps: [
          "Draw four circles: God, people, creation, mission.",
          "Place one phrase from today's readings in each circle.",
          "Mark the circle that feels most disconnected in your life right now.",
          "Pray one sentence asking Jesus to restore that place."
        ],
        reflectionPrompt: "Where did the gospel become bigger than the answer you expected?",
        guidedPrayer: {
          title: "Prayer for restored life",
          durationLabel: "3 minute prayer",
          backgroundHint: "Notebook map",
          prompts: [
            "Name one place you need reconciliation with God.",
            "Name one place you need reconciliation with another person.",
            "Ask Jesus to make you a faithful witness, not a polished performer.",
            "Thank God that grace creates a new life."
          ]
        }
      }
    },
    {
      id: "gospel-practice-journey",
      title: "Gospel Practice Journey",
      subtitle: "Move from definition to repentance, trust, witness, and worship.",
      openingPrompt: "Let the gospel question become personal without making it only private. Ask what Jesus is inviting you to receive, turn from, trust, and share.",
      followUpQuestions: [
        {
          id: "gospel-repent",
          label: "Where is repentance invited?",
          prompt: "What false hope, false kingdom, or self-saving strategy might Jesus be exposing?",
          placeholder: "I may need to turn from..."
        },
        {
          id: "gospel-trust",
          label: "Where is trust invited?",
          prompt: "What part of Jesus' work do you need to receive rather than earn?",
          placeholder: "I need to trust that Jesus..."
        },
        {
          id: "gospel-witness",
          label: "How could you witness humbly?",
          prompt: "How could you explain the gospel without pressure, performance, or winning an argument?",
          placeholder: "I could say..."
        }
      ],
      readingPath: [
        gospelReading("romans-10-response", "Romans 10:9-13", "Confession, trust, and rescue", "Notice mouth, heart, Lordship, resurrection, and the wideness of the invitation.", "Write one honest confession of trust."),
        gospelReading("luke-15-grace", "Luke 15:11-32", "Grace that welcomes and confronts", "Read both sons carefully so grace does not become sentimental or self-righteous.", "Ask which son you relate to today."),
        gospelReading("matthew-28-witness", "Matthew 28:18-20", "Good news becomes discipleship", "Watch authority, going, baptizing, teaching, obedience, and Jesus' presence.", "Name one way witness could become discipleship.")
      ],
      keyWords: [
        gospelKeyword("repent", "metanoeo", "A reoriented mind and life in response to God's kingdom.", "Ask what Jesus is inviting you to turn from and toward."),
        gospelKeyword("confess", "homologeo", "Openly agreeing with and naming what is true about Jesus.", "Practice saying one true sentence about Jesus without dressing it up."),
        gospelKeyword("witness", "martys", "A person who testifies to what is true and has been seen.", "Ask how humility and truth can stay together.")
      ],
      spiritualPractice: {
        title: "Practice a humble gospel witness",
        summary: "Prepare one honest, Scripture-shaped explanation you could share with a friend.",
        steps: [
          "Write the gospel in three movements: Jesus is King, Jesus saves, Jesus makes new.",
          "Add one sentence about why that is good news to you.",
          "Remove any sentence that sounds like pressure or performance.",
          "Share it with a trusted leader before using it with a friend."
        ],
        reflectionPrompt: "What would it sound like to share the gospel with humility and confidence?",
        guidedPrayer: {
          title: "Prayer for gospel courage",
          durationLabel: "2 minute prayer",
          backgroundHint: "Before a conversation",
          prompts: [
            "Thank Jesus for saving before you speak for Him.",
            "Ask for humility that does not hide the truth.",
            "Ask for courage that does not pressure people.",
            "Pray for one friend to experience good news."
          ]
        }
      }
    },
    {
      id: "gospel-storyline-journey",
      title: "Gospel Storyline Journey",
      subtitle: "Connect the gospel to the whole Bible story instead of treating it as a detached formula.",
      openingPrompt: "Trace the gospel from promise to Jesus to new creation: God keeps His promise, rescues through Christ, forms a people, and renews all things.",
      followUpQuestions: [
        {
          id: "gospel-promise",
          label: "What promise is fulfilled?",
          prompt: "How does the passage connect Jesus to God's older promises?",
          placeholder: "This connects to the promise because..."
        },
        {
          id: "gospel-people",
          label: "What people is formed?",
          prompt: "How does the gospel create a community rather than isolated consumers?",
          placeholder: "The people formed by the gospel..."
        },
        {
          id: "gospel-hope",
          label: "Where is the story going?",
          prompt: "What final hope does the gospel point toward?",
          placeholder: "The hope ahead is..."
        }
      ],
      readingPath: [
        gospelReading("genesis-12-promise", "Genesis 12:1-3", "Blessing promised for the nations", "See that the good news has roots in God's promise to bless the nations.", "Write who the blessing is meant to reach."),
        gospelReading("acts-2-gospel", "Acts 2:36-39", "The risen Jesus calls for response", "Notice Lord, Messiah, repentance, forgiveness, Spirit, and promise.", "Name what Peter announces and what he invites."),
        gospelReading("revelation-21-hope", "Revelation 21:1-5", "Good news ends in renewed creation", "Let the gospel end where Scripture ends: God with His people and all things made new.", "Write one hope that is bigger than escape.")
      ],
      keyWords: [
        gospelKeyword("promise", "epangelia", "God's pledged purpose that He carries forward in Christ.", "Ask how the gospel fulfills more than a momentary need."),
        gospelKeyword("people", "laos", "A people belonging to God, formed by grace for witness.", "Ask how salvation joins you to a community."),
        gospelKeyword("hope", "elpis", "Confident expectation rooted in God's future, not wishful thinking.", "Ask what future the gospel teaches you to expect.")
      ],
      spiritualPractice: {
        title: "Tell the whole-story gospel",
        summary: "Practice a four-part gospel summary that starts in creation and ends in new creation.",
        steps: [
          "Write four headings: creation, fracture, Jesus, new creation.",
          "Put one sentence under each heading.",
          "Add one phrase from today's readings under at least two headings.",
          "Bring the summary to group and ask what is missing."
        ],
        reflectionPrompt: "How does the gospel change when you connect it to the whole Bible story?",
        guidedPrayer: {
          title: "Prayer of whole-story hope",
          durationLabel: "3 minute prayer",
          backgroundHint: "Creation to new creation",
          prompts: [
            "Praise God as Creator.",
            "Confess the fracture sin brings.",
            "Thank Jesus for His death and resurrection.",
            "Ask for hope that lives toward new creation."
          ]
        }
      }
    }
  ];
}

function personalizeJourneyEntries(
  entries: StudentJourneyJournal[],
  recommendations: {
    wrestleQuestions: string[];
    digQuestions: string[];
    journalPrompts: string[];
    prayerPrompts: string[];
  }
): StudentJourneyJournal[] {
  return entries.map((entry, index) => {
    if (index === 0 && recommendations.wrestleQuestions.length) {
      return {
        ...entry,
        followUpQuestions: toJourneyQuestions(recommendations.wrestleQuestions.slice(0, 3), "saved-wrestle", [
          "What are you really asking?",
          "What feels unresolved?",
          "What should you look for?"
        ])
      };
    }

    if (index === 1 && recommendations.digQuestions.length) {
      return {
        ...entry,
        followUpQuestions: toJourneyQuestions(recommendations.digQuestions.slice(0, 3), "saved-dig", [
          "What does the guide ask?",
          "What needs context?",
          "What should you test?"
        ])
      };
    }

    if (index === 2 && recommendations.journalPrompts.length) {
      return {
        ...entry,
        followUpQuestions: toJourneyQuestions(recommendations.journalPrompts.slice(0, 3), "saved-journal", [
          "What should you write?",
          "What is forming?",
          "What response fits?"
        ])
      };
    }

    if (index === 3 && recommendations.prayerPrompts.length) {
      return {
        ...entry,
        spiritualPractice: {
          ...entry.spiritualPractice,
          guidedPrayer: {
            title: "Saved prayer path",
            durationLabel: "2 minute prayer",
            backgroundHint: "Leader-guided reflection",
            prompts: recommendations.prayerPrompts.slice(0, 4)
          }
        }
      };
    }

    return entry;
  });
}

function toJourneyQuestions(
  questions: string[],
  idPrefix: string,
  labels: string[],
  placeholders: string[] = ["I notice...", "This matters because...", "I still wonder..."]
): StudentJourneyQuestion[] {
  return questions.slice(0, 3).map((question, index) => ({
    id: `${idPrefix}-${index + 1}`,
    label: labels[index] ?? `Question ${index + 1}`,
    prompt: question,
    placeholder: placeholders[index] ?? "Write honestly..."
  }));
}

function buildReadingPathFromReferences(references: string[], storylineMatch: StorylineQuestionMatch, titles: string[]): StudentJourneyReading[] {
  return references.slice(0, 3).map((reference, index) => ({
    id: `reading-${index + 1}-${reference.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    reference,
    lookupReference: lookupReferenceFor(reference),
    title: titles[index] ?? (index === 0 ? "Start with the passage" : index === 1 ? "Trace the storyline" : "Bring it toward hope"),
    guidance: readingGuidanceFor(storylineMatch, index),
    practice: readingPracticeFor(storylineMatch, index)
  }));
}

function gospelReading(id: string, reference: string, title: string, guidance: string, practice: string): StudentJourneyReading {
  return {
    id,
    reference,
    lookupReference: lookupReferenceFor(reference),
    title,
    guidance,
    practice
  };
}

function gospelKeyword(term: string, transliteration: string, meaning: string, invitation: string): StudentJourneyKeyword {
  return {
    term,
    transliteration,
    originalLanguage: "Greek",
    lexicalUrl: `https://www.blueletterbible.org/search/search.cfm?Criteria=${encodeURIComponent(transliteration)}&t=KJV#s=s_primary_0_1`,
    meaning,
    invitation
  };
}

function investigativeKeywords(storylineMatch: StorylineQuestionMatch): StudentJourneyKeyword[] {
  return [
    {
      term: "context",
      meaning: "The passage has a book, audience, covenant moment, and argument around it.",
      invitation: "Read what comes before and after before deciding what it means."
    },
    {
      term: "storyline",
      meaning: `This question develops through ${storylineMatch.developsThrough}.`,
      invitation: "Ask where the question begins, how it develops, and how it is fulfilled in Christ."
    },
    {
      term: "limits",
      meaning: "Faithful study names what Scripture says and what it does not fully answer yet.",
      invitation: "Write one thing you can say with confidence and one thing you should hold humbly."
    }
  ];
}

function responseKeywords(storylineMatch: StorylineQuestionMatch): StudentJourneyKeyword[] {
  return [
    {
      term: "response",
      meaning: "Application should grow from the passage instead of using the passage for a pre-made point.",
      invitation: "Name a response that fits what the text actually shows."
    },
    {
      term: "formation",
      meaning: "Scripture forms loves, habits, courage, humility, and community.",
      invitation: `Ask what this question could form in you around ${storylineMatch.title.toLowerCase()}.`
    },
    {
      term: "fruit",
      meaning: "A faithful answer should eventually grow visible fruit, not only better wording.",
      invitation: "Look for one small sign of love, joy, peace, patience, or courage."
    }
  ];
}

function communityKeywords(): StudentJourneyKeyword[] {
  return [
    {
      term: "witness",
      meaning: "Students can bring honest observations and questions that help the group seek truth together.",
      invitation: "Prepare one sentence you can say out loud without performing."
    },
    {
      term: "humility",
      meaning: "Humility lets Scripture lead and lets other believers help you see what you missed.",
      invitation: "Ask one question that invites help instead of proving a point."
    },
    {
      term: "practice",
      meaning: "Group discussion should lead toward a shared faithful response.",
      invitation: "Name one practice your group could try this week."
    }
  ];
}

function readingGuidanceFor(storylineMatch: StorylineQuestionMatch, index: number) {
  if (index === 0) return `Read slowly and ask what ${storylineMatch.startsHere} contributes before applying it to yourself.`;
  if (index === 1) return `Watch how this question develops through ${storylineMatch.developsThrough}.`;
  return `Ask how this finds its center or hope in Christ: ${storylineMatch.fulfilledInChrist}`;
}

function readingPracticeFor(storylineMatch: StorylineQuestionMatch, index: number) {
  if (index === 0) return "Underline repeated words, commands, promises, people, places, and emotional turns.";
  if (index === 1) return `Write one connection to ${storylineMatch.title} without forcing a shortcut.`;
  return "Turn one observation into a question you can bring to your group.";
}

function keyWordsForJourney(storylineMatch: StorylineQuestionMatch): StudentJourneyKeyword[] {
  const shared = [
    {
      term: "context",
      meaning: "The passage sits inside a book, audience, covenant moment, and storyline.",
      invitation: "Ask what is happening before asking what it means for you."
    },
    {
      term: "faithful response",
      meaning: "Application grows out of what the passage actually shows.",
      invitation: "Name a response that fits the text instead of using the text for a pre-decided answer."
    }
  ];

  if (storylineMatch.id === "wisdom-suffering") {
    return [
      {
        term: "lament",
        meaning: "Biblical faith makes room for honest grief and unanswered questions before God.",
        invitation: "Try praying one honest sentence before trying to explain the pain."
      },
      ...shared
    ];
  }

  if (storylineMatch.id === "presence-temple") {
    return [
      {
        term: "presence",
        meaning: "Scripture traces God's desire to dwell with His people while taking holiness seriously.",
        invitation: "Look for nearness, holiness, mediation, and worship in the passage."
      },
      ...shared
    ];
  }

  if (storylineMatch.id === "kingdom-messiah") {
    return [
      {
        term: "kingdom",
        meaning: "God's kingdom is His faithful reign, not just a place or a private feeling.",
        invitation: "Ask what kind of power, justice, or victory the passage is showing."
      },
      ...shared
    ];
  }

  return shared;
}

function practiceForJourney(prompt: ReadingSource, storylineMatch: StorylineQuestionMatch): StudentJourneyPractice {
  const text = promptSearchText(prompt);

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic|anxiety|worry|lament)\b/.test(text)) {
    return {
      title: "Practice honest lament",
      summary: "Bring the question to God without pretending it is smaller than it is.",
      steps: [
        "Name the pain or confusion in one plain sentence.",
        "Read the first guided passage again and notice where Scripture gives you honest language.",
        "Ask one trusted person to help you carry the question this week."
      ],
      reflectionPrompt: "What answer would feel too quick, and what hope does Scripture still allow you to hold?",
      guidedPrayer: {
        title: "Breathe and tell the truth",
        durationLabel: "3 minute prayer",
        backgroundHint: "Stillness and lament",
        prompts: [
          "Slowly inhale: God is near.",
          "As you exhale, let yourself tell the truth without fixing it.",
          "Pray: God, help me be honest about what hurts.",
          "Ask for one sign of courage to bring this into wise community."
        ]
      }
    };
  }

  if (/\b(pray|prayer|trust|faith|believe)\b/.test(text) || storylineMatch.id === "spirit-church") {
    return {
      title: "Pray from the passage",
      summary: "Let the reading shape a prayer of praise, confession, request, and trust.",
      steps: [
        "Choose one phrase from the passage.",
        "Turn it into a sentence of prayer.",
        "Sit quietly for one minute before writing what you noticed."
      ],
      reflectionPrompt: "How did the passage change the way you prayed?",
      guidedPrayer: {
        title: "Invite God into this moment",
        durationLabel: "2 minute prayer",
        backgroundHint: "Quiet focus",
        prompts: [
          "Slowly inhale.",
          "As you exhale, let go of tension or stress.",
          "Repeat as needed, and invite God into this moment.",
          "Pray one sentence from the Scripture you just read."
        ]
      }
    };
  }

  return {
    title: "Read, pause, respond",
    summary: "Move from careful reading to a simple embodied response before group.",
    steps: [
      "Read the first passage out loud or listen to it once.",
      "Write one observation, one question, and one possible response.",
      "Pray one sentence asking God for humility and wisdom."
    ],
    reflectionPrompt: `What does this journey help you notice about ${storylineMatch.title.toLowerCase()}?`,
    guidedPrayer: {
      title: "A slow reading prayer",
      durationLabel: "2 minute prayer",
      backgroundHint: "Open Bible and quiet breath",
      prompts: [
        "Inhale and ask God for attention.",
        "Exhale the need to rush to an answer.",
        "Ask: What are You showing me in this passage?",
        "Ask for humility to bring your question to group."
      ]
    }
  };
}

function lookupReferenceFor(reference: string) {
  const withoutRange = reference.replace(/-\d{1,3}(?::\d{1,3})?/g, "");
  const verseRange = withoutRange.replace(/:(\d{1,3})-\d{1,3}/g, ":$1");
  const commaSplit = verseRange.split(",")[0]?.trim();
  return commaSplit || "Genesis 1";
}

function stripBringToGroupPrefix(value: string) {
  return value.replace(/^Bring this to group:\s*/i, "").trim();
}

function uniqueQuestions(questions: string[], limit: number) {
  const seen = new Set<string>();
  return questions
    .filter((question) => {
      if (seen.has(question)) return false;
      seen.add(question);
      return true;
    })
    .slice(0, limit);
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
    ["kingdom-waiting", /\b(gospel|good news|salvation|saved|cross|resurrection|atonement)\b/],
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
    ["context", /\b(gospel|good news|salvation|saved|cross|resurrection|atonement)\b/],
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
    ["the gospel", /\b(gospel|good news|salvation|saved|cross|resurrection|atonement)\b/],
    ["trust", /\b(trust|faith|believe|prayer|pray|anxiety|worry)\b/],
    ["suffering", /\b(suffer\w*|pain|grief|death|trauma|hard things)\b/],
    ["the garden", /\b(garden|eden|tree|evil|genesis|creation)\b/],
    ["doubt", /\b(doubt|deconstruct|confused|questioning)\b/],
    ["identity", /\b(identity|belong|purpose|worth)\b/],
    ["forgiveness", /\b(forgive|forgiveness|mercy|grace)\b/]
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] ?? "";
}

function digQuestionsForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);

  if (isGospelQuestion(text)) {
    return [
      "What good news is being announced, and who is at the center of it?",
      "What problem does the gospel answer: guilt, shame, death, false kingdoms, broken relationship, or all of these?",
      "How do Jesus' death, resurrection, kingdom, grace, repentance, and faith fit together?"
    ];
  }

  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return [
      "What good things does God give before the command appears?",
      "What kind of trust is being tested in the story?",
      "Where do you see both human choice and God's pursuit after failure?"
    ];
  }

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
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

function wrestleQuestionsForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);
  const baseQuestions = [
    "What have you heard or been taught about this before?",
    "What is sticking out to you, bothering you, or confusing you?",
    "What is the main thing you really want to know?",
    "Where have you already looked for answers?"
  ];

  if (isGospelQuestion(text)) {
    return [
      "When you hear the word gospel, what answer comes to mind first?",
      "Does your answer sound like news about Jesus, advice for better living, or both?",
      "What part of the gospel feels clear, and what part still feels confusing?",
      "Where have you seen the gospel reduced to a slogan?"
    ];
  }

  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return [
      baseQuestions[0],
      "What do you think this story is showing about God, people, freedom, or trust?",
      baseQuestions[2],
      baseQuestions[3]
    ];
  }

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
    return [
      "What kind of answer would feel too quick or too shallow?",
      baseQuestions[1],
      baseQuestions[2],
      "Who could help you carry this question with wisdom and care?"
    ];
  }

  if (/\b(doubt|deconstruct|confused|questioning)\b/.test(text)) {
    return [
      "If this question has a deeper question underneath it, what might that be?",
      baseQuestions[0],
      baseQuestions[2],
      baseQuestions[3]
    ];
  }

  return baseQuestions;
}

function journalPromptsForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);

  if (isGospelQuestion(text)) {
    return [
      "Write the gospel as one sentence about what Jesus has done before writing what people should do.",
      "Name one part of the gospel that is bigger than private forgiveness.",
      "Write one honest question you would want a leader to help you answer from Scripture."
    ];
  }

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
    return [
      "Write one honest sentence naming what hurts or feels unresolved.",
      "Name one thing the reading reveals about God's nearness, even if it does not answer everything.",
      "Write one question you want a trusted leader to help you carry."
    ];
  }

  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return [
      "List the gifts God gives in the story before you write about the command.",
      "Write one sentence about what trust might have looked like in the garden.",
      "Name what this question makes you wonder about God, people, and freedom."
    ];
  }

  return [
    "Write one sentence naming what you hope is true about God here.",
    "What did the reading reveal about God, people, brokenness, or hope?",
    "What question are you still carrying after reading?"
  ];
}

function prayerPromptsForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);

  if (isGospelQuestion(text)) {
    return [
      "Jesus, help me receive the gospel as good news before I turn it into advice.",
      "Jesus, show me what Your death and resurrection accomplish.",
      "Jesus, teach me repentance, trust, and humble witness."
    ];
  }

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
    return [
      "God, help me be honest about what hurts.",
      "God, show me where you are near, even while I still have questions.",
      "God, give me courage to bring this into wise community."
    ];
  }

  if (/\b(trust|faith|believe|prayer|pray|anxiety|worry)\b/.test(text)) {
    return [
      "God, help me name what makes trust hard.",
      "God, show me what your character is like before I rush to respond.",
      "God, teach our group to practice honest faith together."
    ];
  }

  return [
    "God, help me be honest about what I am really asking.",
    "God, show me what I may be missing in Scripture.",
    "God, give me humility to seek an answer with others."
  ];
}

function wrestleTogetherPromptForPrompt(prompt: ReadingSource, primaryKnowledge?: StudentKnowledgeMatch) {
  const text = promptSearchText(prompt);

  if (isGospelQuestion(text)) {
    return "Bring this to group: How would Scripture define the gospel as good news about Jesus, and what common shortcuts should we avoid?";
  }

  if (/\b(suffer\w*|pain|grief|death|trauma|hard things|depression|panic)\b/.test(text)) {
    return "Bring this to group: How can we make room for honest pain while looking for God's nearness and hope together?";
  }

  if (/\b(garden|eden|tree|evil|genesis|creation)\b/.test(text)) {
    return "Bring this to group: What does the garden story show about God's gifts, human trust, and God's pursuit after failure?";
  }

  if (primaryKnowledge?.digQuestions?.[0]) {
    return `Bring this to group: ${primaryKnowledge.digQuestions[0]}`;
  }

  return "Bring this to group: What would it look like to seek a faithful answer together without rushing?";
}

function careNoteForPrompt(prompt: ReadingSource) {
  const text = promptSearchText(prompt);
  if (/\b(abuse|assault|self harm|suicide|kill myself|hurt myself|trauma|family crisis|unsafe)\b/.test(text)) {
    return "This is important enough to bring to a trusted leader right away. Keep reading carefully, but do not carry it alone.";
  }

  if (/\b(suffer\w*|grief|death|depression|anxiety|panic|sexuality|identity|deconstruct|hell|judgment)\b/.test(text)) {
    return "This may need a slower conversation with a trusted leader. Use these questions to prepare, not to force a quick answer.";
  }

  return undefined;
}

function promptSearchText(prompt: ReadingSource) {
  return `${prompt.question} ${prompt.scriptureReference} ${(prompt.topicTags ?? []).join(" ")}`.toLowerCase();
}

function isGospelQuestion(text: string) {
  return /\b(gospel|good news|salvation|saved|save me|cross|resurrection|atonement|forgiven|forgiveness)\b/.test(text);
}

function promptSearchTextForPlan(plan: ScripturePlan) {
  return `${plan.title} ${plan.primaryScripture} ${plan.summary} ${plan.contextFocus}`.toLowerCase();
}
