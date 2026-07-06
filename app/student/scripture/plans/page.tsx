import Link from "next/link";

import { ScriptureCard } from "@/components/student/scripture-card";
import { scripturePlans } from "@/lib/scripture/mock-data";

export default function ScripturePlansPage() {
  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="toolbar split">
          <div className="grid gap-2">
            <p className="eyebrow">Reading Plans</p>
            <h1 className="title">Mock reading plans for whole-Scripture familiarity.</h1>
            <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
              These plans are sample resources only. They do not call a Bible API, assume Bible text licensing, link accounts,
              or save student progress.
            </p>
          </div>
          <Link className="button primary" href="/student/scripture/plans/new">
            New Reading Plan
          </Link>
        </div>
      </section>

      <section className="grid gap-4" aria-label="Mock reading plans">
        {scripturePlans.map((plan) => (
          <ScriptureCard
            description={plan.summary}
            eyebrow={plan.movement}
            key={plan.id}
            meta={[plan.audience, plan.duration, plan.primaryScripture]}
            title={plan.title}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-[var(--line)] bg-slate-50 p-3 lg:col-span-1">
                <h3 className="m-0 text-sm font-black text-slate-900">Context focus</h3>
                <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{plan.contextFocus}</p>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-slate-50 p-3 lg:col-span-1">
                <h3 className="m-0 text-sm font-black text-slate-900">Weekly rhythm</h3>
                <ul className="mb-0 mt-2 grid gap-1 pl-5 text-sm font-semibold leading-6 text-slate-600">
                  {plan.weeklyRhythm.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-slate-50 p-3 lg:col-span-1">
                <h3 className="m-0 text-sm font-black text-slate-900">Guardrails</h3>
                <ul className="mb-0 mt-2 grid gap-1 pl-5 text-sm font-semibold leading-6 text-slate-600">
                  {plan.guardrailNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ScriptureCard>
        ))}
      </section>
    </>
  );
}
