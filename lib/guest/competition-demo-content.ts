import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

export const competitionGuestSermon = {
  title: "The Unlikely House",
  passage: "Luke 19:1-10; Joshua 2:1; Joshua 6:22-25; Matthew 1:5-6; Genesis 1-3",
  bigIdea: "Jesus intentionally enters unlikely houses and forms unlikely people into His Kingdom.",
  body: `THE UNLIKELY HOUSE\n\nLuke 19:1-10; Joshua 2:1; Joshua 6:22-25; Matthew 1:5-6; Genesis 1-3\n\nBig idea: Jesus intentionally enters unlikely houses and forms unlikely people into His Kingdom.\n\nJesus enters Jericho on purpose. Luke does not introduce the city as a random stop on the way somewhere else. Jesus is passing through, and a man named Zacchaeus is there. He is a chief tax collector, wealthy, and publicly despised. The crowd has already decided what kind of person belongs at the edge. Zacchaeus wants to see Jesus, but the crowd blocks his view, so he runs ahead and climbs a sycamore tree.\n\nWhen Jesus reaches that spot, he looks up. Jesus sees the man the crowd has learned not to see. He calls Zacchaeus by name and says, “I must stay at your house today.” The invitation is not approval of Zacchaeus's corruption. It is grace moving toward a person before that person has repaired anything. Zacchaeus receives Jesus joyfully, and his response is concrete: he gives to the poor and makes restitution. Grace is not permissiveness; it makes repentance and restored responsibility possible.\n\nThe crowd grumbles because Jesus has gone to be the guest of a sinner. But Jesus says that salvation has come to this house, and then explains his mission: the Son of Man came to seek and to save the lost. The house everyone wanted to keep outside the story becomes the place where Jesus makes salvation visible.\n\nThat is why Jericho helps us read the story carefully. In Joshua 2, Rahab's house sits in a city under judgment. Rahab acts on what she has heard about the God of Israel, protects the spies, and is preserved with her household. Joshua 6 remembers that Rahab and her family were brought out, and Matthew 1 includes Rahab in the family line that leads to Jesus. God has always been at work drawing unlikely people into his covenant mercy.\n\nWe should say no more than Scripture says. Rahab and Zacchaeus are not presented as a direct prophetic fulfillment of one another. Their shared Jericho setting and their homes provide a biblical echo: in both stories, God moves toward people others overlook and brings them into his people. The echo helps us notice God's character; it does not give us permission to make a direct textual claim the Bible does not make.\n\nGenesis 1-3 gives the larger frame. Human beings are made for communion with God, but sin fractures trust, belonging, and the way we see one another. We often build crowds that sort people into worthy and unworthy, clean and unclean, useful and disposable. Jesus does not ignore sin, but he refuses to let shame have the last word. He comes near, calls by name, and creates a new future.\n\nSo the question is not only, “Who is Zacchaeus?” It is also, “Where do we stand in the crowd?” Whom have we made difficult to see? Whom do we believe should have to climb higher, prove more, or stay outside before they can be welcomed? Jesus's welcome is not vague sentiment. It is an invitation into a changed life, a repaired life, a life that begins to look like the Kingdom.\n\nWe can become distracted by falling cities and overturned tables while missing the table Jesus is setting. The table is already set for the people who know they need mercy. There is room for the person carrying a public failure, the person who has been labeled, and the person who is ready to turn around. Jesus seeks and saves the lost, then makes room for unlikely people to belong and participate in his Kingdom.\n\nAs leaders, we can help students notice both halves of the story: Jesus moves toward sinners with real grace, and his grace produces a real response. Invite students to name what the text directly says, to resist labeling people by their worst moment, and to take one intentional step toward someone they normally would not notice. The table is set. Will we sit down with Jesus and see what he will do next?`,
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
