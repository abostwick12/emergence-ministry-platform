import {
  parseStudentJourneyFormationContent,
  type StudentJourneyContentSource,
  type StudentJourneyFormationContent,
  type StudentJourneySelection
} from "@/lib/scripture/student-journey-draft";

export type StudentJourneyGenerationContext = {
  question: string;
  selection: StudentJourneySelection;
  scriptureText: string;
  sources: StudentJourneyContentSource[];
  sourceContext: string;
};

type ReviewedBackgroundSource = {
  id: string;
  bookPattern: RegExp;
  title: string;
  locator: string;
  url: string;
  approvedSummary: string;
};

const reviewedBackgroundSources: ReviewedBackgroundSource[] = [
  {
    id: "bibleproject-samuel-guide",
    bookPattern: /\b[12]\s*samuel\b/i,
    title: "BibleProject Guide: Books of 1 and 2 Samuel",
    locator: "About; Samuel 1-7; Saul and the Rise of Kingship",
    url: "https://bibleproject.com/guides/books-of-samuel/",
    approvedSummary:
      "The books of Samuel were originally one coherent story and are divided into 1 and 2 Samuel in modern Bibles. The work traces Israel's transition from judges to a unified kingdom through Samuel, Saul, and David; 1 Samuel 8-15 narrates Saul's rise and early failures."
  },
  {
    id: "bibleproject-genesis-guide",
    bookPattern: /\bgenesis\b/i,
    title: "BibleProject Guide: Book of Genesis",
    locator: "Book overview and literary design",
    url: "https://bibleproject.com/guides/book-of-genesis/",
    approvedSummary:
      "Genesis opens the Torah by tracing God's good creation, humanity's vocation and rebellion, and God's covenant promises through Abraham's family. Read each scene inside that larger literary movement rather than as an isolated moral example."
  },
  {
    id: "bibleproject-exodus-guide",
    bookPattern: /\bexodus\b/i,
    title: "BibleProject Guide: Book of Exodus",
    locator: "Book overview and literary design",
    url: "https://bibleproject.com/guides/book-of-exodus/",
    approvedSummary:
      "Exodus continues Israel's family story under oppression in Egypt and traces God's deliverance, covenant at Sinai, and dwelling among Israel in the tabernacle. The book holds rescue and formation together."
  },
  {
    id: "bibleproject-psalms-guide",
    bookPattern: /\bpsalm\b/i,
    title: "BibleProject Guide: Book of Psalms",
    locator: "Book overview and five-book design",
    url: "https://bibleproject.com/guides/book-of-psalms/",
    approvedSummary:
      "Psalms is a carefully arranged collection of Hebrew poems and prayers that trains God's people in worship, lament, wisdom, and hope. Individual psalms should be read as poetry and within the collection's larger movement."
  },
  {
    id: "bibleproject-mark-guide",
    bookPattern: /\bmark\b/i,
    title: "BibleProject Guide: Gospel of Mark",
    locator: "Book overview and literary design",
    url: "https://bibleproject.com/guides/book-of-mark/",
    approvedSummary:
      "Mark presents Jesus announcing God's Kingdom and gradually reveals a Messiah whose authority and victory lead through suffering, the cross, and resurrection. The Gospel invites readers to reconsider power and discipleship around Jesus."
  },
  {
    id: "bibleproject-romans-guide",
    bookPattern: /\bromans\b/i,
    title: "BibleProject Guide: Letter to the Romans",
    locator: "About; Background of the Book of Romans; Romans 5-8",
    url: "https://bibleproject.com/guides/book-of-romans/",
    approvedSummary:
      "The apostle Paul wrote Romans later in his ministry to a divided community of Jewish and non-Jewish Jesus followers in Rome. The letter explains the good news about Jesus and calls this community toward a Spirit-formed unity; Romans 5-8 develops how that good news creates a new humanity and hope amid suffering."
  },
  {
    id: "bibleproject-ephesians-guide",
    bookPattern: /\bephesians\b/i,
    title: "BibleProject Guide: Letter to the Ephesians",
    locator: "About; Ephesians 1-3",
    url: "https://bibleproject.com/guides/book-of-ephesians/",
    approvedSummary:
      "Paul wrote Ephesians after his ministry in Ephesus and while imprisoned by Rome, addressing the church there about the Gospel and its communal implications. Ephesians 1-3 describes God's grace creating a new, multiethnic humanity in Jesus, while chapters 4-6 call that community to embody the Gospel in ordinary relationships."
  },
  {
    id: "bibleproject-acts-guide",
    bookPattern: /\bacts\b/i,
    title: "BibleProject Guide: Book of Acts",
    locator: "Book overview and literary design",
    url: "https://bibleproject.com/guides/book-of-acts/",
    approvedSummary:
      "Acts continues Luke's account by tracing the risen Jesus' mission through the Holy Spirit and a growing, multiethnic church. Acts 2 narrates Pentecost as the Spirit forms a public witness and a shared community."
  },
  {
    id: "bibleproject-galatians-guide",
    bookPattern: /\bgalatians\b/i,
    title: "BibleProject Guide: Letter to the Galatians",
    locator: "Book overview and Galatians 5",
    url: "https://bibleproject.com/guides/book-of-galatians/",
    approvedSummary:
      "Paul's letter to the Galatian churches defends the good news that belonging to God's family rests on Jesus and the Spirit rather than ethnic boundary markers. Galatians 5 contrasts destructive works of the flesh with the Spirit's fruit in a life shaped by love."
  }
];

