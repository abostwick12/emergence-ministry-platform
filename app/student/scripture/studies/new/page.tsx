import { metanarrativeMovements } from "@/lib/scripture/mock-data";

const studyFields = [
  { id: "context-notes", label: "Context notes", placeholder: "What does the group need to know before reading this passage?" },
  { id: "observation-question", label: "Observation question", placeholder: "What details, repeated words, or contrasts should students notice?" },
  { id: "interpretation-question", label: "Interpretation question", placeholder: "What is the passage teaching in its original context?" },
  { id: "application-question", label: "Application question", placeholder: "What faithful response fits the text and our community?" },
  { id: "discussion-question", label: "Discussion question", placeholder: "What question invites honest wrestling instead of quick answers?" },
  { id: "prayer-prompt", label: "Prayer prompt", placeholder: "How should this passage shape praise, confession, request, or trust?" },
  { id: "guardrail-notes", label: "Theological guardrail notes", placeholder: "What direct teaching, inference, or creative connection needs to be named carefully?" }
];

export default function NewStudentLedStudyPage() {
  return (
    <>
      <section className="panel grid gap-3 bg-white">
        <p className="eyebrow">New Student-Led Study</p>
        <h1 className="title">Shape a discussion that starts with the text and stays humble.</h1>
        <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
          This page models a student-led Bible study builder for preview and leader review only. It does not publish, message,
          save, submit, or process student content.
        </p>
      </section>

      <form className="panel grid gap-5 bg-white" aria-label="New Student-Led Study builder">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span>Title</span>
            <input className="input" name="title" placeholder="What does Jesus mean by kingdom?" type="text" />
          </label>
          <label className="field">
            <span>Audience</span>
            <input className="input" name="audience" placeholder="Student-led small group" type="text" />
          </label>
          <label className="field">
            <span>Duration</span>
            <input className="input" name="duration" placeholder="45 minutes" type="text" />
          </label>
          <label className="field">
            <span>Primary Scripture reference</span>
            <input className="input" name="primary-scripture" placeholder="Mark 1:14-20" type="text" />
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
          {studyFields.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              <textarea className="input min-h-24 resize-y" name={field.id} placeholder={field.placeholder} />
            </label>
          ))}
        </div>

        <section className="grid gap-3 rounded-md border border-blue-200 bg-blue-50 p-4" aria-label="Leader review reminder">
          <h2 className="m-0 text-base font-black text-blue-950">Leader review guardrail</h2>
          <p className="m-0 text-sm font-bold leading-6 text-blue-900">
            Student-led studies should be clear about what Scripture directly teaches, what the group is inferring, and what
            connections are creative. Nothing here becomes public or shared without leader review in a future workflow.
          </p>
        </section>

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
