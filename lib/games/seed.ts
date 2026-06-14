import type { TriviaGame } from "@/lib/games/types";
import { themeForCategory } from "@/lib/games/category-themes";

type RawQuestion = [string, string, string, string, string];
type RawCategory = { name: string; questions: RawQuestion[] };
type RawGame = { id: string; title: string; description: string; categories: RawCategory[]; tiebreaker: RawQuestion };

const defaultWrong = ["A different option", "Another plausible answer", "A nearby but incorrect answer"];

const rawGames: RawGame[] = [
  {
    id: "game_camp_opening_night",
    title: "EMERGE Trivia - Opening Night",
    description: "A friendly opening-night trivia set for camp teams.",
    categories: [
      {
        name: "Summer",
        questions: [
          ["What Olympic sport is played by two-person teams who hit a ball over a net on sand?", "Beach volleyball", "Indoor volleyball", "Badminton", "Tennis"],
          ["Which U.S. holiday is commonly considered the unofficial beginning of summer?", "Memorial Day", "Labor Day", "Independence Day", "Flag Day"],
          ["How many innings are played in a regulation Major League Baseball game?", "Nine", "Seven", "Eight", "Ten"],
          ["On a bottle of sunscreen, what do the letters SPF stand for?", "Sun Protection Factor", "Skin Protection Formula", "Solar Prevention Filter", "Sun Proof Finish"],
          ["Earth's seasons are primarily caused by what feature of the planet?", "The tilt of Earth's axis", "Earth's distance from the Sun", "The Moon's orbit", "Ocean temperatures"]
        ]
      },
      {
        name: "Ice Cream",
        questions: [
          ["I combine chocolate ice cream, marshmallows, and nuts, and my name sounds like a difficult hiking path. What flavor am I?", "Rocky Road", "Moose Tracks", "Tin Roof", "Chocolate Fudge Brownie"],
          ["Which popular ice cream flavor contains pieces of unbaked dough and chocolate chips?", "Chocolate Chip Cookie Dough", "Cookies and Cream", "Chocolate Chip", "Brownie Batter"],
          ["Which pale-green ice cream flavor is traditionally made from a nut?", "Pistachio", "Mint", "Matcha", "Lime sherbet"],
          ["Which ice cream company created flavors such as Half Baked, Cherry Garcia, and Phish Food?", "Ben & Jerry's", "Baskin-Robbins", "Blue Bell", "Haagen-Dazs"],
          ["Which three flavors traditionally appear together in Neapolitan ice cream?", "Chocolate, vanilla, and strawberry", "Vanilla, caramel, and coffee", "Chocolate, mint, and cookies", "Strawberry, raspberry, and cherry"]
        ]
      },
      {
        name: "Animals",
        questions: [
          ["A group of crows is known by what spooky name?", "A murder", "A parliament", "A herd", "A colony"],
          ["Which duck-billed Australian mammal is one of the few mammals that lays eggs?", "Platypus", "Echidna", "Wombat", "Tasmanian devil"],
          ["Which bird is considered the fastest animal in the world because it can exceed 200 miles per hour during a hunting dive?", "Peregrine falcon", "Golden eagle", "Albatross", "Osprey"],
          ["Which Australian animal has fingerprints so similar to human fingerprints that they can be difficult to distinguish?", "Koala", "Kangaroo", "Wallaby", "Emu"],
          ["What is the largest species of shark?", "Whale shark", "Great white shark", "Hammerhead shark", "Tiger shark"]
        ]
      },
      {
        name: "Bible",
        questions: [
          ["Which disciple was working as a tax collector when Jesus called him to follow?", "Matthew", "Peter", "John", "Andrew"],
          ["What name was the apostle Paul commonly known by before his missionary ministry began?", "Saul", "Silas", "Stephen", "Simon"],
          ["Which Babylonian king dreamed about a giant statue made from several different materials?", "Nebuchadnezzar", "Belshazzar", "Darius", "Cyrus"],
          ["According to Genesis, for how many days and nights did rain fall during Noah's flood?", "Forty", "Seven", "Twelve", "Seventy"],
          ["Which book of the Bible comes immediately after Acts?", "Romans", "John", "Hebrews", "1 Corinthians"]
        ]
      },
      {
        name: "Random Knowledge",
        questions: [
          ["Which country gave the Statue of Liberty to the United States?", "France", "England", "Spain", "Italy"],
          ["What is the smallest bone in the human body?", "The stapes", "The femur", "The patella", "The ulna"],
          ["Which planet rotates almost completely on its side?", "Uranus", "Venus", "Neptune", "Saturn"],
          ["The two M's in M&M's represent the last names of which two men?", "Mars and Murrie", "Miller and Mars", "Mason and Murray", "Milton and Morris"],
          ["Which chess piece moves only diagonally?", "Bishop", "Rook", "Knight", "Queen"]
        ]
      }
    ],
    tiebreaker: ["What is the only letter of the alphabet that does not appear in the name of any U.S. state?", "Q", "X", "Z", "J"]
  },
  {
    id: "game_camp_heat_wave",
    title: "EMERGE Trivia - Heat Wave",
    description: "A middle-round trivia set with summer, snacks, animals, Bible, and general knowledge.",
    categories: [
      {
        name: "Summer",
        questions: [
          ["What is the longest day of the year in the Northern Hemisphere called?", "The summer solstice", "The winter solstice", "The spring equinox", "The harvest moon"],
          ["Which fruit is approximately 92 percent water and is strongly associated with summer cookouts?", "Watermelon", "Pineapple", "Cantaloupe", "Peach"],
          ["Which famous American amusement park opened in Anaheim, California, in July 1955?", "Disneyland", "Knott's Berry Farm", "Six Flags Magic Mountain", "Dollywood"],
          ["What insect produces the loud buzzing sound commonly heard in trees during hot summer days?", "Cicada", "Cricket", "Grasshopper", "June beetle"],
          ["In the movie The Sandlot, what enormous dog is feared by the neighborhood children?", "The Beast", "Hercules", "The Giant", "Max"]
        ]
      },
      {
        name: "Frozen Treats",
        questions: [
          ["What Italian frozen dessert is usually denser and served slightly warmer than traditional ice cream?", "Gelato", "Sorbet", "Granita", "Custard"],
          ["What frozen treat is traditionally made by freezing flavored liquid around a stick?", "Popsicle or ice pop", "Sherbet", "Gelato", "Snow cone"],
          ["Which ice cream dessert is named after a day of the week but is usually spelled differently?", "Sundae", "Friday float", "Saturday split", "Monday malt"],
          ["What dessert is made by placing ice cream between two cookies, wafers, or pieces of cake?", "Ice cream sandwich", "Banana split", "Milkshake", "Affogato"],
          ["What ingredient gives mint chocolate chip ice cream its primary flavor?", "Mint", "Pistachio", "Lime", "Green tea"]
        ]
      },
      {
        name: "Animals",
        questions: [
          ["Which animal can sleep while standing but must lie down to enter deep REM sleep?", "Horse", "Elephant", "Giraffe", "Cow"],
          ["Which sea creature has three hearts and blue blood?", "Octopus", "Squid", "Jellyfish", "Lobster"],
          ["Which animal is the largest living land animal?", "African elephant", "White rhinoceros", "Hippopotamus", "Giraffe"],
          ["What is the only mammal capable of true, sustained flight?", "Bat", "Flying squirrel", "Sugar glider", "Colugo"],
          ["Which lizard is famous for changing its skin color and for having eyes that can move independently?", "Chameleon", "Gecko", "Iguana", "Komodo dragon"]
        ]
      },
      {
        name: "Bible",
        questions: [
          ["Which judge defeated a Midianite army after reducing his force to only 300 men?", "Gideon", "Samson", "Deborah", "Ehud"],
          ["Who climbed a sycamore-fig tree in order to see Jesus?", "Zacchaeus", "Nicodemus", "Bartimaeus", "Jairus"],
          ["Which Old Testament prophet confronted the prophets of Baal on Mount Carmel?", "Elijah", "Elisha", "Isaiah", "Jeremiah"],
          ["What food did God provide for the Israelites each morning in the wilderness?", "Manna", "Quail", "Bread loaves", "Figs"],
          ["Which New Testament book describes the armor of God?", "Ephesians", "Romans", "Galatians", "Philippians"]
        ]
      },
      {
        name: "Random Knowledge",
        questions: [
          ["What is the name of the imaginary line that divides Earth into the Northern and Southern Hemispheres?", "The equator", "The prime meridian", "The Tropic of Cancer", "The International Date Line"],
          ["Which social deduction game features crewmates completing tasks while trying to identify hidden impostors?", "Among Us", "Minecraft", "Fortnite", "Roblox"],
          ["What color is produced by mixing blue and yellow?", "Green", "Purple", "Orange", "Brown"],
          ["Which fast-food restaurant is known for the slogan \"Have It Your Way\"?", "Burger King", "McDonald's", "Wendy's", "Taco Bell"],
          ["How many total dots appear on a standard six-sided die?", "21", "18", "24", "36"]
        ]
      }
    ],
    tiebreaker: ["In feet, how long is a regulation American football field when both end zones are included?", "360 feet", "300 feet", "330 feet", "400 feet"]
  },
  {
    id: "game_camp_final_showdown",
    title: "EMERGE Trivia - Final Showdown",
    description: "A final-night trivia set built for a lively youth-room finish.",
    categories: [
      {
        name: "Summer",
        questions: [
          ["Which movie features a snowman named Olaf who dreams about experiencing summer?", "Frozen", "Moana", "Tangled", "Encanto"],
          ["What weather scale rates hurricanes from Category 1 through Category 5?", "The Saffir-Simpson Hurricane Wind Scale", "The Richter Scale", "The Fujita Scale", "The Beaufort Scale"],
          ["Which U.S. national park is famous for the Old Faithful geyser?", "Yellowstone National Park", "Yosemite National Park", "Grand Canyon National Park", "Zion National Park"],
          ["What is the name of the glowing light produced by certain organisms in the ocean?", "Bioluminescence", "Photosynthesis", "Refraction", "Fluorescence"],
          ["In which direction does the Sun generally set?", "West", "East", "North", "South"]
        ]
      },
      {
        name: "Ice Cream and Desserts",
        questions: [
          ["What dessert is created by pouring hot espresso over a scoop of gelato or ice cream?", "Affogato", "Tiramisu", "Cannoli", "Panna cotta"],
          ["Which dessert traditionally combines bananas, ice cream, whipped cream, sauce, and a cherry?", "Banana split", "Ice cream sandwich", "Root beer float", "Sundae cone"],
          ["What ice cream topping is made by heating sugar until it becomes brown and develops a deep, sweet flavor?", "Caramel", "Fudge", "Marshmallow", "Praline"],
          ["Which frozen dessert is generally made with fruit, sugar, and water but contains no dairy?", "Sorbet", "Custard", "Gelato", "Frozen yogurt"],
          ["What happens to ice cream when its temperature rises above its freezing point?", "It melts", "It evaporates", "It crystallizes", "It expands into foam"]
        ]
      },
      {
        name: "Animals",
        questions: [
          ["Which land animal has the highest blood pressure because its heart must pump blood up a long neck?", "Giraffe", "Elephant", "Camel", "Horse"],
          ["What is the largest living reptile?", "Saltwater crocodile", "Komodo dragon", "Green anaconda", "Leatherback sea turtle"],
          ["Which bird is able to fly backward?", "Hummingbird", "Sparrow", "Falcon", "Owl"],
          ["What species of bear is native only to the Arctic region?", "Polar bear", "Grizzly bear", "Black bear", "Panda bear"],
          ["Which ocean animal uses echolocation and is known for living in social groups called pods?", "Dolphin", "Sea turtle", "Manta ray", "Penguin"]
        ]
      },
      {
        name: "Bible",
        questions: [
          ["Who interpreted Pharaoh's dreams about seven years of abundance followed by seven years of famine?", "Joseph", "Moses", "Daniel", "Joshua"],
          ["Which woman became queen of Persia and risked her life to protect her people?", "Esther", "Ruth", "Deborah", "Miriam"],
          ["What city's walls fell after the Israelites marched around them for seven days?", "Jericho", "Nineveh", "Babylon", "Ai"],
          ["Which disciple briefly walked on water toward Jesus before becoming afraid?", "Peter", "John", "Andrew", "Thomas"],
          ["According to Galatians 5, how many qualities are listed as the fruit of the Spirit?", "Nine", "Seven", "Ten", "Twelve"]
        ]
      },
      {
        name: "Random Knowledge",
        questions: [
          ["Which video-game character is an Italian plumber who frequently rescues Princess Peach?", "Mario", "Luigi", "Link", "Sonic"],
          ["What is the only continent located in all four hemispheres?", "Africa", "Asia", "South America", "Europe"],
          ["What do the letters \"www\" stand for in a website address?", "World Wide Web", "Wide Web Window", "Web Working World", "World Web Wire"],
          ["Which musical instrument has 88 keys on a standard modern version?", "Piano", "Guitar", "Accordion", "Organ"],
          ["In the original version of the board game Monopoly, what is the most expensive property?", "Boardwalk", "Park Place", "Marvin Gardens", "Pennsylvania Avenue"]
        ]
      }
    ],
    tiebreaker: ["How many individual squares are visible on the six faces of a standard 3-by-3 Rubik's Cube?", "54", "27", "48", "64"]
  }
];

