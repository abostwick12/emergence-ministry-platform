export type StorylineFoundationBook = {
  id: "genesis" | "exodus";
  title: string;
  overview: string;
  movements: Array<{
    id: string;
    title: string;
    startsAt: string;
    introduces: string[];
  }>;
  chapterFlow: Array<{
    reference: string;
    summary: string;
  }>;
  laterConnections: Array<{
    theme: string;
    introducedIn: string;
    watchFor: string;
  }>;
  reflectionPrompts: string[];
  leaderNotes: string[];
};

export type StorylineFlyover = {
  id: string;
  title: string;
  bigIdea: string;
  covers: string;
  focus: string[];
  warning?: string;
};

export type StorylineTheme = {
  id: string;
  title: string;
  begins: string;
  develops: string;
  fulfilled: string;
};

export type StorylineQuestionMatch = {
  id: string;
  label: string;
  title: string;
  startsHere: string;
  developsThrough: string;
  fulfilledInChrist: string;
  studentSummary: string;
  leaderFrame: string;
  keyPassages: string[];
  studentQuestions: string[];
};

export const storylineMap = [
  "Creation",
  "Fall",
  "Covenant",
  "Exodus",
  "Law",
  "Land",
  "Kingdom",
  "Exile",
  "Return",
  "Messiah",
  "Church",
  "New Creation"
] as const;

export const storylineGuardrail =
  "Genesis and Exodus introduce the major categories, patterns, and questions that the rest of Scripture develops and brings to fulfillment in Christ.";

