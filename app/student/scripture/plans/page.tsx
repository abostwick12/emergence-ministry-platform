import Link from "next/link";

import { ScriptureCard } from "@/components/student/scripture-card";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { scripturePlans } from "@/lib/scripture/mock-data";

export default function ScripturePlansPage() {
  return (
    <>
      <StudentScriptureTabs active="plans" />
      <section className="panel grid gap-4 scripture-plan-intro">
        <div className="toolbar split">
          <div className="grid gap-2">
            <p className="eyebrow">Reading Plans</p>
            <h1 className="title">Example reading plans for whole-Scripture familiarity.</h1>
            <p className="scripture-plan-copy">
              These plans are sample resources only. They do not call a Bible API, assume Bible text licensing, link accounts,
              or save student progress.
            </p>
          </div>
          <Link className="button primary" href="/student/scripture/plans/new">
            New Reading Plan
          </Link>
        </div>
      </section>

      <section className="grid gap-4" aria-label="Example reading plans">
        {scripturePlans.map((plan) => (
          <ScriptureCard
            description={plan.summary}
            eyebrow="Reading plan"
            key={plan.id}
            meta={[plan.audience, plan.duration, plan.primaryScripture]}
            title={plan.title}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="scripture-plan-detail">
                <h3>Context focus</h3>
                <p>{plan.contextFocus}</p>
              </div>
              <div className="scripture-plan-detail">
                <h3>Weekly rhythm</h3>
                <ul>
                  {plan.weeklyRhythm.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="scripture-plan-detail">
                <h3>Guardrails</h3>
                <ul>
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