export function createSeedGames(now = new Date().toISOString()): TriviaGame[] {
  return rawGames.map((game) => {
    const categories = game.categories.map((category, categoryIndex) => ({
      id: `${game.id}_cat_${categoryIndex + 1}`,
      gameId: game.id,
      name: category.name,
      sortOrder: categoryIndex + 1,
      theme: themeForCategory(category.name)
    }));

    const questions = game.categories.flatMap((category, categoryIndex) =>
      category.questions.map((question, questionIndex) => buildQuestion(game.id, categories[categoryIndex].id, question, questionIndex + 1 + categoryIndex * 5, false))
    );

    questions.push(buildQuestion(game.id, categories[0].id, game.tiebreaker, 999, true));

    return {
      id: game.id,
      ministryId: "ministry_demo",
      title: game.title,
      description: game.description,
      gameType: "team_trivia",
      status: "ready",
      defaultQuestionDurationSeconds: 30,
      defaultBasePoints: 1000,
      defaultSpeedBonusPoints: 300,
      randomizeAnswerOrder: true,
      audioTracks: [],
      audioSettings: {
        enabled: false,
        muted: true,
        volume: 0.7
      },
      celebrationSettings: {
        enabled: true,
        suspenseCountdownSeconds: 3,
        confetti: true,
        fireworks: false,
        trophy: true
      },
      createdBy: "usr_admin",
      createdAt: now,
      updatedAt: now,
      categories,
      questions
    };
  });
}

function buildQuestion(gameId: string, categoryId: string, raw: RawQuestion, sortOrder: number, isTiebreaker: boolean) {
  const [questionText, correct, wrongA = defaultWrong[0], wrongB = defaultWrong[1], wrongC = defaultWrong[2]] = raw;
  const questionId = `${gameId}_q_${sortOrder}`;
  const answerTexts = [correct, wrongA, wrongB, wrongC];
  return {
    id: questionId,
    gameId,
    categoryId,
    questionText,
    questionType: "multiple_choice" as const,
    explanation: isTiebreaker ? "Tie-breaker question for host-controlled playoff rounds." : "",
    timeLimitSeconds: isTiebreaker ? 45 : 30,
    basePoints: 1000,
    speedBonusPoints: 300,
    audioTrackId: undefined,
    sortOrder,
    isTiebreaker,
    answers: answerTexts.map((answerText, index) => ({
      id: `${questionId}_a_${index + 1}`,
      questionId,
      answerText,
      isCorrect: index === 0,
      sortOrder: index + 1
    }))
  };
}
