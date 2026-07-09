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
