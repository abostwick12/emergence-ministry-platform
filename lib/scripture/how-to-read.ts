export type HowToReadModule = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  minutes: number;
  summary: string;
  videoLabel: string;
  videoEmbedUrl?: string;
  infographicLabel: string;
  badge: string;
  tools: string[];
  practice: string;
  groupQuestion: string;
  keyPassages: string[];
  studentTakeaway: string;
};

export const studentHowToReadLocalProgressKey = "lead-emergence:student-how-to-read-progress";

export const howToReadModules: HowToReadModule[] = [
  {
    id: "what-is-the-bible",
    order: 1,
    title: "What Is the Bible?",
    shortTitle: "Start here",
    minutes: 6,
    summary:
      "The Bible is one library of many books that tells the story of God, people, rescue, and renewal. This guide helps students know what they are holding before they start reading.",
    videoLabel: "What Is the Bible video",
    videoEmbedUrl: "https://www.youtube.com/embed/ak06MSETeo4",
    infographicLabel: "Bible library map",
    badge: "Start With the Story",
    tools: ["One library, many books", "God's story before my hot take", "Read with humility"],
    practice: "Open the table of contents. Notice the main sections and write one question you have before reading.",
    groupQuestion: "What did you assume the Bible was before someone explained it to you?",
    keyPassages: ["Luke 24:27", "2 Timothy 3:16-17", "Psalm 119:105"],
    studentTakeaway: "The Bible is not a pile of random inspirational quotes. It is a library that tells one connected story about God and his world."
  },
  {
    id: "big-story",
    order: 2,
    title: "The Big Story of Scripture",
    shortTitle: "See the whole story",
    minutes: 8,
    summary:
      "Learn the main storyline so the Bible feels less like random verses and more like a connected story moving from creation to new creation.",
    videoLabel: "The Bible's Big Story",
    videoEmbedUrl: "https://www.youtube.com/embed/7_CGP-12AE0",
    infographicLabel: "Whole-Bible timeline",
    badge: "See the Big Picture",
    tools: ["Creation", "Fall", "Covenant", "Jesus", "New creation"],
    practice: "Pick one Bible book and ask where it sits in the larger story.",
    groupQuestion: "Why does a verse make more sense when you know where it is in the story?",
    keyPassages: ["Genesis 1:1", "Genesis 12:1-3", "John 1:14", "Revelation 21:1-5"],
    studentTakeaway: "A verse makes more sense when you know where it sits in the larger story of creation, brokenness, promise, Jesus, and renewal."
  },
  {
    id: "genres-and-tools",
    order: 3,
    title: "Literary Genres and Bible Tools",
    shortTitle: "Know what you are reading",
    minutes: 7,
    summary:
      "Poetry, story, law, wisdom, letters, and prophecy all ask to be read with care. This guide gives students a simple way to notice what kind of writing they are reading.",
    videoLabel: "Literary Styles",
    videoEmbedUrl: "https://www.youtube.com/embed/oUXJ8Owes8E",
    infographicLabel: "Bible genre cards",
    badge: "Read the Room",
    tools: ["Story", "Poetry", "Wisdom", "Prophecy", "Letters"],
    practice: "Read Psalm 23 and Romans 8:1-4. Notice how the two passages communicate differently.",
    groupQuestion: "What changes when we read poetry like poetry and letters like letters?",
    keyPassages: ["Psalm 23", "Proverbs 3:5-6", "Romans 8:1-4", "Revelation 1:1-3"],
    studentTakeaway: "Different kinds of writing ask different kinds of questions. Reading carefully starts with noticing what kind of passage you are in."
  },
  {
    id: "old-testament",
    order: 4,
    title: "How to Read the Old Testament",
    shortTitle: "Read the Old Testament",
    minutes: 8,
    summary:
      "The Old Testament introduces the world of the Bible, the promises of God, the pain of sin, and the hope Jesus fulfills. Students learn to read it without skipping past it.",
    videoLabel: "Old Testament Overview",
    videoEmbedUrl: "https://www.youtube.com/embed/ALsluAKBZ-c",
    infographicLabel: "Old Testament guide",
    badge: "Do Not Skip the Beginning",
    tools: ["Promise", "Covenant", "Wisdom", "Prophets", "Hope"],
    practice: "Read Genesis 12:1-3 and ask what God promises before asking what you should do.",
    groupQuestion: "Why is it hard to read the Old Testament, and what helps?",
    keyPassages: ["Genesis 12:1-3", "Exodus 34:6-7", "Isaiah 53", "Jeremiah 31:31-34"],
    studentTakeaway: "The Old Testament is not the part to skip. It gives the beginning of the story Jesus fulfills."
  },
  {
    id: "new-testament",
    order: 5,
    title: "How to Read the New Testament",
    shortTitle: "Read the New Testament",
    minutes: 8,
    summary:
      "The New Testament shows Jesus, the first followers of Jesus, and the hope of all things made new. Students learn to read the Gospels, letters, and Revelation with patience.",
    videoLabel: "New Testament Overview",
    videoEmbedUrl: "https://www.youtube.com/embed/Q0BrP8bqj0c",
    infographicLabel: "New Testament guide",
    badge: "Follow Jesus Closely",
    tools: ["Gospels", "Acts", "Letters", "Revelation", "Hope"],
    practice: "Read Mark 1:14-20. Ask what Jesus announces, what he invites, and how people respond.",
    groupQuestion: "What do you notice when you read Jesus' words before jumping to application?",
    keyPassages: ["Mark 1:14-20", "Luke 24:44-49", "Acts 1:8", "Revelation 21:1-5"],
    studentTakeaway: "The New Testament centers on Jesus and shows how his first followers learned to live as his people."
  },
  {
    id: "translations",
    order: 6,
    title: "How We Got the Bible and Translations",
    shortTitle: "Trust the text",
    minutes: 7,
    summary:
      "Students get a calm, simple overview of how the Bible came to us, why translations exist, and how to choose one without getting overwhelmed.",
    videoLabel: "Translations video slot",
    infographicLabel: "Translation spectrum",
    badge: "Use Good Tools",
    tools: ["Manuscripts", "Translation", "Study Bible notes", "Compare carefully"],
    practice: "Compare the same short passage in two translations. Write what is clearer in each one.",
    groupQuestion: "What questions do people have about whether the Bible can be trusted?",
    keyPassages: ["Nehemiah 8:1-8", "Luke 1:1-4", "2 Peter 1:16-21"],
    studentTakeaway: "Translations exist because people worked carefully to make the Bible understandable in languages people actually read."
  },
  {
    id: "how-not-to-read",
    order: 7,
    title: "How Not to Read Your Bible",
    shortTitle: "Avoid bad shortcuts",
    minutes: 6,
    summary:
      "This guide names common shortcuts: grabbing a verse out of context, making every detail about me, or using Scripture to win an argument.",
    videoLabel: "Plot and Biblical Context",
    videoEmbedUrl: "https://www.youtube.com/embed/dLFCE8z__hw",
    infographicLabel: "Common shortcuts",
    badge: "Handle With Care",
    tools: ["Do not cherry-pick", "Do not rush", "Do not weaponize", "Do not make it all about me"],
    practice: "Choose a verse you have heard quoted often. Read the paragraph before and after it.",
    groupQuestion: "What is one Bible-reading shortcut you have seen, and why is it risky?",
    keyPassages: ["Matthew 4:1-11", "2 Timothy 2:15", "James 1:22-25"],
    studentTakeaway: "Bad shortcuts can make the Bible say what we already wanted. Careful reading slows down enough to listen."
  },
  {
    id: "practical-tips",
    order: 8,
    title: "Practical Reading Tips",
    shortTitle: "Keep going",
    minutes: 5,
    summary:
      "A simple routine for real life: read a small section, notice what is there, ask honest questions, pray simply, and bring what you notice to your group.",
    videoLabel: "Ancient Jewish Meditation Literature",
    videoEmbedUrl: "https://www.youtube.com/embed/VhmlJBUIoLk",
    infographicLabel: "Simple reading routine",
    badge: "Keep Showing Up",
    tools: ["Read a little", "Notice what is repeated", "Ask one honest question", "Bring it to group"],
    practice: "Read for ten minutes. Write one sentence that begins, 'I noticed...'",
    groupQuestion: "What would make Bible reading feel more possible this week?",
    keyPassages: ["Psalm 1", "Acts 17:11", "James 1:22"],
    studentTakeaway: "Faithful Bible reading is usually small, honest, repeated attention. You do not have to master everything at once."
  }
];

export function getHowToReadModule(moduleId: string) {
  return howToReadModules.find((module) => module.id === moduleId);
}
