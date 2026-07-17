import { ScriptureBuilderForm } from "@/components/student/scripture-builder-form";

export default function NewReadingPlanPage() {
  return (
    <>
      <section className="panel grid gap-3">
        <p className="eyebrow">New Reading Plan</p>
        <h1 className="title">Build a reading plan draft around context and the whole story.</h1>
        <p className="scripture-builder-copy">
          Draft a leader-review reading plan through Meridian. Gloo is the primary student-page provider; Gemini or OpenAI
          can serve as fallback when configured. Nothing is published or sent from this page.
        </p>
      </section>

      <ScriptureBuilderForm kind="plan" />
    </>
  );
}
