import type {
  StudentJourneyJournal,
  StudentJourneyKeyword,
} from "@/lib/scripture/student-home";
import type { StudentDiscussionKnowledgeContext } from "@/lib/scripture/types";

export type StudentFormationJourney = {
  id: string;
  title: string;
  summary: string;
  durationLabel: string;
  availableLabel: string;
  entries: StudentJourneyJournal[];
};

type FormationDay = {
  day: number;
  journey: string;
  receive: string;
  lookupReference: string;
  explore: string;
  practice: string;
  walk: string;
  see: string;
  additionalReadings?: Array<{
    reference: string;
    lookupReference: string;
    title: string;
  }>;
  keywords?: StudentJourneyKeyword[];
};

const firstTwoWeeks: FormationDay[] = [
  {
    day: 1,
    journey: "Before You Begin",
    receive: "Luke 9",
    lookupReference: "Luke 9",
    explore: "Why this journey?",
    practice: "Prayer walk",
    walk: "Why am I here?",
    see: "What do I hope God grows?",
  },
  {
    day: 2,
    journey: "Potential",
    receive: "Genesis 1",
    lookupReference: "Genesis 1",
    explore: "TOV",
    practice: "Silence",
    walk: "Notice potential",
    see: "Where did I see God?",
    keywords: [
      {
        term: "good",
        transliteration: "tov",
        originalLanguage: "טוֹב",
        lexicalUrl:
          "https://www.blueletterbible.org/lexicon/h2896/kjv/wlc/0-1/",
        meaning:
          "Good, beautiful, fitting, and life-giving—the word repeated through the creation story.",
        invitation:
          "Look for the potential God names before measuring what is unfinished.",
      },
    ],
  },
  {
    day: 3,
    journey: "Boundaries",
    receive: "Genesis 1",
    lookupReference: "Genesis 1",
    explore: "Creation / Flood",
    practice: "Create space",
    walk: "Set one boundary",
    see: "What changed?",
    additionalReadings: [
      {
        reference: "Genesis 6-9",
        lookupReference: "Genesis 6:5",
        title: "Flood, de-creation, and a renewed beginning",
      },
    ],
  },
  {
    day: 4,
    journey: "Purpose",
    receive: "Bezalel",
    lookupReference: "Exodus 31:1",
    explore: "The Spirit fills",
    practice: "Serve quietly",
    walk: "Use one gift",
    see: "Where did life grow?",
  },
  {
    day: 5,
    journey: "Correction",
    receive: "The Burning Bush",
    lookupReference: "Exodus 3:1",
    explore: "Moses",
    practice: "Receive feedback",
    walk: "Listen first",
    see: "What softened?",
  },
  {
    day: 6,
    journey: "Teachability",
    receive: "Hebrews 12",
    lookupReference: "Hebrews 12:5",
    explore: "Mussar",
    practice: "Memorize Scripture",
    walk: "Ask for feedback",
    see: "What did I learn?",
    additionalReadings: [
      {
        reference: "Proverbs 3:11-12",
        lookupReference: "Proverbs 3:11",
        title: "The wisdom source echoed in Hebrews",
      },
    ],
    keywords: [
      {
        term: "discipline / instruction",
        transliteration: "mussar",
        originalLanguage: "מוּסָר",
        lexicalUrl:
          "https://www.blueletterbible.org/lexicon/h4148/kjv/wlc/0-1/",
        meaning:
          "Formative instruction, correction, or discipline that trains a person in wisdom.",
        invitation:
          "Receive correction as an invitation to become teachable, not as a verdict on your worth.",
      },
      {
        term: "training / discipline",
        transliteration: "paideia",
        originalLanguage: "παιδεία",
        lexicalUrl: "https://www.blueletterbible.org/lexicon/g3809/kjv/tr/0-1/",
        meaning:
          "The Greek word used in Hebrews 12 for formative training, instruction, and discipline.",
        invitation:
          "Notice how Hebrews carries a wisdom-shaped vision of correction into Christian formation.",
      },
    ],
  },
  {
    day: 7,
    journey: "Equipping",
    receive: "Exodus 18",
    lookupReference: "Exodus 18:13",
    explore: "Shared leadership",
    practice: "Invite help",
    walk: "Delegate",
    see: "What surprised me?",
  },
  {
    day: 8,
    journey: "Chosen",
    receive: "David",
    lookupReference: "1 Samuel 16:1",
    explore: "Identity",
    practice: "Pray Psalm 23",
    walk: "Serve unseen",
    see: "Where was I rooted?",
  },
  {
    day: 9,
    journey: "Waiting",
    receive: "The Cave",
    lookupReference: "1 Samuel 24:1",
    explore: "Trust timing",
    practice: "Wait before speaking",
    walk: "Resist control",
    see: "What did waiting teach?",
  },
  {
    day: 10,
    journey: "Roots",
    receive: "Psalm 1",
    lookupReference: "Psalm 1",
    explore: "John 15",
    practice: "Meditate",
    walk: "Stay near the water",
    see: "Where am I growing?",
  },
  {
    day: 11,
    journey: "Spirit Forms",
    receive: "Acts 2",
    lookupReference: "Acts 2:1",
    explore: "Bezalel → Pentecost",
    practice: "Listen",
    walk: "Encourage someone",
    see: "Where did I see the Spirit?",
    additionalReadings: [
      {
        reference: "Exodus 31:1-5",
        lookupReference: "Exodus 31:1",
        title: "The Spirit equips Bezalel for faithful work",
      },
    ],
  },
  {
    day: 12,
    journey: "Image Bearers",
    receive: "Genesis 1",
    lookupReference: "Genesis 1:26",
    explore: "Identity",
    practice: "Honor someone",
    walk: "See God's image",
    see: "What changed?",
  },
  {
    day: 13,
    journey: "The Way",
    receive: "Mark 8",
    lookupReference: "Mark 8:27",
    explore: "Jesus",
    practice: "Carry your cross",
    walk: "One costly obedience",
    see: "How did Jesus meet me?",
  },
  {
    day: 14,
    journey: "Sabbath",
    receive: "Psalm 23",
    lookupReference: "Psalm 23",
    explore: "Rest",
    practice: "Practice Sabbath",
    walk: "Receive rest",
    see: "What was restored?",
    additionalReadings: [
      {
        reference: "Mark 2:27-28",
        lookupReference: "Mark 2:27",
        title: "Sabbath as a gift for people",
      },
    ],
  },
];

