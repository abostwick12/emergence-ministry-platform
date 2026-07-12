import Link from "next/link";

import { StudentReadingPlanNavigator } from "@/components/student/student-reading-plan-navigator";
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

      <StudentReadingPlanNavigator plans={scripturePlans} />
    </>
  );
}
