import { ScriptureLookup } from "@/components/student/scripture-lookup";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { scriptureResources } from "@/lib/scripture/mock-data";
import {
  foundationBooks,
  newTestamentFlyovers,
  oldTestamentFlyovers,
  storylineGuardrail,
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

export default function ScriptureResourcesPage({ searchParams }: ScriptureResourcesPageProps) {
  const requestedReference = Array.isArray(searchParams?.reference) ? searchParams.reference[0] : searchParams?.reference;

  return (
    <>
      <StudentScriptureTabs active="resources" />

      <div className="storyline-guide student-big-story">
        <section className="student-big-story-hero" aria-labelledby="big-story-title">
          <div className="student-big-story-hero-copy">
            <p className="eyebrow">Bible Storyline Guide</p>
            <h1 id="big-story-title" className="title">The Big Story of Scripture</h1>
            <p>
              The Bible is not a pile of disconnected verses. It is one unfolding story about God creating, people
              turning away, God rescuing, and Jesus bringing the story to its center.
            </p>
          </div>
          <div className="student-big-story-note" aria-label="Big story guardrail">
            <strong>Start simple.</strong>
            <p>{storylineGuardrail}</p>
          </div>
        </section>

        <section className="student-big-story-section" aria-labelledby="story-map-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">The Map</p>
            <h2 id="story-map-title">Where are we in the story?</h2>
            <p>Use this as a quick orientation before zooming into a chapter, verse, theme, or hard question.</p>
          </div>
          <ol className="student-big-story-map" aria-label="Bible storyline movements">
            {storylineMap.map((movement, index) => (
              <li key={movement}>
                <span>{index + 1}</span>
                <strong>{movement}</strong>
                <p>{movementNotes[movement]}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="student-big-story-section" aria-labelledby="foundation-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Start Here</p>
            <h2 id="foundation-title">Start with Genesis and Exodus</h2>
            <p>
              These books give students the basic vocabulary for the rest of Scripture: creation, sin, promise, rescue,
              worship, covenant, and the presence of God.
            </p>
          </div>
          <div className="student-big-story-foundation">
            {foundationBooks.map((book) => (
              <FoundationBookCard book={book} key={book.id} />
            ))}
          </div>
        </section>

        <section className="student-big-story-section" aria-labelledby="flyover-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Then Fly Over</p>
            <h2 id="flyover-title">Fly over the rest before getting lost in details</h2>
            <p>
              This is not everything a student could learn. It is the first map: enough to know where a passage sits and
              what questions to bring to the text.
            </p>
          </div>
          <FlyoverRail title="Old Testament flyover" items={oldTestamentFlyovers} />
          <FlyoverRail title="New Testament flyover" items={newTestamentFlyovers} />
        </section>

        <section className="student-big-story-section" aria-labelledby="theme-title">
          <div className="student-big-story-heading">
            <p className="eyebrow">Themes to Trace</p>
            <h2 id="theme-title">Themes to trace as you read</h2>
            <p>These themes are handles, not secret codes. They help students notice how Scripture holds together.</p>
          </div>
          <div className="student-big-story-themes">
            {visibleThemes.map((theme) => (
              <ThemeCard theme={theme} key={theme.id} />
            ))}
          </div>
        </section>
      </div>

      <ScriptureLookup initialReference={requestedReference ?? ""} />

      <section className="student-resource-tools" aria-label="Scripture study resources">
        <div className="student-big-story-heading">
          <p className="eyebrow">Reading Skills</p>
          <h2>Simple tools for reading carefully together</h2>
          <p>Use these when a passage feels confusing, familiar, or easy to use too quickly.</p>
        </div>
        <div className="student-resource-grid">
          {scriptureResources.map((resource) => (
            <article className="student-resource-card" key={resource.id}>
              <p className="eyebrow">{resource.title}</p>
              <h3>{resource.title}</h3>
              <p>{resource.summary}</p>
              <div>
                <strong>Try this</strong>
                <p>{resource.studentPractice}</p>
              </div>
            </article>
          ))}
        </div>
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

function FlyoverRail({ items, title }: { items: StorylineFlyover[]; title: string }) {
  return (
    <section className="student-flyover" aria-label={title}>
      <h3>{title}</h3>
      <div className="student-flyover-grid">
        {items.map((item) => (
          <article key={item.id}>
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
    <article className="student-theme-card">
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
