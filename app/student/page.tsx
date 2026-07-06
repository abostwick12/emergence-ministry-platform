import { ScriptureCard } from "@/components/student/scripture-card";

const nextSteps = [
  "Choose a reading plan that helps you see the passage in the wider story.",
  "Use the resource guide before leading a discussion.",
  "Draft plans and studies for leader review before anything is shared."
];

export default function StudentPortalPage() {
  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Student Portal</p>
          <h1 className="title">Practice reading Scripture with context, community, and care.</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            This first student space focuses on Scripture reading plans and student-led study tools. It is a static MVP shell:
            drafts, previews, and leader review language are visible, but nothing is saved, submitted, published, or sent.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {nextSteps.map((step, index) => (
            <div className="rounded-md border border-[var(--line)] bg-slate-50 p-4" key={step}>
              <span className="pill blue">Step {index + 1}</span>
              <p className="mb-0 mt-3 text-sm font-bold leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Student portal areas">
        <ScriptureCard
          actionLabel="Open Hub"
          description="Start with whole-Scripture context, careful questions, and student-friendly guardrails."
          eyebrow="Core tool"
          href="/student/scripture"
          title="Scripture Hub"
        />
        <ScriptureCard
          actionLabel="View Plans"
          description="Browse mock plans built around context, metanarrative movement, discussion, and prayer."
          eyebrow="Mock data"
          href="/student/scripture/plans"
          title="Reading Plans"
        />
        <ScriptureCard
          actionLabel="Study Better"
          description="Use simple guides for context, observation, interpretation, application, discussion, and prayer."
          eyebrow="Resources"
          href="/student/scripture/resources"
          title="Study Resources"
        />
      </section>
    </>
  );
}