const fruitSource: StudentJourneyContentSource = {
  id: "scripture-galatians-5-fruit",
  kind: "scripture",
  title: "Galatians 5:22-23",
  locator: "Galatians 5:22-23"
};

export function buildStudentJourneyGenerationContext(input: {
  question: string;
  selection: StudentJourneySelection;
  scriptureText: string;
}): StudentJourneyGenerationContext | undefined {
  if (input.selection.status !== "matched" || !input.selection.primaryReference || !input.scriptureText.trim()) return undefined;
  const background = reviewedBackgroundSources.find((source) => source.bookPattern.test(input.selection.primaryReference));
  if (!background) return undefined;

  const primarySource: StudentJourneyContentSource = {
    id: "scripture-primary-passage",
    kind: "scripture",
    title: input.selection.primaryReference,
    locator: input.selection.primaryReference
  };
  const backgroundSource: StudentJourneyContentSource = {
    id: background.id,
    kind: "approved_reference",
    title: background.title,
    locator: background.locator,
    url: background.url
  };
  const sources = [primarySource, backgroundSource, fruitSource];

  return {
    question: input.question,
    selection: input.selection,
    scriptureText: normalizeScriptureText(input.scriptureText),
    sources,
    sourceContext: [
      `SOURCE ${primarySource.id} (${primarySource.title}):`,
      normalizeScriptureText(input.scriptureText),
      "",
      `SOURCE ${backgroundSource.id} (${backgroundSource.title}; ${backgroundSource.locator}):`,
      background.approvedSummary,
      "",
      `SOURCE ${fruitSource.id} (${fruitSource.locator}):`,
      "Use Galatians 5:22-23 as the explicit biblical standard for love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control."
    ].join("\n")
  };
}

export function buildStudentJourneyFormationContentFromAi(input: {
  value: unknown;
  provider: "gloo" | "gemini" | "openai";
  model: string;
  sources: StudentJourneyContentSource[];
  generatedAt?: string;
}): StudentJourneyFormationContent | undefined {
  if (!input.value || typeof input.value !== "object" || Array.isArray(input.value)) return undefined;
  const value = input.value as Record<string, unknown>;
  const candidate = {
    ...value,
    label: "AI-assisted commentary",
    provider: input.provider,
    model: input.model,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requiresHumanReview: true,
    sourceStatus: Array.isArray(value.missingSourceFields) && value.missingSourceFields.length ? "source_incomplete" : "supported",
    missingSourceFields: value.missingSourceFields ?? [],
    sources: input.sources
  };
  return parseStudentJourneyFormationContent(candidate);
}

