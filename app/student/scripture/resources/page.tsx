import { ScriptureLookup } from "@/components/student/scripture-lookup";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { StudentStudyToolRail } from "@/components/student/student-study-tool-rail";
import { scriptureResources } from "@/lib/scripture/mock-data";
import { getEmbeddableVideoUrl } from "@/lib/scripture/video-embed";
import {
  foundationBooks,
  newTestamentFlyovers,
  oldTestamentFlyovers,
  storylineMap,
  themeIndex,
  type StorylineFlyover,
  type StorylineFoundationBook,
  type StorylineTheme
} from "@/lib/scripture/storyline-guide";

type ScriptureResourcesPageProps = {
  searchParams?: {
    reference?: string | string[];
  };
};

const movementNotes: Record<(typeof storylineMap)[number], string> = {
  Creation: "God makes a good world and gives people a calling.",
  Fall: "Sin breaks trust with God, people, and creation.",
  Covenant: "God makes promises and forms a people.",
  Exodus: "God rescues His people and teaches them how to live with Him.",
  Law: "God shapes rescued people into a holy community.",
  Land: "God's promises become a lived place and a real test of faithfulness.",
  Kingdom: "Israel's kings show both the need for good rule and the failure of human power.",
  Exile: "God's people lose home, land, and temple because of covenant unfaithfulness.",
  Return: "God keeps His promises, but the story still waits for deeper restoration.",
  Messiah: "Jesus fulfills Israel's story and announces God's kingdom.",
  Church: "The Spirit forms a people sent to witness to the nations.",
  "New Creation": "God renews what sin broke and dwells with His people forever."
};

const visibleThemes = themeIndex.filter((theme) => ["covenant", "kingdom", "temple", "exile", "sacrifice", "new-creation"].includes(theme.id));
const bigStoryVideoUrl = getEmbeddableVideoUrl("https://www.youtube.com/embed/7_CGP-12AE0");

const storylinePath = [
  {
    title: "God creates and blesses",
    movements: ["Creation", "Covenant"],
    read: "Genesis 1-2, Genesis 12",
    notice: "What is good, gifted, and promised?",
    practice: "Name one thing God gives before anyone earns it."
  },
  {
    title: "Trust breaks and people wander",
    movements: ["Fall", "Exile"],
    read: "Genesis 3, 2 Kings 17",
    notice: "Where does sin fracture trust, worship, and home?",
    practice: "Ask what is broken before asking what to do."
  },
  {
    title: "God rescues and forms a people",
    movements: ["Exodus", "Law", "Land", "Kingdom", "Return"],
    read: "Exodus 1-20, 2 Samuel 7",
    notice: "How does God rescue, teach, and stay present?",
    practice: "Look for rescue before turning the passage into advice."
  },
  {
    title: "Jesus fulfills and renews",
    movements: ["Messiah", "Church", "New Creation"],
    read: "Luke 4, Acts 2, Revelation 21",
    notice: "How does Jesus bring the story to its center and future?",
    practice: "Connect to Jesus through the text's story, not a shortcut."
  }
] as const;

