import { ScriptureLookup } from "@/components/student/scripture-lookup";
import { scriptureResources } from "@/lib/scripture/mock-data";
import {
  foundationBooks,
  newTestamentFlyovers,
  oldTestamentFlyovers,
  storylineGuardrail,
  storylineMap,
  themeIndex,
  type StorylineFlyover
} from "@/lib/scripture/storyline-guide";

export default function ScriptureResourcesPage() {
  return (
    <>
      <div className="storyline-guide grid gap-4">
        <section className="panel grid gap-3 bg-white">
          <p className="eyebrow">Bible Storyline Guide</p>
          <h1 className="title">The Big Story of Scripture</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            Start with Genesis and Exodus as the foundation layer, then fly over the rest of Scripture to see how later sections
            develop, deepen, challenge, and fulfill what those books introduce.
          </p>
          <p className="m-0 max-w-3xl rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-bold leading-6 text-sky-950">
            {storylineGuardrail}
          </p>
        </section>

        <section className="panel grid gap-4 bg-white" aria-label="Storyline map">
          <div>
            <p className="eyebrow">Layer 1: The Map</p>
            <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">Where are we in the story?</h2>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Biblical storyline movements">
            {storylineMap.map((movement, index) => (
              <div className="flex items-center gap-2" key={movement}>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                  {movement}
                </span>
                {index < storylineMap.length - 1 ? <span className="text-sm font-black text-sky-500">to</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" aria-label="Foundation books">
          <article className="card grid gap-4 border-sky-200 bg-sky-50">
            <div>
              <p className="eyebrow">Start Here</p>
              <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">Genesis + Exodus</h2>
            </div>
            <p className="m-0 text-sm font-semibold leading-6 text-slate-700">
              These two books introduce the vocabulary students need before the rest of the Bible feels like disconnected
              stories, rules, poems, and letters.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {foundationBooks.map((book) => (
                <div className="rounded-lg border border-sky-200 bg-white p-4" key={book.id}>
                  <h3 className="m-0 text-xl font-black text-slate-950">{book.title}</h3>
                  <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{book.overview}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid gap-3">
            <div>
              <p className="eyebrow">Then Fly Over</p>
              <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">The rest develops the foundation.</h2>
            </div>
            <p className="m-0 text-sm font-semibold leading-6 text-slate-600">
              Law, land, kings, prophets, wisdom, Jesus, the church, and new creation are not random topics. They build on
              patterns students first meet in Genesis and Exodus.
            </p>
          </article>
        </section>

        <section className="grid gap-4" aria-label="Genesis and Exodus deep dives">
          {foundationBooks.map((book) => (
            <article className="card grid gap-5" key={book.id}>
              <div>
                <p className="eyebrow">Layer 3: Deep Dive</p>
                <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">{book.title} full guide</h2>
                <p className="mb-0 mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{book.overview}</p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {book.movements.map((movement) => (
                  <section className="rounded-lg border border-[var(--line)] bg-slate-50 p-4" key={movement.id}>
                    <p className="eyebrow">{movement.startsAt}</p>
                    <h3 className="m-0 text-lg font-black text-slate-950">{movement.title}</h3>
                    <ul className="mb-0 mt-3 grid gap-1 pl-5 text-sm font-semibold leading-6 text-slate-600">
                      {movement.introduces.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-lg border border-[var(--line)] bg-white p-4">
                  <h3 className="m-0 text-lg font-black text-slate-950">Chapter flow</h3>
                  <div className="mt-3 grid gap-3">
                    {book.chapterFlow.map((chapter) => (
                      <div className="border-l-4 border-sky-300 pl-3" key={chapter.reference}>
                        <strong className="block text-sm font-black text-slate-950">{chapter.reference}</strong>
                        <p className="mb-0 mt-1 text-sm font-semibold leading-6 text-slate-600">{chapter.summary}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[var(--line)] bg-white p-4">
                  <h3 className="m-0 text-lg font-black text-slate-950">Where this shows up later</h3>
                  <div className="mt-3 grid gap-3">
                    {book.laterConnections.map((connection) => (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={connection.theme}>
                        <p className="eyebrow">{connection.introducedIn}</p>
                        <h4 className="m-0 text-base font-black text-slate-950">{connection.theme}</h4>
                        <p className="mb-0 mt-1 text-sm font-semibold leading-6 text-slate-600">{connection.watchFor}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="m-0 text-lg font-black text-emerald-950">Student reflection questions</h3>
                  <ul className="mb-0 mt-3 grid gap-2 pl-5 text-sm font-bold leading-6 text-emerald-950">
                    {book.reflectionPrompts.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="m-0 text-lg font-black text-amber-950">Leader notes</h3>
                  <ul className="mb-0 mt-3 grid gap-2 pl-5 text-sm font-bold leading-6 text-amber-950">
                    {book.leaderNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </article>
          ))}
        </section>

        <section className="panel grid gap-4 bg-white" aria-label="Flyover guides">
          <div>
            <p className="eyebrow">Layer 2: The Guide</p>
            <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">Flyover pathways</h2>
            <p className="mb-0 mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              These are intentionally lighter than Genesis and Exodus for launch. They give students a map before they get lost in
              details.
            </p>
          </div>
          <FlyoverGrid title="Old Testament flyover" items={oldTestamentFlyovers} />
          <FlyoverGrid title="New Testament flyover" items={newTestamentFlyovers} />
        </section>

        <section className="panel grid gap-4 bg-white" aria-label="Theme index">
          <div>
            <p className="eyebrow">Theme Index</p>
            <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">Tap a theme and trace the thread.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {themeIndex.map((theme) => (
              <article className="rounded-lg border border-[var(--line)] bg-slate-50 p-4" key={theme.id}>
                <h3 className="m-0 text-lg font-black text-slate-950">{theme.title}</h3>
                <dl className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-slate-600">
                  <div>
                    <dt className="font-black text-slate-900">Begins</dt>
                    <dd className="m-0">{theme.begins}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-slate-900">Develops</dt>
                    <dd className="m-0">{theme.develops}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-slate-900">Fulfilled in Christ</dt>
                    <dd className="m-0">{theme.fulfilled}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </div>

      <ScriptureLookup />

      <section className="grid gap-4 md:grid-cols-2" aria-label="Scripture study resources">
        <div className="md:col-span-2">
          <p className="eyebrow">Reading Skills</p>
          <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">Simple tools for reading carefully together.</h2>
        </div>
        {scriptureResources.map((resource) => (
          <article className="card grid gap-3" key={resource.id}>
            <div>
              <p className="eyebrow">{resource.title}</p>
              <h2 className="m-0 text-xl font-black leading-tight text-slate-950">{resource.title}</h2>
            </div>
            <p className="m-0 text-sm font-semibold leading-6 text-slate-600">{resource.summary}</p>
            <div className="rounded-md border border-[var(--line)] bg-slate-50 p-3">
              <h3 className="m-0 text-sm font-black text-slate-900">Try this</h3>
              <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{resource.studentPractice}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function FlyoverGrid({ items, title }: { items: StorylineFlyover[]; title: string }) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <h3 className="m-0 text-lg font-black text-slate-950">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article className="rounded-lg border border-[var(--line)] bg-slate-50 p-4" key={item.id}>
            <p className="eyebrow">{item.covers}</p>
            <h4 className="m-0 text-lg font-black text-slate-950">{item.title}</h4>
            <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{item.bigIdea}</p>
            <ul className="mb-0 mt-3 grid gap-1 pl-5 text-sm font-semibold leading-6 text-slate-600">
              {item.focus.map((focus) => (
                <li key={focus}>{focus}</li>
              ))}
            </ul>
            {item.warning ? (
              <p className="mb-0 mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-950">
                {item.warning}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