export const studentLeaderFormationJourney: StudentFormationJourney = {
  id: "student-leader-formation",
  title: "Growth Journey 1",
  summary:
    "A 14-day student-leader formation journey through Scripture, practice, faithful action, and reflection.",
  durationLabel: "14-day journey",
  availableLabel: "Days 1-14",
  entries: firstTwoWeeks.map(toJournalEntry),
};

export const studentLeaderFormationMeridianContext: StudentDiscussionKnowledgeContext =
  {
    id: "context-map-student-leader-formation",
    label: "Because you asked about becoming a leader",
    title: "Growth Journey 1: Student Leader Formation",
    description:
      "Steer leadership questions through receiving Scripture, exploring with humility, practicing a faithful response, walking it into ordinary life, and noticing the Spirit's fruit. Keep identity before performance, presence before platform, shared leadership before control, and service before recognition.",
    href: "/student/scripture/questions",
    topicTags: [
      "student_leadership",
      "formation",
      "discipleship",
      "calling",
      "teachability",
      "service",
      "sabbath",
      "spiritual_gifts",
      "shared_leadership",
    ],
    scriptureReferences: [
      "Luke 9",
      "Genesis 1",
      "Exodus 18",
      "Exodus 31:1-5",
      "Psalm 1",
      "Psalm 23",
      "Mark 8",
      "John 15",
      "Acts 2",
      "Hebrews 12",
    ],
    digQuestions: [
      "How is Jesus forming who you are before expanding what you do?",
      "What practice would let this Scripture move from information into faithful response?",
      "Where might teachability, shared leadership, hidden service, or rest be the next faithful step?",
    ],
  };

function toJournalEntry(day: FormationDay): StudentJourneyJournal {
  return {
    id: `student-leader-formation-day-${day.day}`,
    title: `Day ${day.day}: ${day.journey}`,
    subtitle: `${day.receive} · ${day.explore}`,
    openingPrompt: day.walk,
    rhythm: {
      receive: day.receive,
      explore: day.explore,
      practice: day.practice,
      walk: day.walk,
      see: day.see,
    },
    followUpQuestions: [
      {
        id: `day-${day.day}-explore`,
        label: "Explore the Story",
        prompt: `Sit with ${day.explore}. What does today's Scripture help you understand more clearly?`,
        placeholder: "I am beginning to notice...",
      },
      {
        id: `day-${day.day}-walk`,
        label: "Walk the Story",
        prompt: day.walk,
        placeholder: "My next faithful step is...",
      },
      {
        id: `day-${day.day}-see`,
        label: "See the Story Growing",
        prompt: day.see,
        placeholder: "Looking back, I can see...",
      },
    ],
    readingPath: [
      {
        id: `day-${day.day}-receive`,
        reference: day.receive,
        lookupReference: day.lookupReference,
        title: `Receive: ${day.receive}`,
        guidance:
          "Read slowly. Listen before explaining. Notice the word, image, or question that draws your attention.",
        practice: `Carry this question into the reading: ${day.explore}`,
      },
      ...(day.additionalReadings ?? []).map((reading, index) => ({
        id: `day-${day.day}-supporting-${index + 1}`,
        reference: reading.reference,
        lookupReference: reading.lookupReference,
        title: reading.title,
        guidance:
          "Read this alongside today's primary passage. Notice both the connection and the distinctions between them.",
        practice: `Ask how this passage deepens or corrects your first understanding of ${day.explore}.`,
      })),
    ],
    keyWords: day.keywords ?? [],
    spiritualPractice: {
      title: day.practice,
      summary: `Let today's Scripture take shape through the practice of ${day.practice.toLowerCase()}.`,
      steps: [
        `Make unhurried space to ${day.practice.toLowerCase()}.`,
        `Carry the Story into ordinary life: ${day.walk}.`,
        `At the end of the day, pause and ask: ${day.see}`,
      ],
      reflectionPrompt: day.see,
    },
  };
}