export const foundationBooks: StorylineFoundationBook[] = [
  {
    id: "genesis",
    title: "Genesis",
    overview:
      "Genesis introduces the world God made, the humans made to reflect Him, the rupture caused by sin, and God's promise to bless the nations through Abraham's family.",
    movements: [
      {
        id: "creation",
        title: "Creation",
        startsAt: "Genesis 1-2",
        introduces: ["God as Creator", "creation as good", "humans as image bearers", "vocation", "rest", "sacred space"]
      },
      {
        id: "fall-fracture",
        title: "Fall / Fracture",
        startsAt: "Genesis 3-11",
        introduces: ["sin", "exile from Eden", "death", "violence", "judgment", "mercy", "scattered nations"]
      },
      {
        id: "promise-covenant",
        title: "Promise / Covenant",
        startsAt: "Genesis 12, 15, 17",
        introduces: ["Abraham", "blessing", "land", "seed", "nations", "covenant faithfulness"]
      }
    ],
    chapterFlow: [
      {
        reference: "Genesis 1",
        summary: "God creates an ordered, good world and gives humans a vocation as His image bearers."
      },
      {
        reference: "Genesis 3",
        summary: "Humans distrust God, sin fractures creation, and exile begins, but God promises future victory."
      },
      {
        reference: "Genesis 6-9",
        summary: "Human violence fills the earth, judgment comes through the flood, and mercy preserves creation through Noah."
      },
      {
        reference: "Genesis 11",
        summary: "Babel shows scattered human pride, setting up God's promise to bless the nations through Abraham."
      },
      {
        reference: "Genesis 12",
        summary: "God calls Abram and promises land, family, blessing, and blessing for all nations."
      },
      {
        reference: "Genesis 15",
        summary: "God makes covenant promises to Abram and ties the family story to trust, land, and future deliverance."
      },
      {
        reference: "Genesis 22",
        summary: "Abraham is tested, Isaac is spared, and the promise continues by God's provision."
      },
      {
        reference: "Genesis 50",
        summary: "Joseph names God's hidden providence: human evil does not stop God's saving purpose."
      }
    ],
    laterConnections: [
      {
        theme: "Image of God",
        introducedIn: "Genesis 1",
        watchFor: "Watch for it later in kingship, wisdom, Jesus as the true image, and renewed humanity in Christ."
      },
      {
        theme: "Exile",
        introducedIn: "Genesis 3 and Genesis 11",
        watchFor: "Watch for it later in Israel's exile, the prophets, and the New Testament language of strangers, citizens, and home."
      },
      {
        theme: "Blessing to the nations",
        introducedIn: "Genesis 12",
        watchFor: "Watch for it later in Israel's calling, the prophets' hope for the nations, Jesus, Acts, and the multi-nation people of God."
      },
      {
        theme: "Promised seed",
        introducedIn: "Genesis 3 and Genesis 12",
        watchFor: "Watch for the family line, Davidic hope, messianic expectation, and the New Testament claim that the promise centers on Christ."
      }
    ],
    reflectionPrompts: [
      "What does Genesis show about what humans were made for?",
      "Where do you see both human failure and God's patient promise?",
      "Which Genesis theme helps you understand a later Bible passage you have read before?"
    ],
    leaderNotes: [
      "Do not treat Genesis as only a collection of moral examples.",
      "Avoid overstating Genesis. Say it introduces categories and patterns the rest of Scripture develops.",
      "Let students notice repeated patterns before naming technical theological terms."
    ]
  },
  {
    id: "exodus",
    title: "Exodus",
    overview:
      "Exodus shows God rescuing Abraham's family from slavery, forming them into a covenant people, giving them His instruction, and coming to dwell among them.",
    movements: [
      {
        id: "exodus-deliverance",
        title: "Exodus / Deliverance",
        startsAt: "Exodus 1-15",
        introduces: ["redemption", "Passover", "liberation", "judgment on false gods", "God making a people"]
      },
      {
        id: "law-formation",
        title: "Law / Formation",
        startsAt: "Exodus 19-24",
        introduces: ["covenant identity", "worship", "holiness", "communal ethics", "life as God's people"]
      },
      {
        id: "tabernacle-presence",
        title: "Tabernacle / Presence",
        startsAt: "Exodus 25-40",
        introduces: ["God dwelling with His people", "priesthood", "sacrifice", "sacred space", "worship"]
      }
    ],
    chapterFlow: [
      {
        reference: "Exodus 1-2",
        summary: "Israel suffers under slavery, but God preserves Moses and remembers His covenant promises."
      },
      {
        reference: "Exodus 3",
        summary: "God reveals His name, hears His people's cries, and sends Moses into a rescue mission."
      },
      {
        reference: "Exodus 7-12",
        summary: "The plagues expose Egypt's false gods and show that deliverance is also judgment."
      },
      {
        reference: "Exodus 12",
        summary: "God delivers Israel through Passover, forming a redeemed people."
      },
      {
        reference: "Exodus 14-15",
        summary: "God brings Israel through the sea and teaches them to sing about rescue."
      },
      {
        reference: "Exodus 19",
        summary: "God brings Israel to Sinai and calls them His treasured people and priestly kingdom."
      },
      {
        reference: "Exodus 20-24",
        summary: "God gives covenant instruction so rescued people can live as His holy community."
      },
      {
        reference: "Exodus 32-34",
        summary: "Israel breaks covenant with the golden calf, and Moses mediates as God shows judgment and mercy."
      },
      {
        reference: "Exodus 40",
        summary: "God's glory fills the tabernacle, showing His desire to dwell with His people."
      }
    ],
    laterConnections: [
      {
        theme: "Passover",
        introducedIn: "Exodus 12",
        watchFor: "Watch for it later in the Lord's Supper, Jesus as the Lamb of God, and redemption language in the New Testament."
      },
      {
        theme: "Law as formation",
        introducedIn: "Exodus 19-24",
        watchFor: "Watch for covenant renewal in Deuteronomy, prophetic calls back to faithfulness, and Jesus teaching love for God and neighbor."
      },
      {
        theme: "Tabernacle",
        introducedIn: "Exodus 25-40",
        watchFor: "Watch for it later in the temple, John 1, the church as God's dwelling, and Revelation's new creation."
      },
      {
        theme: "Mediation",
        introducedIn: "Exodus 32-34",
        watchFor: "Watch for priests, prophets, kings, and the New Testament claim that Jesus is the faithful mediator."
      }
    ],
    reflectionPrompts: [
      "Why does deliverance lead into worship and obedience instead of self-rule?",
      "How does Exodus connect rescue, covenant, law, and God's presence?",
      "Where do you see Exodus patterns show up in the story of Jesus?"
    ],
    leaderNotes: [
      "Do not flatten Israel's deliverance into generic life advice.",
      "Help students see that the Law is not random rules. It is formation for a redeemed people.",
      "Use Passover and tabernacle connections carefully, with text-based links rather than hidden-code speculation."
    ]
  }
];