const storyJourney = [
  {
    id: "creation-fall",
    title: "Creation and Fall",
    range: "Genesis 1-11",
    icon: "Tree",
    tone: "origin",
    steps: [
      { label: "Read", title: "Genesis 1-3", detail: "Ask what God gives, what humans are made for, and where trust breaks." },
      { label: "Question", title: "What is good before anything goes wrong?", detail: "Name gifts before naming the problem." },
      { label: "Practice", title: "Creation walk", detail: "Notice creation and pray one sentence of gratitude." }
    ]
  },
  {
    id: "abraham",
    title: "Covenant with Abraham",
    range: "Genesis 12-50",
    icon: "Promise",
    tone: "presence",
    steps: [
      { label: "Read", title: "Genesis 12, 15, 22", detail: "Trace promise, trust, blessing, and God's provision." },
      { label: "Question", title: "Who is the blessing meant to reach?", detail: "Watch how one family is called for the nations." },
      { label: "Context", title: "Promise before possession", detail: "Abraham receives promises before he sees the whole outcome." }
    ]
  },
  {
    id: "exodus",
    title: "Exodus from Egypt",
    range: "Exodus 1-18",
    icon: "Rescue",
    tone: "formation",
    steps: [
      { label: "Read", title: "Exodus 3, 12, 14", detail: "Notice God hearing, rescuing, judging false powers, and making a people." },
      { label: "Question", title: "What does God rescue people from and for?", detail: "Hold deliverance and worship together." },
      { label: "Practice", title: "Prayer of rescue", detail: "Name one place you need God's help and one way rescue could lead to worship." }
    ]
  },
  {
    id: "sinai",
    title: "Covenant at Sinai",
    range: "Exodus 19 - Leviticus",
    icon: "Law",
    tone: "formation",
    steps: [
      { label: "Read", title: "Exodus 19-20", detail: "Read commands inside rescue, identity, and covenant." },
      { label: "Question", title: "What kind of people is God forming?", detail: "Ask how holiness connects to love for God and neighbor." },
      { label: "Tip", title: "Do not start with rule-keeping", detail: "Start with God's rescue and presence before application." }
    ]
  },
  {
    id: "land-kingdom",
    title: "Land and Kingdom",
    range: "Joshua - 2 Kings",
    icon: "Crown",
    tone: "kingdom",
    steps: [
      { label: "Read", title: "Joshua 1, 2 Samuel 7, 1 Kings 8", detail: "Watch promise, place, kingship, temple, and failure." },
      { label: "Question", title: "What kind of king do people need?", detail: "Notice the gap between God's rule and human power." },
      { label: "Context", title: "Promises under pressure", detail: "The land and kingdom expose the need for deeper faithfulness." }
    ]
  },
  {
    id: "wisdom-prophets",
    title: "Wisdom and Prophets",
    range: "Job - Malachi",
    icon: "Voice",
    tone: "restoration",
    steps: [
      { label: "Read", title: "Psalm 13, Isaiah 40, Micah 6", detail: "Let wisdom and prophets teach lament, hope, justice, and worship." },
      { label: "Question", title: "What pain or warning is being named?", detail: "Do not rush lament or prophetic warning into a quick lesson." },
      { label: "Practice", title: "Honest prayer", detail: "Pray one sentence of lament and one sentence of hope." }
    ]
  },
  {
    id: "jesus-kingdom",
    title: "Jesus and the Kingdom",
    range: "Matthew - Acts",
    icon: "Cross",
    tone: "fulfillment",
    steps: [
      { label: "Read", title: "Mark 1, Luke 4, John 1, Acts 2", detail: "Watch Jesus fulfill Israel's story and send Spirit-formed witnesses." },
      { label: "Question", title: "How does Jesus bring the story to its center?", detail: "Look for fulfillment through teaching, cross, resurrection, and Spirit." },
      { label: "Practice", title: "Witness with humility", detail: "Name one way your group can embody good news this week." }
    ]
  },
  {
    id: "new-creation",
    title: "People of the Kingdom and New Creation",
    range: "Romans - Revelation",
    icon: "Home",
    tone: "renewal",
    steps: [
      { label: "Read", title: "Romans 8, Ephesians 2, Revelation 21", detail: "Trace new humanity, patient hope, and creation renewed." },
      { label: "Question", title: "What is God renewing?", detail: "Keep Christian hope bigger than escaping the world." },
      { label: "Practice", title: "Hope inventory", detail: "Name one broken thing you are waiting for God to renew." }
    ]
  }
] as const;

