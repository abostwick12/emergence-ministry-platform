export const meridianShadowCategories = [
  "old_testament_difficulty",
  "theology_proper",
  "eschatology",
  "christology_salvation",
  "suffering_prayer_providence",
  "scripture_interpretation",
  "ethics_identity_culture"
] as const;

export type MeridianShadowCategory = (typeof meridianShadowCategories)[number];
export type MeridianShadowHandling = "explain_with_care" | "acknowledge_uncertainty" | "pastoral_care";
export type MeridianShadowSensitivity = "standard" | "sensitive" | "high_sensitivity";

export type MeridianShadowFacet = {
  label: string;
  anyOf: string[];
};

export type MeridianShadowScenario = {
  id: string;
  ordinal: number;
  category: MeridianShadowCategory;
  question: string;
  reasoningTypes: Array<"historical_critical" | "doctrinal" | "existential" | "textual" | "pastoral">;
  handling: MeridianShadowHandling;
  sensitivity: MeridianShadowSensitivity;
  requiredFacets: MeridianShadowFacet[];
  pilot: boolean;
};

// The questions were supplied and locked by the user on 2026-08-03. Facets
// restate observable parts of each question and intentionally contain no
// preferred answer, approved claim, theological verdict, or provider prose.
export const meridianProviderShadowCorpusV1 = {
  version: "2026-08-03.v1",
  locked: true,
  source: "user_supplied_benchmark_questions",
  questionReviewStatus: "user_supplied_locked",
  facetReviewStatus: "machine_drafted_pending_human_review",
  cases: [
    scenario(1, "old_testament_difficulty", "Why did God command Israel to wipe out entire nations, including children?", ["historical_critical", "doctrinal", "pastoral"], "pastoral_care", "high_sensitivity", [facet("divine command", "command", "ordered"), facet("Israel and nations", "Israel", "nations", "Canaan"), facet("children", "children", "families")], true),
    scenario(2, "old_testament_difficulty", "Why did God let Job suffer just to prove a point to Satan?", ["textual", "doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("Job", "Job"), facet("suffering", "suffer", "suffering"), facet("Satan", "Satan", "adversary")]),
    scenario(3, "old_testament_difficulty", "Did God create evil, or just allow it?", ["doctrinal", "existential"], "explain_with_care", "sensitive", [facet("God's relationship to evil", "God", "divine"), facet("evil", "evil", "sin"), facet("create or allow", "create", "allow", "permit")]),
    scenario(4, "old_testament_difficulty", "Why does God seem so angry in the Old Testament but loving in the New Testament?", ["textual", "doctrinal", "existential"], "explain_with_care", "sensitive", [facet("Old Testament", "Old Testament", "Hebrew Bible"), facet("New Testament", "New Testament"), facet("anger and love", "anger", "angry", "love", "loving")]),
    scenario(5, "old_testament_difficulty", "Why did God test Abraham by telling him to sacrifice Isaac?", ["textual", "doctrinal", "pastoral"], "pastoral_care", "sensitive", [facet("Abraham", "Abraham"), facet("Isaac", "Isaac"), facet("test and sacrifice", "test", "sacrifice")]),
    scenario(6, "old_testament_difficulty", "Why does the Bible have laws about slavery instead of condemning it outright?", ["historical_critical", "textual", "doctrinal", "pastoral"], "pastoral_care", "high_sensitivity", [facet("biblical laws", "law", "laws"), facet("slavery", "slavery", "slave"), facet("condemnation", "condemn", "prohibit", "abolish")], true),

    scenario(7, "theology_proper", "Who is the Angel of the Lord, and is he Jesus?", ["textual", "doctrinal"], "acknowledge_uncertainty", "standard", [facet("Angel of the Lord", "Angel of the Lord"), facet("identity", "identity", "who"), facet("relationship to Jesus", "Jesus", "Christ")]),
    scenario(8, "theology_proper", "If God is three persons, why isn't that basically three gods?", ["doctrinal", "existential"], "explain_with_care", "sensitive", [facet("three persons", "three persons", "Father Son and Holy Spirit"), facet("one God", "one God", "one being"), facet("three gods concern", "three gods", "tritheism")], true),
    scenario(9, "theology_proper", "Can God create a rock so heavy He can't lift it?", ["doctrinal", "existential"], "explain_with_care", "standard", [facet("God's power", "power", "omnipotence", "all powerful"), facet("rock paradox", "rock", "paradox"), facet("logical limit", "logic", "contradiction", "possible")]),
    scenario(10, "theology_proper", "Does God know the future, and if so, do I actually have free will?", ["doctrinal", "existential"], "acknowledge_uncertainty", "sensitive", [facet("God's knowledge", "know", "knowledge", "foreknowledge"), facet("future", "future"), facet("human freedom", "free will", "freedom", "choice")]),
    scenario(11, "theology_proper", "What are angels, and what do they actually do?", ["textual", "doctrinal"], "explain_with_care", "standard", [facet("nature of angels", "angels", "spiritual beings"), facet("activity", "do", "serve", "messengers"), facet("biblical role", "Bible", "biblical", "Scripture")]),

    scenario(12, "eschatology", "What is heaven actually like, and what will we do there forever?", ["textual", "doctrinal", "existential"], "acknowledge_uncertainty", "standard", [facet("nature of heaven", "heaven", "new creation"), facet("human activity", "do", "work", "worship"), facet("eternity", "forever", "eternal")]),
    scenario(13, "eschatology", "Is hell literal fire, or is that symbolic?", ["textual", "doctrinal", "existential"], "acknowledge_uncertainty", "sensitive", [facet("hell", "hell", "judgment"), facet("fire imagery", "fire"), facet("literal or symbolic", "literal", "symbolic", "metaphor")]),
    scenario(14, "eschatology", "What happens to babies or people who never heard about Jesus when they die?", ["doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("babies", "babies", "infants", "children"), facet("people who never heard", "never heard", "unreached"), facet("death and salvation", "die", "death", "salvation")], true),
    scenario(15, "eschatology", "Will we recognize our family and pets in heaven?", ["doctrinal", "existential", "pastoral"], "acknowledge_uncertainty", "sensitive", [facet("recognition", "recognize", "know"), facet("family", "family", "loved ones"), facet("pets", "pets", "animals")]),
    scenario(16, "eschatology", "What's the difference between the second coming and the rapture?", ["textual", "doctrinal"], "acknowledge_uncertainty", "standard", [facet("second coming", "second coming", "return of Christ"), facet("rapture", "rapture"), facet("difference", "difference", "distinction")]),

    scenario(17, "christology_salvation", "If Jesus was fully God, how could He actually be tempted?", ["textual", "doctrinal"], "explain_with_care", "sensitive", [facet("Jesus as God", "fully God", "divine"), facet("temptation", "tempted", "temptation"), facet("humanity", "human", "fully man")], true),
    scenario(18, "christology_salvation", "Why did Jesus have to die? Couldn't God just forgive us without the cross?", ["doctrinal", "existential", "pastoral"], "explain_with_care", "sensitive", [facet("Jesus' death", "Jesus", "die", "death"), facet("forgiveness", "forgive", "forgiveness"), facet("cross", "cross", "atonement")], true),
    scenario(19, "christology_salvation", "Can I lose my salvation, or once saved always saved?", ["textual", "doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("salvation", "salvation", "saved"), facet("loss or security", "lose", "secure", "security"), facet("perseverance", "persevere", "continue", "faithfulness")]),
    scenario(20, "christology_salvation", "What happened to Jesus between His death and resurrection?", ["textual", "doctrinal"], "acknowledge_uncertainty", "standard", [facet("Jesus", "Jesus", "Christ"), facet("death", "death", "died"), facet("resurrection interval", "resurrection", "between", "three days")]),
    scenario(21, "christology_salvation", "Why does John say \"no one has ever seen God\" if people in the Old Testament saw Him?", ["textual", "doctrinal"], "explain_with_care", "standard", [facet("John's statement", "John", "no one has ever seen"), facet("Old Testament appearances", "Old Testament", "appear", "saw"), facet("apparent tension", "tension", "difference", "seen God")]),

    scenario(22, "suffering_prayer_providence", "If God is good and all-powerful, why do bad things happen to good people?", ["doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("God's goodness", "good", "goodness"), facet("God's power", "all powerful", "power", "omnipotent"), facet("suffering", "bad things", "suffering", "evil")], true),
    scenario(23, "suffering_prayer_providence", "Why does it feel like God doesn't answer my prayers?", ["existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("felt experience", "feel", "felt"), facet("God's response", "answer", "silence", "unanswered"), facet("prayer", "prayer", "pray")], true),
    scenario(24, "suffering_prayer_providence", "Does praying actually change what God does, or does He already have it planned?", ["doctrinal", "existential", "pastoral"], "acknowledge_uncertainty", "sensitive", [facet("prayer", "prayer", "praying"), facet("change", "change", "respond"), facet("divine plan", "planned", "plan", "providence")]),
    scenario(25, "suffering_prayer_providence", "Why do bad things happen to Christians who are doing everything right?", ["doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("Christians", "Christians", "believers"), facet("faithfulness", "doing everything right", "faithful", "obedient"), facet("suffering", "bad things", "suffering")]),

    scenario(26, "scripture_interpretation", "How do we know the Bible wasn't just changed or made up over time?", ["historical_critical", "textual", "existential"], "explain_with_care", "standard", [facet("Bible", "Bible", "Scripture"), facet("textual change", "changed", "transmission", "manuscripts"), facet("historical reliability", "made up", "history", "reliable")], true),
    scenario(27, "scripture_interpretation", "Why are there four different Gospels that don't say exactly the same thing?", ["historical_critical", "textual"], "explain_with_care", "standard", [facet("four Gospels", "four Gospels", "Matthew Mark Luke John"), facet("differences", "different", "differences"), facet("relationship of accounts", "accounts", "perspectives", "authors")]),
    scenario(28, "scripture_interpretation", "How do I know which Old Testament laws still apply to me today?", ["textual", "doctrinal", "existential"], "explain_with_care", "sensitive", [facet("Old Testament laws", "Old Testament", "laws"), facet("present application", "apply", "today"), facet("interpretive framework", "covenant", "fulfill", "interpret")]),

    scenario(29, "ethics_identity_culture", "What does the Bible actually say about gender and sexuality, and why does it matter?", ["textual", "doctrinal", "existential", "pastoral"], "pastoral_care", "high_sensitivity", [facet("Bible", "Bible", "Scripture"), facet("gender", "gender"), facet("sexuality", "sexuality", "sexual"), facet("significance", "matter", "importance")], true),
    scenario(30, "ethics_identity_culture", "Is it wrong to doubt God, or is doubting a sin?", ["textual", "doctrinal", "existential", "pastoral"], "pastoral_care", "sensitive", [facet("doubt", "doubt", "doubting"), facet("God", "God", "faith"), facet("sin or wrongdoing", "sin", "wrong")])
  ] satisfies MeridianShadowScenario[]
} as const;

function scenario(
  ordinal: number,
  category: MeridianShadowCategory,
  question: string,
  reasoningTypes: MeridianShadowScenario["reasoningTypes"],
  handling: MeridianShadowHandling,
  sensitivity: MeridianShadowSensitivity,
  requiredFacets: MeridianShadowFacet[],
  pilot = false
): MeridianShadowScenario {
  return {
    id: `theology_${String(ordinal).padStart(2, "0")}`,
    ordinal,
    category,
    question,
    reasoningTypes,
    handling,
    sensitivity,
    requiredFacets,
    pilot
  };
}

function facet(label: string, ...anyOf: string[]): MeridianShadowFacet {
  return { label, anyOf };
}