export const oldTestamentFlyovers: StorylineFlyover[] = [
  {
    id: "law",
    title: "Law Flyover",
    bigIdea: "God forms Israel into a holy covenant people.",
    covers: "Leviticus, Numbers, Deuteronomy",
    focus: ["holiness", "sacrifice", "priesthood", "clean and unclean", "wilderness testing", "covenant renewal", "love God and love neighbor"],
    warning: "The Law is not random rules. It is God forming a redeemed people to live differently with Him and one another."
  },
  {
    id: "land",
    title: "Conquest / Land Flyover",
    bigIdea: "God brings Israel into the land, but the land is always tied to covenant faithfulness.",
    covers: "Joshua",
    focus: ["promise of land", "judgment and mercy", "Rahab as outsider brought in", "covenant obedience", "incomplete faithfulness"],
    warning: "Do not read Joshua as simple conquest propaganda. Students need help seeing covenant, judgment, mercy, and the seriousness of Israel's calling."
  },
  {
    id: "judges",
    title: "Judges Flyover",
    bigIdea: "Without faithful covenant leadership, everyone does what is right in their own eyes.",
    covers: "Judges",
    focus: ["cycle of rebellion", "deliverance", "compromise", "moral collapse", "need for a better king"]
  },
  {
    id: "kings",
    title: "Kings Flyover",
    bigIdea: "Israel asks for a king, but even the best human kings fail to fully lead God's people into covenant faithfulness.",
    covers: "Samuel, Kings, Chronicles",
    focus: ["Saul", "David", "Solomon", "temple", "divided kingdom", "idolatry", "exile", "hope for David's greater Son"]
  },
  {
    id: "prophets",
    title: "Prophets Flyover",
    bigIdea: "The prophets call God's people back to covenant faithfulness and forward to future restoration.",
    covers: "Isaiah through Malachi",
    focus: ["covenant lawsuit", "justice and worship", "idolatry", "exile", "new covenant", "Spirit", "Messiah", "restoration of the nations"]
  },
  {
    id: "wisdom",
    title: "Wisdom Flyover",
    bigIdea: "Wisdom teaches God's people how to live faithfully in God's world, especially when life is complex.",
    covers: "Job, Psalms, Proverbs, Ecclesiastes, Song of Songs",
    focus: ["fear of the Lord", "suffering", "worship", "lament", "moral formation", "limits of human understanding"],
    warning: "Proverbs are wisdom principles, not mechanical promises. Job and Ecclesiastes prevent students from turning faith into a simplistic formula."
  }
];

export const newTestamentFlyovers: StorylineFlyover[] = [
  {
    id: "gospels",
    title: "Gospels Flyover",
    bigIdea: "Jesus fulfills Israel's story and reveals the kingdom of God.",
    covers: "Matthew, Mark, Luke, John",
    focus: ["new creation", "new exodus", "Son of David", "Son of Man", "temple and presence", "kingdom", "cross", "resurrection"]
  },
  {
    id: "acts",
    title: "Acts Flyover",
    bigIdea: "The risen Jesus sends the Spirit-filled church to bear witness to the nations.",
    covers: "Acts",
    focus: ["Spirit", "mission", "new covenant community", "Jew and Gentile inclusion", "witness from Jerusalem to the ends of the earth"]
  },
  {
    id: "letters",
    title: "Letters Flyover",
    bigIdea: "The apostles teach the church how to live as the new covenant people of God in Christ.",
    covers: "Romans through Jude",
    focus: ["gospel identity", "union with Christ", "church as body, temple, and family", "Spirit-formed holiness", "suffering", "hope", "mission"]
  },
  {
    id: "revelation",
    title: "Revelation Flyover",
    bigIdea: "Revelation reveals Jesus as victorious King and shows the final renewal of creation.",
    covers: "Revelation",
    focus: ["worship", "empire and faithfulness", "Lamb who conquers", "judgment", "new creation", "God dwelling with His people"],
    warning: "Revelation should not be introduced first as a codebook for timelines. It is apocalyptic prophecy that calls the church to faithful witness under pressure."
  }
];

