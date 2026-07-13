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
  const digQuestions = primaryKnowledge?.digQuestions?.length ? primaryKnowledge.digQuestions : uniqueQuestions([...storylineMatch.studentQuestions, ...digQuestionsForPrompt(prompt)], 3);
  const journalPrompts = journalPromptsForPrompt(prompt);
  const prayerPrompts = prayerPromptsForPrompt(prompt);
  const wrestleTogetherPrompt = wrestleTogetherPromptForPrompt(prompt, primaryKnowledge);
  const readingPlan = primaryKnowledge ? knowledgeItem(primaryKnowledge, primaryKnowledge.label) : storylineItem(storylineMatch);
  const nextResource = secondaryKnowledge ? knowledgeItem(secondaryKnowledge, "Keep digging") : resourceItem(resource, "Practice this");
  const journeyJournal = buildJourneyJournal(prompt, storylineMatch, primaryKnowledge);
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
    journeyJournal
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
    journeyJournal: fallback.journeyJournal
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

function promptSearchTextForPlan(plan: ScripturePlan) {
  return `${plan.title} ${plan.primaryScripture} ${plan.summary} ${plan.contextFocus}`.toLowerCase();
}
