import type { StudentJourneyPassageReason, StudentJourneySelection } from "@/lib/scripture/student-journey-draft";
import { matchQuestionToStoryline, type StorylineQuestionMatch } from "@/lib/scripture/storyline-guide";

type JourneySelectionInput = {
  question: string;
  scriptureReference?: string;
  topicTags?: string[];
};

type StrictJourneyRule = {
  id: string;
  storylineSeed: string;
  namedPattern: RegExp;
  conceptPattern: RegExp;
  referencePattern: RegExp;
  primaryReferences: string[];
  why: string;
};

const strictJourneyRules: StrictJourneyRule[] = [
  {
    id: "saul-kingship",
    storylineSeed: "Saul king Samuel",
    namedPattern: /\b(saul|1\s*samuel|first\s+samuel|samuel)\b/,
    conceptPattern: /\b(first king|asked? for a king|choose\w* a king|human king|monarchy)\b/,
    referencePattern: /\b1\s*samuel\s+(?:8|9|10|11|12)(?::\d+)?\b/,
    primaryReferences: ["1 Samuel 8", "1 Samuel 9-10", "1 Samuel 11-12"],
    why:
      "1 Samuel 8-12 directly narrates Israel asking for a king, Samuel's warning, Saul's selection, and Saul's public confirmation. It is the same narrative and the same figures named in the question."
  },
  {
    id: "image-bearing-vocation",
    storylineSeed: "image of God",
    namedPattern: /\b(image of god|imago dei|image[- ]bearer)\b/,
    conceptPattern: /\b(god's image|made in (?:god's|the) image)\b/,
    referencePattern: /\bgenesis\s+1(?::2[6-8](?:-\d+)?)?\b/,
    primaryReferences: ["Genesis 1:26-31", "Psalm 8", "Colossians 3:9-11"],
    why:
      "Genesis 1:26-31 explicitly names humanity as God's image and describes the vocation given to image-bearers. Psalm 8 and Colossians 3 are explicit biblical developments of dignity, vocation, and renewed humanity."
  },
  {
    id: "garden-trust",
    storylineSeed: "Genesis garden tree",
    namedPattern: /\b(eden|garden of eden|tree of (?:the )?knowledge|serpent)\b/,
    conceptPattern: /\b(why did god put the tree|garden command|adam and eve)\b/,
    referencePattern: /\bgenesis\s+[23](?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Genesis 2:4-17", "Genesis 3:1-13", "Genesis 3:14-24"],
    why:
      "Genesis 2-3 contains the garden, the command concerning the tree, the human choice, and God's response. These readings stay inside the narrative the question asks about."
  },
  {
    id: "covenant-promise",
    storylineSeed: "Abraham covenant promise",
    namedPattern: /\b(abraham|abram|isaac|jacob|genesis\s+(?:12|15|17|22))\b/,
    conceptPattern: /\b(abrahamic covenant|covenant with abraham|promise to abraham|bless(?:ing)? (?:to|for) the nations)\b/,
    referencePattern: /\bgenesis\s+(?:12|15|17|22)(?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Genesis 12:1-3", "Genesis 15", "Genesis 17:1-8"],
    why:
      "Genesis 12, 15, and 17 directly tell the Abrahamic covenant story: God's promise of family, land, covenant relationship, and blessing for the nations."
  },
  {
    id: "exodus-deliverance",
    storylineSeed: "Exodus deliverance Moses Pharaoh",
    namedPattern: /\b(moses|pharaoh|egypt|red sea|passover|exodus)\b/,
    conceptPattern: /\b(deliverance from egypt|israel(?:ites)? leave egypt|freed from slavery)\b/,
    referencePattern: /\bexodus\s+(?:1[2-5]|[1-9])(?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Exodus 3", "Exodus 12", "Exodus 14"],
    why:
      "Exodus 3, 12, and 14 directly trace God's call of Moses, Passover, and Israel's deliverance through the sea within the same rescue narrative."
  },
  {
    id: "law-formation",
    storylineSeed: "Sinai law commandments",
    namedPattern: /\b(sinai|ten commandments|leviticus|deuteronomy|torah)\b/,
    conceptPattern: /\b(old testament law|why (?:did )?god give (?:the )?(?:law|commandments)|clean and unclean)\b/,
    referencePattern: /\b(?:exodus\s+(?:19|20)|leviticus\s+\d+|deuteronomy\s+\d+)(?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Exodus 19-20", "Deuteronomy 6:1-9", "Leviticus 19:1-18"],
    why:
      "These passages place Israel's commands inside covenant rescue, communal formation, and love of God and neighbor rather than treating the law as disconnected rules."
  },
  {
    id: "presence-temple",
    storylineSeed: "tabernacle temple presence",
    namedPattern: /\b(tabernacle|temple|ark of the covenant|priesthood)\b/,
    conceptPattern: /\b(god's presence|god dwell\w* with|holy place)\b/,
    referencePattern: /\b(?:exodus\s+(?:25|40)|1\s*kings\s+8|john\s+1:14)\b/,
    primaryReferences: ["Exodus 25:1-9", "Exodus 40:34-38", "John 1:14"],
    why:
      "Exodus 25 and 40 directly frame the tabernacle as God's dwelling among Israel, while John 1:14 explicitly develops that dwelling theme around Jesus."
  },
  {
    id: "rahab-jericho",
    storylineSeed: "Rahab Jericho Joshua",
    namedPattern: /\brahab\b/,
    conceptPattern: /\b(walls? of jericho|spies? in jericho)\b/,
    referencePattern: /\bjoshua\s+(?:2|6)(?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Joshua 2", "Joshua 6:22-25"],
    why:
      "Joshua 2 and Joshua 6 remain in Rahab's Jericho narrative: her reception of the spies, her confession about Israel's God, and the rescue of her household when the city falls."
  },
  {
    id: "zacchaeus-jericho",
    storylineSeed: "Zacchaeus Jesus Jericho",
    namedPattern: /\bzacchaeus\b/,
    conceptPattern: /\b(zacchaeus in the tree|tax collector in jericho)\b/,
    referencePattern: /\bluke\s+19(?::\d+(?:-\d+)?)?\b/,
    primaryReferences: ["Luke 19:1-10"],
    why:
      "Luke 19:1-10 directly narrates Jesus' encounter with Zacchaeus in Jericho, including Zacchaeus's response and Jesus' explanation of his mission to seek and save the lost."
  },
  {
    id: "kingdom-messiah",
    storylineSeed: "David king kingdom Messiah",
    namedPattern: /\b(david|solomon|messiah|son of david|2\s*samuel|second\s+samuel|1\s*kings|first\s+kings)\b/,
    conceptPattern: /\b(god's kingdom|promised king|davidic covenant|king of israel|messianic king)\b/,
    referencePattern: /\b(?:2\s*samuel\s+7|1\s*kings\s+\d+|psalm\s+2|mark\s+1:1[45])\b/,
    primaryReferences: ["2 Samuel 7", "Psalm 2", "Mark 1:14-15"],
    why:
      "2 Samuel 7 establishes God's promise concerning David's house, Psalm 2 reflects on God's anointed king, and Mark 1 records Jesus announcing God's kingdom."
  },
  {
    id: "gospel",
    storylineSeed: "kingdom Messiah Christ",
    namedPattern: /\b(gospel|good news|jesus' death and resurrection|1\s*corinthians\s+15)\b/,
    conceptPattern: /\b(saved by grace|what is salvation|how (?:are|can) (?:we|people) saved)\b/,
    referencePattern: /\b(?:mark\s+1:1[45]|1\s*corinthians\s+15|ephesians\s+2:[1-9])\b/,
    primaryReferences: ["Mark 1:14-15", "1 Corinthians 15:1-8", "Ephesians 2:8-10"],
    why:
      "Mark 1, 1 Corinthians 15, and Ephesians 2 explicitly announce the gospel around Jesus' kingdom, death and resurrection, and salvation by grace that forms a faithful people."
  },
  {
    id: "exile-home",
    storylineSeed: "exile Babylon return",
    namedPattern: /\b(babylon|exile|jeremiah|daniel|ezra|nehemiah)\b/,
    conceptPattern: /\b(israel(?:'s)? exile|return from exile|judah taken captive)\b/,
    referencePattern: /\b(?:jeremiah\s+29|daniel\s+1|ezra\s+1|nehemiah\s+1)\b/,
    primaryReferences: ["Jeremiah 29:1-14", "Daniel 1", "Ezra 1"],
    why:
      "Jeremiah 29, Daniel 1, and Ezra 1 directly trace life in Babylonian exile and the beginning of return without turning ordinary sadness into exile language."
  },
  {
    id: "wisdom-suffering",
    storylineSeed: "Job suffering lament wisdom",
    namedPattern: /\b(job|ecclesiastes|proverbs|psalm\s+13|lament)\b/,
    conceptPattern: /\b(why (?:does|would) god allow suffering|problem of suffering|when life hurts|when grief|grief before god|grief and anxiety|trust god when suffering|suffering feels pointless)\b/,
    referencePattern: /\b(?:job\s+\d+|psalm\s+13|ecclesiastes\s+\d+|romans\s+8:1[89])\b/,
    primaryReferences: ["Job 1-2", "Psalm 13", "Romans 8:18-25"],
    why:
      "Job 1-2 and Psalm 13 make room for suffering and lament without a shallow formula, while Romans 8 explicitly holds present groaning together with patient hope."
  },
  {
    id: "spirit-church",
    storylineSeed: "Holy Spirit Pentecost church",
    namedPattern: /\b(holy spirit|pentecost|acts\s+2|body of christ)\b/,
    conceptPattern: /\b(spiritual gifts|fruit of the spirit|spirit form\w* the church)\b/,
    referencePattern: /\b(?:acts\s+2|john\s+14|galatians\s+5:2[2-3])\b/,
    primaryReferences: ["Acts 2:1-21", "John 14:15-27", "Galatians 5:22-23"],
    why:
      "Acts 2 directly narrates Pentecost, John 14 records Jesus' promise of the Spirit, and Galatians 5 names the fruit by which Spirit-formed life can be discerned."
  },
  {
    id: "new-creation-hope",
    storylineSeed: "new creation Revelation resurrection hope",
    namedPattern: /\b(new creation|new heaven|new earth|revelation\s+2[12])\b/,
    conceptPattern: /\b(what happens when jesus returns|resurrection hope|renew all things)\b/,
    referencePattern: /\b(?:revelation\s+2[12]|romans\s+8:1[89]|1\s*corinthians\s+15)\b/,
    primaryReferences: ["Revelation 21-22", "Romans 8:18-25", "1 Corinthians 15:20-28"],
    why:
      "Revelation 21-22 directly portrays renewed creation, while Romans 8 and 1 Corinthians 15 explicitly connect that hope to creation's renewal and Jesus' resurrection."
  }
];

export function selectStudentQuestionJourney(input: JourneySelectionInput): {
  selection: StudentJourneySelection;
  storylineMatch: StorylineQuestionMatch;
} {
  const question = normalize(input.question);
  const reference = normalize(input.scriptureReference ?? "");
  const questionCandidates = strictJourneyRules.filter((rule) => rule.namedPattern.test(question) || rule.conceptPattern.test(question));
  const referenceCandidates = reference ? strictJourneyRules.filter((rule) => rule.referencePattern.test(reference)) : [];
  const namedCandidates = questionCandidates.filter((rule) => rule.namedPattern.test(question));
  const directRule = resolveDirectRule(questionCandidates, namedCandidates, referenceCandidates);

  if (!directRule) {
    const conflict = describeConflict(questionCandidates, referenceCandidates);
    return {
      selection: {
        status: "leader_assignment_required",
        confidence: 0,
        storylineId: "leader-assignment-required",
        primaryReference: "",
        supportingReferences: [],
        whyThisPassage: conflict || "No passage was assigned because the question does not contain a sufficiently specific narrative, figure, doctrine, or Scripture reference. A leader must choose the passage rather than let Meridian guess from broad themes.",
        matchSignals: topicTagNotice(input.topicTags),
        passageReasons: []
      },
      storylineMatch: matchQuestionToStoryline({ question: "", scriptureReference: "", topicTags: [] })
    };
  }

  const suppliedReference = (input.scriptureReference ?? "").trim();
  const references = suppliedReference
    ? uniqueReferences([suppliedReference, ...directRule.primaryReferences])
    : directRule.primaryReferences;
  const primaryReference = references[0];
  const confidence = suppliedReference ? 0.98 : directRule.namedPattern.test(question) ? 0.96 : 0.86;
  const whyThisPassage = suppliedReference
    ? `${suppliedReference} was supplied with the question and matches the same ${directRule.id.replace(/-/g, " ")} context. ${directRule.why}`
    : directRule.why;
  const passageReasons = buildPassageReasons(references, suppliedReference, directRule);
  const storylineMatch = matchQuestionToStoryline({ question: directRule.storylineSeed, scriptureReference: "", topicTags: [] });

  return {
    selection: {
      status: "matched",
      confidence,
      storylineId: storylineMatch.id,
      primaryReference,
      supportingReferences: references.slice(1, 3),
      whyThisPassage,
      matchSignals: [
        suppliedReference ? `Student-supplied reference: ${suppliedReference}` : `Direct question signal: ${directSignal(directRule, question)}`,
        `Strict journey rule: ${directRule.id}`,
        ...topicTagNotice(input.topicTags)
      ],
      passageReasons
    },
    storylineMatch
  };
}

function resolveDirectRule(
  questionCandidates: StrictJourneyRule[],
  namedCandidates: StrictJourneyRule[],
  referenceCandidates: StrictJourneyRule[]
) {
  if (referenceCandidates.length === 1) {
    if (!questionCandidates.length || questionCandidates.every((candidate) => candidate.id === referenceCandidates[0].id)) {
      return referenceCandidates[0];
    }
    if (namedCandidates.length === 1 && namedCandidates[0].id === referenceCandidates[0].id) return referenceCandidates[0];
    return undefined;
  }
  if (referenceCandidates.length > 1) {
    const overlap = questionCandidates.filter((candidate) => referenceCandidates.some((reference) => reference.id === candidate.id));
    if (overlap.length === 1) return overlap[0];
    return undefined;
  }
  if (namedCandidates.length === 1) return namedCandidates[0];
  if (namedCandidates.length > 1) return undefined;
  return questionCandidates.length === 1 ? questionCandidates[0] : undefined;
}

function describeConflict(questionCandidates: StrictJourneyRule[], referenceCandidates: StrictJourneyRule[]) {
  const ids = Array.from(new Set([...questionCandidates, ...referenceCandidates].map((rule) => rule.id)));
  if (ids.length > 1) {
    return `No passage was assigned because the question and supplied context point to conflicting storylines (${ids.join(", ")}). A leader must decide whether the relationship is an explicit biblical cross-reference.`;
  }
  if (referenceCandidates.length > 1) {
    return "No passage was assigned because the supplied reference spans more than one possible storyline. A leader must choose the primary text.";
  }
  return "";
}

function buildPassageReasons(references: string[], suppliedReference: string, rule: StrictJourneyRule): StudentJourneyPassageReason[] {
  return references.slice(0, 3).map((reference, index) => ({
    reference,
    reason:
      index === 0
        ? suppliedReference
          ? "This is the passage the student supplied, and the strict matcher confirmed that it belongs to the same narrative or subject as the question."
          : rule.why
        : sameBook(references[0], reference)
          ? "This reading stays in the same biblical book and narrative development instead of jumping to a merely similar theme."
          : "This reading directly addresses the named subject as an explicit canonical development or cross-reference without replacing the primary passage's context.",
    relationship:
      index === 0
        ? suppliedReference
          ? "student_supplied"
          : "same_narrative"
        : sameBook(references[0], reference)
          ? "same_narrative"
          : "explicit_cross_reference"
  }));
}

function directSignal(rule: StrictJourneyRule, question: string) {
  return question.match(rule.namedPattern)?.[0] || question.match(rule.conceptPattern)?.[0] || rule.id;
}

function topicTagNotice(topicTags: string[] | undefined) {
  const tags = (topicTags ?? []).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
  return tags.length ? [`Provider tags ignored for passage selection: ${tags.join(", ")}`] : [];
}

function uniqueReferences(references: string[]) {
  const seen = new Set<string>();
  const seenScopes = new Set<string>();
  return references.filter((reference) => {
    const key = normalizeReference(reference);
    const scope = passageScopeKey(reference);
    if (!key || seen.has(key) || (scope && seenScopes.has(scope))) return false;
    seen.add(key);
    if (scope) seenScopes.add(scope);
    return true;
  }).slice(0, 3);
}

function sameBook(left: string, right: string) {
  return passageBook(left) !== "" && passageBook(left) === passageBook(right);
}

function passageScopeKey(reference: string) {
  const match = normalize(reference).match(/^([1-3]?\s*[a-z]+)\s+(\d+)/);
  return match ? `${match[1].replace(/\s+/g, "")}:${match[2]}` : "";
}

function passageBook(reference: string) {
  const match = normalize(reference).match(/^([1-3]?\s*[a-z]+)/);
  return match?.[1].replace(/\s+/g, "") ?? "";
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function normalizeReference(value: string) {
  return normalize(value).replace(/\s+/g, "");
}