export const themeIndex: StorylineTheme[] = [
  {
    id: "covenant",
    title: "Covenant",
    begins: "Genesis 12, 15, 17; Exodus 19-24",
    develops: "Deuteronomy, David's promise, prophets, exile, and new covenant hope",
    fulfilled: "Jesus establishes the new covenant and forms a covenant people by the Spirit."
  },
  {
    id: "kingdom",
    title: "Kingdom",
    begins: "Genesis 1 image bearers; Exodus 19 priestly kingdom",
    develops: "Israel's kings, Davidic promise, prophetic hope, and exile",
    fulfilled: "Jesus announces God's kingdom, reigns through the cross and resurrection, and sends kingdom witnesses."
  },
  {
    id: "temple",
    title: "Temple / Presence",
    begins: "Eden as sacred space; Exodus tabernacle",
    develops: "Solomon's temple, exile from the temple, prophetic restoration hope",
    fulfilled: "Jesus dwells among us, the church becomes God's Spirit-filled temple, and Revelation ends with God dwelling with His people."
  },
  {
    id: "exile",
    title: "Exile",
    begins: "Genesis 3 and Genesis 11",
    develops: "Israel's land loss, prophetic warning, return, and continued longing",
    fulfilled: "Jesus gathers exiles home and makes His people citizens of God's kingdom."
  },
  {
    id: "sacrifice",
    title: "Sacrifice",
    begins: "Genesis patterns of covering and offering; Exodus Passover and tabernacle sacrifices",
    develops: "Priesthood, temple worship, prophetic critique, and atonement language",
    fulfilled: "Jesus is the once-for-all sacrifice who brings forgiveness and cleanses His people."
  },
  {
    id: "spirit",
    title: "Spirit",
    begins: "God's life-giving presence in creation and among His covenant people",
    develops: "Prophetic promises of a renewed heart and Spirit-filled people",
    fulfilled: "The risen Jesus pours out the Spirit and forms the church for witness."
  },
  {
    id: "new-creation",
    title: "New Creation",
    begins: "Genesis 1-2",
    develops: "Sabbath, land, temple, restoration promises, resurrection hope",
    fulfilled: "Jesus rises as the beginning of new creation, and Revelation shows creation renewed."
  }
];