export function buildSeededSaulJourneyContent(generatedAt = "2026-08-06T00:00:00.000Z"): StudentJourneyFormationContent {
  const sources: StudentJourneyContentSource[] = [
    { id: "scripture-primary-passage", kind: "scripture", title: "1 Samuel 8-12", locator: "1 Samuel 8-12" },
    {
      id: "bibleproject-samuel-guide",
      kind: "approved_reference",
      title: "BibleProject Guide: Books of 1 and 2 Samuel",
      locator: "About; Samuel 1-7; Saul and the Rise of Kingship",
      url: "https://bibleproject.com/guides/books-of-samuel/"
    },
    fruitSource
  ];
  const content = parseStudentJourneyFormationContent({
    label: "AI-assisted commentary",
    provider: "seeded",
    model: "reviewed-journey-fixture-v1",
    generatedAt,
    requiresHumanReview: true,
    sourceStatus: "supported",
    missingSourceFields: [],
    sources,
    receive: {
      historicalBackground: {
        text: "The books of 1 and 2 Samuel were originally one coherent story and are divided in modern Bibles. They trace Israel's transition from judges to monarchy through Samuel, Saul, and David; 1 Samuel 8-12 focuses on Israel's request for a king, Saul's selection, and his public confirmation. Read this as Israel's story about leadership under God's rule, not as a generic lesson about popularity.",
        sourceIds: ["bibleproject-samuel-guide", "scripture-primary-passage"]
      }
    },
    explore: {
      repeatedPhrase: {
        text: "“king” and “rule/reign over us” in 1 Samuel 8",
        sourceIds: ["scripture-primary-passage"]
      },
      workedExample: {
        text: "Notice how the people repeatedly ask for a king to judge or rule them in 1 Samuel 8:5-22. The repetition keeps their desire for visible human rule beside Samuel's warning about what such a king will take, so the passage answers both why they asked and why the request was spiritually complicated.",
        sourceIds: ["scripture-primary-passage"]
      },
      wholeStoryBridge: {
        text: "Stay inside 1 Samuel 8-12 first: chapter 8 records the request and warning, chapters 9-10 narrate Saul's selection, chapter 11 confirms him publicly, and chapter 12 calls both king and people back to covenant faithfulness.",
        sourceIds: ["scripture-primary-passage", "bibleproject-samuel-guide"]
      }
    },
    practice: {
      slowReadingPrayer: {
        text: "God, slow me down as I read Israel's request for a king. Show me what the people feared, what they desired, and what Samuel warned them about. Help me notice where I also prefer visible control to patient trust, and lead me toward faithful listening rather than a quick judgment of the people in the story. Amen.",
        sourceIds: ["scripture-primary-passage"]
      },
      responseStarter: {
        text: "God, as I notice Israel asking for a king, I am beginning to see that...",
        sourceIds: ["scripture-primary-passage"]
      }
    },
    walk: {
      exampleActions: [
        {
          text: "Before asking someone else to make a difficult decision for you today, name the fear or desire that is pushing you toward a quick answer.",
          sourceIds: ["scripture-primary-passage"]
        },
        {
          text: "Ask a trusted leader to help you distinguish faithful leadership from leadership that simply looks impressive to everyone else.",
          sourceIds: ["scripture-primary-passage"]
        },
        {
          text: "Choose one decision this week where you will listen carefully to God's instruction before copying what the people around you expect.",
          sourceIds: ["scripture-primary-passage"]
        }
      ]
    },
    see: {
      biblicalStandardReference: "Galatians 5:22-23",
      fruitToWatch: {
        text: "Use Galatians 5:22-23 as the rubric. In this journey, watch especially for patience, faithfulness, gentleness, and self-control as the desire for quick control gives way to careful listening and trust.",
        sourceIds: ["scripture-galatians-5-fruit", "scripture-primary-passage"]
      }
    }
  });

  if (!content) throw new Error("The reviewed Saul Journey Journal fixture is invalid.");
  return content;
}

function normalizeScriptureText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}
