import { metanarrativeMovements } from "@/lib/scripture/mock-data";

const questions = [
  { id: "context-notes", label: "Context notes", placeholder: "Where does this passage sit in the book and the wider story?" },
  { id: "observation-question", label: "Observation question", placeholder: "What should the group notice in the text first?" },
  { id: "interpretation-question", label: "Interpretation question", placeholder: "What does the passage mean in context?" },
  { id: "application-question", label: "Application question", placeholder: "How should we respond faithfully without making the passage mainly about us?" },
  { id: "discussion-question", label: "Discussion question", placeholder: "What question will help the group wrestle together with humility?" },
  { id: "prayer-prompt", label: "Prayer prompt", placeholder: "How can prayer respond to what this passage reveals?" },
  { id: "guardrail-notes", label: "Theological guardrail notes", placeholder: "What should the group avoid flattening, forcing, or overstating?" }
];

export default function NewReadingPlanPage() {
  return (
    <>
      <section className="panel grid gap-3 bg-white">
        <p className="eyebrow">New Reading Plan</p>
        <h1 className="title">Build a reading plan draft around context and the whole story.</h1>
        <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
          This static builder shows the shape of a future draft workflow. The controls below do not save, submit, publish,
          send, or call an API in this slice.
        </p>
      </section>

      <form className="panel grid gap-5 bg-white" aria-label="New Reading Plan builder">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span>Title</span>
            <input className="input" name="title" placeholder="Exodus and Formation" type="text" />
          </label>
          <label className="field">
            <span>Audience</span>
            <input className="input" name="audience" placeholder="High school small group" type="text" />
          </label>
          <label className="field">
            <span>Duration</span>
            <input className="input" name="duration" placeholder="4 weeks" type="text" />
          </label>
          <label className="field">
            <span>Primary Scripture reference</span>
            <input className="input" name="primary-scripture" placeholder="Exodus 1-20 overview" type="text" />
          </label>
          <label className="field md:col-span-2">
            <span>Metanarrative movement</span>
            <select className="input" defaultValue="" name="movement">
              <option value="" disabled>
                Choose a movement
              </option>
              {metanarrativeMovements.map((movement) => (
                <option key={movement} value={movement}>
                  {movement}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4">
          {questions.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              <textarea className="input min-h-24 resize-y" name={field.id} placeholder={field.placeholder} />
            </label>
          ))}
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="m-0 text-sm font-bold leading-6 text-amber-900">
            Draft-only MVP: student-created reading plans are not saved or visible to others. Future submission would require
            leader review before any sharing.
          </p>
        </div>

        <div className="toolbar">
          <button className="button primary" disabled type="button">
            Save Draft
          </button>
          <button className="button" disabled type="button">
            Preview
          </button>
          <button className="button" disabled type="button">
            Send to Leader Review
          </button>
        </div>
      </form>
    </>
  );
}