const storylineQuestionRules: Array<{
  id: StorylineQuestionMatch["id"];
  pattern: RegExp;
  match: Omit<StorylineQuestionMatch, "id">;
}> = [
  {
    id: "creation-fracture",
    pattern: /\b(genesis|creation|created|image of god|garden|eden|tree|evil|fall|sin|serpent|curse)\b/,
    match: {
      label: "This starts in Genesis",
      title: "Creation, trust, and fracture",
      startsHere: "Genesis 1-3",
      developsThrough: "Genesis 11, Israel's repeated distrust, exile, and prophetic hope",
      fulfilledInChrist: "Jesus is the true image of God who enters the fractured world and begins renewed humanity.",
      studentSummary:
        "Genesis helps you ask what God made good, what sin fractured, and how God keeps pursuing people instead of abandoning the story.",
      leaderFrame:
        "Start with God's gifts and human vocation before moving to failure. Help students see trust, rupture, mercy, and promise rather than treating Genesis as a puzzle box.",
      keyPassages: ["Genesis 1", "Genesis 3", "Genesis 12", "John 1:1-14", "Colossians 1:15-20"],
      studentQuestions: [
        "What good thing does God give before the problem appears?",
        "What kind of trust is being tested?",
        "Where do you see both judgment and mercy?"
      ]
    }
  },
  {
    id: "covenant-promise",
    pattern: /\b(abraham|abram|promise|covenant|blessing|chosen|election|nations|family|seed|descendant)\b/,
    match: {
      label: "This connects to covenant",
      title: "Promise and blessing for the nations",
      startsHere: "Genesis 12, 15, 17",
      developsThrough: "Israel's family story, Sinai, David's promise, exile, and new covenant hope",
      fulfilledInChrist: "Jesus carries the promise forward and forms a multi-nation covenant people by the Spirit.",
      studentSummary:
        "Covenant helps you see that God's rescue is not random. God binds Himself to His promises and blesses His people for the sake of the nations.",
      leaderFrame:
        "Frame covenant as relationship, promise, identity, and mission. Avoid reducing it to a contract or a generic example of commitment.",
      keyPassages: ["Genesis 12", "Genesis 15", "Exodus 19", "Jeremiah 31", "Galatians 3"],
      studentQuestions: [
        "What does God promise to do?",
        "Who is blessed, and who is the blessing meant to reach?",
        "How does this question connect to belonging, identity, or mission?"
      ]
    }
  },
  {
    id: "exodus-deliverance",
    pattern: /\b(exodus|deliverance|deliver|rescue|slavery|slave|freedom|passover|red sea|pharaoh|egypt|liberation)\b/,
    match: {
      label: "This connects to deliverance",
      title: "Exodus and rescue",
      startsHere: "Exodus 1-15",
      developsThrough: "Passover, wilderness testing, prophets, Jesus' death and resurrection, and redemption language in the letters",
      fulfilledInChrist: "Jesus brings the deeper exodus: rescue from sin and formation into a redeemed people.",
      studentSummary:
        "Exodus shows that God hears suffering, confronts enslaving powers, rescues His people, and then forms them for worship and faithful life.",
      leaderFrame:
        "Hold rescue and formation together. Do not make deliverance only about personal escape; in Exodus, rescue leads to worship, covenant, and community.",
      keyPassages: ["Exodus 3", "Exodus 12", "Exodus 14", "Luke 9:31", "1 Peter 1:18-19"],
      studentQuestions: [
        "What kind of rescue is needed in this question?",
        "What does God rescue people from and for?",
        "How does deliverance lead into worship or obedience?"
      ]
    }
  },
  {
    id: "law-formation",
    pattern: /\b(law|command|commandment|rules|obedience|holy|holiness|clean|unclean|leviticus|sinai|deuteronomy|neighbor)\b/,
    match: {
      label: "This connects to formation",
      title: "Law, holiness, and covenant life",
      startsHere: "Exodus 19-24",
      developsThrough: "Leviticus, Numbers, Deuteronomy, prophetic calls to covenant faithfulness, and Jesus' teaching",
      fulfilledInChrist: "Jesus fulfills the Law and forms people who love God and neighbor by the Spirit.",
      studentSummary:
        "The Law is not random rules. It shows God forming a rescued people to live differently with Him and one another.",
      leaderFrame:
        "Help students read law through rescue and covenant identity. Avoid presenting obedience as earning rescue.",
      keyPassages: ["Exodus 19", "Exodus 20", "Leviticus 19", "Deuteronomy 6", "Matthew 22:34-40"],
      studentQuestions: [
        "What kind of people is God forming?",
        "How does this command connect to love for God or neighbor?",
        "What misunderstanding about rules might need to be corrected?"
      ]
    }
  },
  {
    id: "presence-temple",
    pattern: /\b(tabernacle|temple|presence|dwelling|dwell|priest|priesthood|sacrifice|worship|glory|holy place)\b/,
    match: {
      label: "This connects to God's presence",
      title: "Tabernacle, temple, and dwelling",
      startsHere: "Exodus 25-40",
      developsThrough: "Priesthood, sacrifice, Solomon's temple, exile, John 1, the church as temple, and Revelation",
      fulfilledInChrist: "Jesus dwells among us, brings access to God, and makes His people a Spirit-filled dwelling place.",
      studentSummary:
        "The tabernacle and temple show God's desire to dwell with His people, while also showing the seriousness of holiness, mediation, and worship.",
      leaderFrame:
        "Trace presence carefully: Eden, tabernacle, temple, Jesus, Spirit-filled church, new creation. Avoid forced symbolism without textual links.",
      keyPassages: ["Exodus 40", "1 Kings 8", "John 1:14", "1 Corinthians 3:16", "Revelation 21:3"],
      studentQuestions: [
        "What does this show about God's desire to be near His people?",
        "Why does holiness matter when God draws near?",
        "How does Jesus change how we understand access to God?"
      ]
    }
  },
  {
    id: "kingdom-messiah",
    pattern: /\b(king|kingdom|david|messiah|christ|son of david|rule|reign|justice|throne|samuel|kings)\b/,
    match: {
      label: "This connects to kingdom",
      title: "Kingdom and the promised King",
      startsHere: "Genesis 1 and Exodus 19",
      developsThrough: "Saul, David, Solomon, the divided kingdom, exile, and prophetic hope for David's greater Son",
      fulfilledInChrist: "Jesus announces and embodies God's kingdom as the faithful King who reigns through the cross and resurrection.",
      studentSummary:
        "Kingdom questions ask what faithful rule looks like, why human leaders fail, and why Scripture keeps pointing toward a better King.",
      leaderFrame:
        "Show both the goodness of God's rule and the failure of human kings. Help students see Jesus as fulfillment, not merely a better example.",
      keyPassages: ["1 Samuel 8", "2 Samuel 7", "Psalm 2", "Mark 1:14-15", "Revelation 11:15"],
      studentQuestions: [
        "What kind of rule does this question assume or desire?",
        "Where do human leaders fail in this part of the story?",
        "How does Jesus redefine power, victory, or faithfulness?"
      ]
    }
  },
  {
    id: "exile-home",
    pattern: /\b(exile|home|homesick|return|stranger|citizen|scattered|babylon|lost|belong|identity)\b/,
    match: {
      label: "This connects to exile and home",
      title: "Exile, return, and belonging",
      startsHere: "Genesis 3 and Genesis 11",
      developsThrough: "Israel's exile, the prophets, partial return, and New Testament language of strangers and citizens",
      fulfilledInChrist: "Jesus gathers exiles home and makes His people citizens of God's kingdom.",
      studentSummary:
        "Exile helps you name the ache of being far from home, from God, or from what life was meant to be, while still looking for God's promise to restore.",
      leaderFrame:
        "Use exile as a pastoral category for displacement and longing, but do not flatten every sadness into exile. Let the text guide the connection.",
      keyPassages: ["Genesis 3", "Genesis 11", "Jeremiah 29", "1 Peter 2:11", "Revelation 21"],
      studentQuestions: [
        "Where does this question reveal a longing for home or belonging?",
        "What has been broken or scattered?",
        "What kind of restoration does Scripture teach us to hope for?"
      ]
    }
  },
  {
    id: "wisdom-suffering",
    pattern: /\b(wisdom|wise|suffer|suffering|pain|grief|death|lament|anxiety|worry|job|psalm|proverb|ecclesiastes|why would god)\b/,
    match: {
      label: "This connects to wisdom and suffering",
      title: "Wisdom, lament, and faithful complexity",
      startsHere: "Genesis' good world fractured by sin",
      developsThrough: "Job, Psalms, Proverbs, Ecclesiastes, prophetic lament, Jesus' suffering, and resurrection hope",
      fulfilledInChrist: "Jesus enters suffering, teaches wisdom through the cross, and gives hope without pretending pain is small.",
      studentSummary:
        "Wisdom helps you bring hard questions honestly without turning faith into a simplistic formula or rushing pain into easy answers.",
      leaderFrame:
        "Slow down. Use lament and wisdom before explanation. Avoid treating Proverbs as mechanical promises or Job as a quick answer to suffering.",
      keyPassages: ["Job 1-2", "Psalm 13", "Proverbs 1:7", "Ecclesiastes 3", "Romans 8:18-25"],
      studentQuestions: [
        "What answer would feel too quick or too shallow?",
        "Where does Scripture make room for honest lament?",
        "What hope is offered without pretending the pain is small?"
      ]
    }
  },
  {
    id: "spirit-church",
    pattern: /\b(spirit|holy spirit|church|community|mission|acts|pentecost|gifts|witness|body of christ)\b/,
    match: {
      label: "This connects to Spirit and mission",
      title: "Spirit-formed people and witness",
      startsHere: "God's life-giving presence in creation and covenant life",
      developsThrough: "Prophetic promises of the Spirit, Jesus' promise, Acts, and the church as God's people",
      fulfilledInChrist: "The risen Jesus pours out the Spirit and sends the church as witnesses to the nations.",
      studentSummary:
        "The Spirit forms God's people for holiness, community, courage, and witness, not just private spiritual experience.",
      leaderFrame:
        "Connect Spirit language to formation and mission. Avoid making Acts only about spectacle; keep witness and community in view.",
      keyPassages: ["Genesis 1:2", "Ezekiel 36", "John 14", "Acts 2", "Galatians 5"],
      studentQuestions: [
        "What kind of person or community is the Spirit forming?",
        "How does this connect to witness or mission?",
        "What fruit or courage would faithfulness require here?"
      ]
    }
  },
  {
    id: "new-creation-hope",
    pattern: /\b(new creation|revelation|heaven|new earth|restore|restoration|resurrection|hope|future|victory|end times)\b/,
    match: {
      label: "This connects to new creation",
      title: "Hope and the renewal of all things",
      startsHere: "Genesis 1-2",
      developsThrough: "Sabbath, land, temple, prophetic restoration, resurrection, and Revelation",
      fulfilledInChrist: "Jesus rises as the beginning of new creation and will renew creation fully.",
      studentSummary:
        "New creation keeps Christian hope bigger than escaping the world. God intends to renew what sin has broken.",
      leaderFrame:
        "Introduce Revelation as apocalyptic prophecy for faithful witness and hope, not first as a codebook for timelines.",
      keyPassages: ["Genesis 1-2", "Isaiah 65", "Romans 8", "2 Corinthians 5:17", "Revelation 21-22"],
      studentQuestions: [
        "What part of creation or human life needs renewal here?",
        "How does resurrection hope change the way we wait?",
        "What does faithful witness look like while the story is not finished?"
      ]
    }
  }
];

