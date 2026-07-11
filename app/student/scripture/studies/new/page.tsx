import { ScriptureBuilderForm } from "@/components/student/scripture-builder-form";

export default function NewStudentLedStudyPage() {
  return (
    <>
      <section className="panel grid gap-3">
        <p className="eyebrow">New Student-Led Study</p>
        <h1 className="title">Shape a discussion that starts with the text and stays humble.</h1>
        <p className="scripture-builder-copy">
          This page models a student-led Bible study builder for preview and leader review only. It does not publish, message,
          save, submit, or process student content.
        </p>
      </section>

      <ScriptureBuilderForm kind="study" />
    </>
  );
}