export default function ScriptureResourcesPage({ searchParams }: ScriptureResourcesPageProps) {
  const requestedReference = Array.isArray(searchParams?.reference) ? searchParams.reference[0] : searchParams?.reference;

  return (
    <>
      <StudentScriptureTabs active="resources" />

      <ScriptureLookup initialReference={requestedReference ?? ""} />

      <div className="storyline-guide student-big-story">
        <section className="student-big-story-hero" aria-labelledby="big-story-title">
          <div className="student-big-story-hero-copy">
            <p className="eyebrow">Bible Storyline Guide</p>
            <h1 id="big-story-title" className="title">The Big Story of Scripture</h1>
          </div>
          <div className="student-big-story-note" aria-label="Big story guardrail">
            <strong>Start simple.</strong>
          </div>
        </section>

        <section className="student-big-story-section student-big-story-video" aria-label="Bible big story video">
          <div className="how-to-read-guide-video">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              src={bigStoryVideoUrl}
              title="The Bible's Big Story"
            />
          </div>
        </section>

        <section className="student-big-story-section student-storyline-path-section" aria-labelledby="story-path-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Work Through It</p>
            <h2 id="story-path-title">Four moves before all the details</h2>
          </div>
          <ol className="student-storyline-path" aria-label="Guided Bible storyline path">
            {storylinePath.map((step, index) => (
              <li key={step.title}>
                <div className="student-storyline-step-number">{index + 1}</div>
                <div className="student-storyline-step-copy">
                  <span>{step.movements.join(" / ")}</span>
                  <strong>{step.title}</strong>
                  <p>{step.notice}</p>
                </div>
                <div className="student-storyline-step-practice">
                  <small>Read</small>
                  <p>{step.read}</p>
                  <small>Try</small>
                  <p>{step.practice}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="student-big-story-section student-story-journey" aria-labelledby="story-journey-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Your Journey</p>
            <h2 id="story-journey-title">Move through the Bible without getting lost</h2>
          </div>
          <div className="student-story-journey-list">
            {storyJourney.map((section) => (
              <details className={`student-story-journey-row ${section.tone}`} key={section.id}>
                <summary>
                  <span className="student-story-journey-icon">{section.icon}</span>
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.range}</small>
                  </span>
                </summary>
                <ol className="student-story-journey-steps">
                  {section.steps.map((step) => (
                    <li key={`${section.id}-${step.title}`}>
                      <span>{step.label}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>

        <section className="student-big-story-section student-big-story-workspace" aria-labelledby="foundation-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Start Here</p>
            <h2 id="foundation-title">Start with Genesis and Exodus</h2>
          </div>
          <section className="student-big-story-today" aria-label="Today's storyline practice">
            <strong>Today&apos;s move</strong>
            <p>Pick Genesis or Exodus, read one chapter path, then write one honest question before moving on.</p>
          </section>
          <div className="student-big-story-foundation">
            {foundationBooks.map((book) => (
              <FoundationBookCard book={book} key={book.id} />
            ))}
          </div>
        </section>

        <section className="student-big-story-section student-big-story-depth" aria-labelledby="depth-title">
          <div>
            <p className="eyebrow">Go Deeper</p>
            <h2 id="depth-title">Open the next layer when you are ready</h2>
          </div>
          <details className="student-atlas-layer storyline">
            <summary>
              <span className="student-atlas-badge">Story map</span>
              <strong>Open the full storyline map</strong>
              <small>12 movements from creation to new creation</small>
            </summary>
            <ol className="student-big-story-map student-storyline-map" aria-label="Bible storyline movements">
              {storylineMap.map((movement, index) => (
                <li className={`student-storyline-map-card ${movementTone(movement)}`} key={movement}>
                  <span>{index + 1}</span>
                  <strong>{movement}</strong>
                  <p>{movementNotes[movement]}</p>
                </li>
              ))}
            </ol>
          </details>
          <details className="student-atlas-layer flyover">
            <summary>
              <span className="student-atlas-badge">Flyover</span>
              <strong>Open the Old and New Testament flyover</strong>
              <small>Book clusters without losing the whole story</small>
            </summary>
            <FlyoverRail title="Old Testament flyover" items={oldTestamentFlyovers} tone="old" />
            <FlyoverRail title="New Testament flyover" items={newTestamentFlyovers} tone="new" />
          </details>
          <details className="student-atlas-layer themes">
            <summary>
              <span className="student-atlas-badge">Themes</span>
              <strong>Open themes to trace as you read</strong>
              <small>Recurring threads with beginnings and fulfillment</small>
            </summary>
            <div className="student-big-story-themes">
              {visibleThemes.map((theme) => (
                <ThemeCard theme={theme} key={theme.id} />
              ))}
            </div>
          </details>
        </section>
      </div>

      <section className="student-resource-tools" aria-label="Scripture study resources">
        <div className="student-big-story-heading">
          <p className="eyebrow">Reading Skills</p>
          <h2>Simple tools for reading carefully together</h2>
        </div>
        <StudentStudyToolRail resources={scriptureResources} />
      </section>
    </>
  );
}

function FoundationBookCard({ book }: { book: StorylineFoundationBook }) {
  return (
    <article className="student-foundation-book">
      <div>
        <p className="eyebrow">{book.id === "genesis" ? "Beginnings and Promise" : "Rescue and Formation"}</p>
        <h3>{book.id === "genesis" ? "Genesis: beginnings and promise" : "Exodus: rescue and formation"}</h3>
        <p>{book.overview}</p>
      </div>

      <div className="student-foundation-movements" aria-label={`${book.title} movements`}>
        {book.movements.map((movement) => (
          <section key={movement.id}>
            <span>{movement.startsAt}</span>
            <strong>{movement.title}</strong>
            <p>{movement.introduces.slice(0, 3).join(", ")}</p>
          </section>
        ))}
      </div>

      <details className="student-foundation-details">
        <summary>Open {book.title} guide</summary>
        <div className="student-foundation-detail-grid">
          <section>
            <h4>Chapter path</h4>
            <ol>
              {book.chapterFlow.slice(0, 5).map((chapter) => (
                <li key={chapter.reference}>
                  <strong>{chapter.reference}</strong>
                  <span>{chapter.summary}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h4>Where it shows up later</h4>
            <ol>
              {book.laterConnections.slice(0, 4).map((connection) => (
                <li key={connection.theme}>
                  <strong>{connection.theme}</strong>
                  <span>{connection.watchFor}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="student-foundation-questions">
          <strong>Questions to ask</strong>
          <ul>
            {book.reflectionPrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
}

function FlyoverRail({ items, title, tone }: { items: StorylineFlyover[]; title: string; tone: "old" | "new" }) {
  return (
    <section className="student-flyover" aria-label={title}>
      <h3>{title}</h3>
      <div className="student-flyover-grid">
        {items.map((item) => (
          <article className={`student-flyover-card ${tone}`} key={item.id}>
            <span>{item.covers}</span>
            <strong>{item.title.replace(" Flyover", "")}</strong>
            <p>{item.bigIdea}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: StorylineTheme }) {
  return (
    <article className={`student-theme-card ${themeTone(theme)}`}>
      <h3>{theme.title}</h3>
      <p>{theme.fulfilled}</p>
      <dl>
        <div>
          <dt>Begins</dt>
          <dd>{theme.begins}</dd>
        </div>
        <div>
          <dt>Develops</dt>
          <dd>{theme.develops}</dd>
        </div>
      </dl>
    </article>
  );
}

function movementTone(movement: (typeof storylineMap)[number]) {
  if (movement === "Creation" || movement === "Covenant") return "origin";
  if (movement === "Fall" || movement === "Exile") return "rupture";
  if (movement === "Messiah" || movement === "Church" || movement === "New Creation") return "fulfillment";
  return "formation";
}

function themeTone(theme: StorylineTheme) {
  if (theme.id === "covenant" || theme.id === "temple") return "presence";
  if (theme.id === "exile" || theme.id === "sacrifice") return "restoration";
  if (theme.id === "kingdom") return "kingdom";
  return "renewal";
}
