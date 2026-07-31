import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

export const competitionGuestSermon = {
  title: "The Unlikely House",
  passage: "Luke 19:1-10; Joshua 2:1; Joshua 6:22-25; Matthew 1:5-6; Genesis 1-3",
  bigIdea: "Jesus intentionally enters unlikely houses and forms unlikely people into His Kingdom.",
  body: `Jesus enters Jericho on purpose and calls Zacchaeus down from the tree. Salvation comes to a house the crowd had already written off.\n\nRahab's house in Jericho and Zacchaeus' house form a biblical echo: in both stories God moves toward people others overlook. The echo helps us notice God's character; it is not a direct prophetic fulfillment.\n\nWe can become distracted by falling cities and overturned tables while missing the table Jesus is setting. Jesus seeks and saves the lost, then makes room for unlikely people to belong and participate in His Kingdom.`,
  theologicalGuardrail: "Treat Rahab and Zacchaeus as a biblical echo, not a direct prophetic fulfillment. Preserve the distinction between a canonical echo and a direct textual claim."
} as const;

export const competitionLeaderResources: Array<{ title: string; detail: string; href?: string }> = [
  { title: "Leader Overview", detail: "See the sermon arc, big idea, and the guardrail for the Rahab/Zacchaeus connection." },
  { title: "Small Group Guide", detail: "Guide observation and interpretation before application." },
  { title: "Discussion Questions", detail: "Help students notice whom Jesus sees and how grace changes response." },
  { title: "Scripture Cross References", detail: "Luke 19:1-10; Joshua 2; Joshua 6:22-25; Matthew 1:5-6; Genesis 1-3." },
  { title: "Teaching Notes", detail: competitionGuestSermon.theologicalGuardrail },
  { title: "Sermon Slides", detail: "Attached slide plan for The Unlikely House.", href: "/competition-demo/the-unlikely-house-slides.pptx" },
  { title: "Sermon Audio Overview", detail: "Supplied teaching overview for The Unlikely House.", href: "/competition-demo/the-unlikely-house-audio-overview.m4a" }
] as const;

export const competitionGuestQuestions: StudentDiscussionPrompt[] = [
  {
    id: "guest_question_zacchaeus_grace", submittedByUserId: "guest_student", submittedByName: "Guest Student", submittedByEmail: "guest@example.test",
    question: "Why would Jesus spend time with Zacchaeus when everyone knew he was corrupt?", scriptureReference: "Luke 19:1-10", metanarrativeMovement: "Jesus / Kingdom Fulfilled",
    aiProvider: "guest-stock-responses", aiStatus: "generated", aiModel: "deterministic guest seed", aiModelTier: "default", aiModelReason: "Seeded ministry context for competition review.", aiConfidence: 0.94,
    topicTags: ["grace", "repentance", "restitution", "Luke 19"], escalationReason: "", safetyLabel: "safe", safetyNotes: "Leader review remains required.",
    discussionPrompt: "Jesus is not approving Zacchaeus's corruption. Notice that grace moves toward him first, and his response includes repentance and fourfold restitution. How do grace and changed behavior belong together here?",
    leaderNotes: "Keep the distinction clear: welcome is not approval of harm.", status: "approved", deliveryStatus: "not_requested", deliveryMessage: "Review-ready only; not sent.", approvedByUserId: "guest_staff_nextgen", approvedAt: "2026-07-30T12:00:00.000Z", createdAt: "2026-07-30T12:00:00.000Z", updatedAt: "2026-07-30T12:00:00.000Z"
  },
  {
    id: "guest_question_rahab_echo", submittedByUserId: "guest_student", submittedByName: "Guest Student", submittedByEmail: "guest@example.test",
    question: "Are Rahab and Zacchaeus actually connected?", scriptureReference: "Joshua 2; Joshua 6:22-25; Luke 19:1-10", metanarrativeMovement: "Jesus / Kingdom Fulfilled",
    aiProvider: "guest-stock-responses", aiStatus: "generated", aiModel: "deterministic guest seed", aiModelTier: "default", aiModelReason: "Seeded ministry context for competition review.", aiConfidence: 0.9,
    topicTags: ["biblical theology", "Jericho", "Rahab", "Zacchaeus"], escalationReason: "", safetyLabel: "safe", safetyNotes: "Do not overstate the connection.",
    discussionPrompt: "Separate three things: direct biblical teaching, thematic biblical echoes, and theological inference. Rahab and Zacchaeus are not presented as a direct prophetic fulfillment; their shared Jericho setting and unlikely-house pattern can help us notice a canonical echo without claiming more than the text says.",
    leaderNotes: "Use the sermon guardrail; invite students to name what the passages directly say.", status: "approved", deliveryStatus: "not_requested", deliveryMessage: "Review-ready only; not sent.", approvedByUserId: "guest_staff_nextgen", approvedAt: "2026-07-30T12:05:00.000Z", createdAt: "2026-07-30T12:05:00.000Z", updatedAt: "2026-07-30T12:05:00.000Z"
  }
];

export const competitionJourneyJournal = {
  title: "The Unlikely House Journey",
  days: [
    ["Receive", "Read Luke 19:1-10. Notice what Jesus sees that the crowd misses."],
    ["Explore", "Read Joshua 2 and Joshua 6. Compare Rahab's house and Zacchaeus' house without claiming they are identical stories."],
    ["Practice", "Identify someone you naturally overlook. Pray for Jesus' eyes."],
    ["Walk", "Take one intentional step toward someone you normally would not notice."],
    ["See", "Where might Jesus be setting a table while everyone else is focused on what is being overturned? End with a brief prayer."]
  ]
} as const;
