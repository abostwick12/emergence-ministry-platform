import { ScriptureCard } from "@/components/student/scripture-card";

const nextSteps = [
  "Submit real small-group questions for leader review.",
  "Use the resource guide before leading a discussion.",
  "Keep drafts and discussions under clear leader approval."
];

export default function StudentPortalPage() {
  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Student Portal</p>
          <h1 className="title">Practice reading Scripture with context, community, and care.</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            This student space supports real small-group question submission, leader-reviewed discussion prompts, Scripture
            resources, and draft tools that keep ministry conversations under human oversight.
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
          actionLabel="Ask a Question"
          description="Submit real small-group questions for leader review before anything is shared with students."
          eyebrow="Tryout workflow"
          href="/student/scripture/questions"
          title="Small Group Questions"
        />
        <ScriptureCard
          actionLabel="View Plans"
          description="Browse planning examples built around context, metanarrative movement, discussion, and prayer."
          eyebrow="Planning"
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