export function matchQuestionToStoryline(input: {
  question: string;
  scriptureReference?: string;
  topicTags?: string[];
}): StorylineQuestionMatch {
  const text = `${input.question} ${input.scriptureReference ?? ""} ${(input.topicTags ?? []).join(" ")}`.toLowerCase();
  const rule = storylineQuestionRules.find((item) => item.pattern.test(text));
  if (rule) return { id: rule.id, ...rule.match };

  return {
    id: "big-story",
    label: "Start with the big story",
    title: "Read the question inside Scripture's whole story",
    startsHere: "Genesis and Exodus",
    developsThrough: "Law, land, kingdom, prophets, wisdom, Jesus, the church, and new creation",
    fulfilledInChrist: "Jesus brings Scripture's major patterns and promises to fulfillment and sends His people to live as witnesses.",
    studentSummary:
      "When a question feels disconnected, start with the big story: what God made, what sin fractured, how God rescues, and where the story is going.",
    leaderFrame:
      "Use Genesis and Exodus as foundation, then trace the question through the rest of Scripture without forcing a connection the text does not support.",
    keyPassages: ["Genesis 1-3", "Genesis 12", "Exodus 12", "John 1:1-14", "Revelation 21"],
    studentQuestions: [
      "Where might this question fit in the larger story?",
      "What does this reveal about God, people, brokenness, or hope?",
      "What passage should we read before trying to answer?"
    ]
  };
}
