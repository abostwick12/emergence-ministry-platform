import { ScriptureLookup } from "@/components/student/scripture-lookup";
import { scriptureResources } from "@/lib/scripture/mock-data";

export default function ScriptureResourcesPage() {
  return (
    <>
      <section className="panel grid gap-3 bg-white">
        <p className="eyebrow">Study Resources</p>
        <h1 className="title">Simple tools for reading carefully together.</h1>
        <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
          These guides help students slow down, ask better questions, and avoid using verses as shortcuts. They are static
          resources with no account linking, AI, messaging, or persistence.
        </p>
      </section>

      <ScriptureLookup />

      <section className="grid gap-4 md:grid-cols-2" aria-label="Scripture study resources">
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
