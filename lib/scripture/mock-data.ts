import {
  metanarrativeMovements,
  type ScripturePlan,
  type ScriptureResource,
  type ScriptureReviewItem,
  type ScriptureStudySeed
} from "@/lib/scripture/types";

export { metanarrativeMovements };

export const scripturePlans: ScripturePlan[] = [
  {
    id: "creation-covenant",
    title: "Beginnings and Covenant",
    audience: "Middle and high school groups",
    duration: "4 weeks",
    primaryScripture: "Genesis 1-12 overview",
    movement: "Creation",
    summary: "Trace how Genesis introduces God, humanity, blessing, rebellion, and the promise that God will bless the nations.",
    contextFocus: "Read each scene as part of the opening movement of Scripture before jumping to personal application.",
    weeklyRhythm: ["Creation and image bearing", "Fall and fractured relationships", "Flood and mercy", "Abraham and blessing"],
    discussionPrompts: [
      "What do these chapters show about God's purpose for people?",
      "Where do you see both human failure and God's patient rescue?"
    ],
    guardrailNotes: [
      "Do not treat Genesis as only a collection of moral examples.",
      "Avoid making every detail a hidden symbol."
    ]
  },
  {
    id: "exodus-formation",
    title: "Deliverance and Formation",
    audience: "Student leadership huddle",
    duration: "5 weeks",
    primaryScripture: "Exodus 1-20 overview",
    movement: "Exodus / Deliverance",
    summary: "Follow Israel from slavery to worship, seeing deliverance as the beginning of being formed into God's covenant people.",
    contextFocus: "Notice how rescue, covenant, law, worship, and community identity belong together.",
    weeklyRhythm: ["Slavery and lament", "Passover and rescue", "Wilderness trust", "Covenant at Sinai", "Law as formation"],
    discussionPrompts: [
      "How does God respond to suffering and oppression in the story?",
      "Why does deliverance lead into worship and obedience instead of self-rule?"
    ],
    guardrailNotes: [
      "Do not flatten Israel's story into generic life advice.",
      "Distinguish what the text directly teaches from later theological connections."
    ]
  },
  {
    id: "kingdom-waiting",
    title: "Kingdom, Exile, and Waiting",
    audience: "High school Bible study",
    duration: "6 weeks",
    primaryScripture: "1 Samuel, Psalms, Isaiah, and Ezra overview",
    movement: "Prophets / Exile",
    summary: "Explore kings, wisdom, prophetic warning, exile, and hope while asking what faithful waiting looks like.",
    contextFocus: "Hold together the beauty of God's promises and the seriousness of covenant unfaithfulness.",
    weeklyRhythm: ["Israel asks for a king", "David and covenant hope", "Wisdom and worship", "Prophetic warning", "Exile", "Return and waiting"],
    discussionPrompts: [
      "What kind of king does Israel need, and where do human kings fail?",
      "How do the prophets call God's people back without erasing hope?"
    ],
    guardrailNotes: [
      "Do not force every Old Testament moment into a quick one-to-one symbol.",
      "Let the Old Testament speak in its own context before tracing fulfillment."
    ]
  }
];

export const studySeeds: ScriptureStudySeed[] = [
  {
    id: "mark-kingdom",
    title: "What does Jesus mean by kingdom?",
    audience: "Student-led small group",
    primaryScripture: "Mark 1:14-20",
    movement: "Jesus / Kingdom Fulfilled",
    purpose: "Help students observe Jesus' announcement before turning it into a personal action step.",
    contextQuestion: "What has Mark already told us about Jesus before this announcement?",
    communityQuestion: "How would our group describe repentance and trust without using church shorthand?"
  },
  {
    id: "acts-spirit",
    title: "A Spirit-formed witness",
    audience: "Mixed grade discussion circle",
    primaryScripture: "Acts 2:1-13",
    movement: "Church / Spirit",
    purpose: "See Pentecost in the story of God's mission instead of treating it as a random powerful moment.",
    contextQuestion: "How does this scene connect to Jesus' promise and Israel's feast calendar?",
    communityQuestion: "What would humble witness look like for students this week?"
  }
];

export const scriptureResources: ScriptureResource[] = [
  {
    id: "context",
    title: "Context",
    summary: "Ask where the passage sits in the book, covenant story, genre, and original audience before asking what it means for you.",
    studentPractice: "Read the paragraph before and after the passage. Write one sentence about what is happening in the story."
  },
  {
    id: "observation",
    title: "Observation",
    summary: "Slow down and notice repeated words, contrasts, commands, promises, characters, setting, and flow of thought.",
    studentPractice: "List what the text says before explaining why it matters."
  },
  {
    id: "interpretation",
    title: "Interpretation",
    summary: "Ask what the passage meant in context, what it reveals about God and people, and how it connects to the wider biblical story.",
    studentPractice: "Separate direct biblical teaching from theological inference and creative connection."
  },
  {
    id: "application",
    title: "Application",
    summary: "Application matters, but the passage is not automatically about me. Move from context to faithful response.",
    studentPractice: "Name one response that fits the passage instead of using the passage to support a pre-decided answer."
  },
  {
    id: "discussion",
    title: "Discussion",
    summary: "Good groups wrestle together with humility. Make room for questions, careful disagreement, and leader review.",
    studentPractice: "Ask, 'Where do you see that in the text?' and 'What might we be missing?'"
  },
  {
    id: "prayer",
    title: "Prayer",
    summary: "Prayer responds to what God has shown in Scripture. Let the passage shape praise, confession, request, and trust.",
    studentPractice: "Turn one observation from the text into a short prayer."
  },
  {
    id: "proof-texting",
    title: "Avoiding proof-texting",
    summary: "Do not pull a verse away from its setting just to win an argument or make a fast point.",
    studentPractice: "Before quoting a verse, explain the paragraph it belongs to."
  },
  {
    id: "typology",
    title: "Avoiding forced typology",
    summary: "Scripture has patterns that point forward, but not every object, number, or character is a secret code.",
    studentPractice: "Use clear textual links and leader review before making a connection."
  },
  {
    id: "better-questions",
    title: "Asking better questions",
    summary: "Better questions move from context to meaning to faithful response instead of hunting for quick answers.",
    studentPractice: "Try: What is happening? Why does it matter here? What does it reveal? How should we respond together?"
  }
];

export const scriptureReviewQueue: ScriptureReviewItem[] = [
  {
    id: "review-exodus-formation",
    title: "Exodus and Formation",
    type: "Reading plan draft",
    submittedBy: "Maya Thompson",
    audience: "High school small group",
    primaryScripture: "Exodus 1-20 overview",
    movement: "Exodus / Deliverance",
    status: "Awaiting leader review",
    guardrailFlags: ["Needs more context", "Application may be too broad", "Clarify main idea"],
    leaderNotes:
      "The reading rhythm is strong. Ask the student to add a little more context on Passover and covenant before moving to personal response.",
    suggestedNextAction: "Request a short context revision before approving the draft for group use."
  },
  {
    id: "review-mark-kingdom",
    title: "What does Jesus mean by kingdom?",
    type: "Student-led study draft",
    submittedBy: "Eli Carter",
    audience: "Mixed grade discussion circle",
    primaryScripture: "Mark 1:14-20",
    movement: "Jesus / Kingdom Fulfilled",
    status: "Ready for careful review",
    guardrailFlags: ["Strong discussion question", "Avoid forced connection", "Clarify main idea"],
    leaderNotes:
      "The discussion question invites the group back to the text. Review the kingdom connection so it stays anchored in Mark's opening scene.",
    suggestedNextAction: "Preview with the student leader and name direct teaching before creative connections."
  }
];
