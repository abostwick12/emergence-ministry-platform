import { ScriptureCard } from "@/components/student/scripture-card";
import { metanarrativeMovements, studySeeds } from "@/lib/scripture/mock-data";

const guardrails = [
  "Keep Scripture in context before moving to application.",
  "Let the Old Testament speak in its own setting before tracing fulfillment.",
  "Do not imply every passage is mainly about me.",
  "Avoid hunting for secret meanings.",
  "Name the difference between direct teaching, theological inference, and creative connection.",
  "Bring student-led work through humble community discussion and leader review."
];

export default function ScriptureHubPage() {
  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Scripture Hub</p>
          <h1 className="title">Read the Bible as one story before rushing to quick answers.</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            The Hub helps students build reading plans and student-led studies that start with context, trace the movement of
            Scripture, and make room for honest community wrestling under leader review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill green">Context before application</span>
          <span className="pill blue">Leader review required</span>
          <span className="pill amber">Static MVP shell</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Scripture Hub actions">
        <ScriptureCard
          actionLabel="Browse Plans"
          description="See mock plans that connect passages to the bigger biblical story without proof-texting."
          eyebrow="Reading"
          href="/student/scripture/plans"
          title="Reading Plans"
        />
        <ScriptureCard
          actionLabel="New Reading Plan"
          description="Open a static builder shaped around audience, duration, context notes, questions, prayer, and guardrails."
          eyebrow="Builder"
          href="/student/scripture/plans/new"
          title="New Reading Plan"
        />
        <ScriptureCard
          actionLabel="New Student-Led Study"
          description="Draft a student-led study structure that is designed for preview and leader review, not direct publishing."
          eyebrow="Builder"
          href="/student/scripture/studies/new"
          title="New Student-Led Study"
        />
        <ScriptureCard
          actionLabel="Open Queue"
          description="Review mock drafts waiting for leader feedback so student-led study stays faithful and clear."
          eyebrow="Review"
          href="/student/scripture/review"
          title="Review Queue"
        />
        <ScriptureCard
          actionLabel="Open Resources"
          description="Use short guides for exegesis habits, better questions, and avoiding forced typology."
          eyebrow="Guide"
          href="/student/scripture/resources"
          title="Study Resources"
        />
      </section>

      <section className="panel grid gap-4 bg-white" aria-label="Metanarrative movements">
        <div>
          <p className="eyebrow">Whole Scripture</p>
          <h2 className="section-title flush">Metanarrative movements</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {metanarrativeMovements.map((movement) => (
            <span className="pill" key={movement}>
              {movement}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel grid gap-3 bg-white">
          <p className="eyebrow">Theological Guardrails</p>
          <h2 className="section-title flush">How student work stays careful</h2>
          <ul className="m-0 grid gap-2 pl-5 text-sm font-semibold leading-6 text-slate-700">
            {guardrails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="panel grid gap-3 bg-white">
          <p className="eyebrow">Study seeds</p>
          <h2 className="section-title flush">Student-led discussion starters</h2>
          {studySeeds.map((seed) => (
            <article className="rounded-md border border-[var(--line)] bg-slate-50 p-4" key={seed.id}>
              <h3 className="m-0 text-base font-black text-slate-950">{seed.title}</h3>
              <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{seed.purpose}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
