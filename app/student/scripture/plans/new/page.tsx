import { ScriptureBuilderForm } from "@/components/student/scripture-builder-form";

export default function NewReadingPlanPage() {
  return (
    <>
      <section className="panel grid gap-3">
        <p className="eyebrow">New Reading Plan</p>
        <h1 className="title">Build a reading plan draft around context and the whole story.</h1>
        <p className="scripture-builder-copy">
          This static builder shows the shape of a future draft workflow. The controls below do not save, submit, publish,
          send, or call an API in this slice.
        </p>
      </section>

      <ScriptureBuilderForm kind="plan" />
    </>
  );
}
