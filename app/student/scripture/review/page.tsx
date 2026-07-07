import { getServerSession } from "@/lib/auth/server";
import { scriptureReviewQueue } from "@/lib/scripture/mock-data";

export default async function ScriptureReviewPage() {
  const session = await getServerSession();
  const role = session?.user.role?.trim().toLowerCase();

  if (role === "student") {
    return <StudentReviewExplainer />;
  }

  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Leader review</p>
          <h1 className="title">Scripture Review Queue</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            Mock drafts show how leaders can review student-created Scripture plans and studies for clarity, context, and
            theological care before anything is used with a group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill blue">Mock queue only</span>
          <span className="pill amber">No decisions are saved</span>
          <span className="pill green">Student-led, leader-reviewed</span>
        </div>
      </section>

      <section className="grid gap-4" aria-label="Mock Scripture drafts awaiting leader review">
        {scriptureReviewQueue.map((item) => (
          <article className="card grid gap-4" key={item.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid gap-2">
                <p className="eyebrow">{item.type}</p>
                <h2 className="m-0 text-2xl font-black leading-tight text-slate-950">{item.title}</h2>
                <p className="m-0 text-sm font-bold text-slate-600">
                  Submitted by {item.submittedBy} for {item.audience}
                </p>
              </div>
              <span className="pill blue w-fit">{item.status}</span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReviewDetail label="Primary Scripture" value={item.primaryScripture} />
              <ReviewDetail label="Metanarrative movement" value={item.movement} />
              <ReviewDetail label="Suggested next action" value={item.suggestedNextAction} />
            </dl>

            <div className="grid gap-2">
              <h3 className="m-0 text-base font-black text-slate-950">Theological guardrail flags</h3>
              <div className="flex flex-wrap gap-2">
                {item.guardrailFlags.map((flag) => (
                  <span className="pill" key={flag}>
                    {flag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-[var(--line)] bg-slate-50 p-4">
              <h3 className="m-0 text-base font-black text-slate-950">Leader notes</h3>
              <p className="mb-0 mt-2 text-sm font-semibold leading-6 text-slate-600">{item.leaderNotes}</p>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 text-sm font-bold text-slate-600">Mock actions only. No approval, request, or archive is saved.</p>
              <div className="flex flex-wrap gap-2">
                <button className="button" disabled type="button">
                  Approve
                </button>
                <button className="button" disabled type="button">
                  Request Changes
                </button>
                <button className="button" disabled type="button">
                  Archive
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function StudentReviewExplainer() {
  return (
    <>
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Leader review</p>
          <h1 className="title">Your Drafts Under Review</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            Leader review helps keep student-led studies faithful, clear, and useful for the whole group. This mock page does
            not send, save, or publish anything yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill blue">Preview only</span>
          <span className="pill amber">Review workflow coming later</span>
          <span className="pill green">Student-led does not mean unsupervised</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Student review guidance">
        <article className="card grid gap-2">
          <p className="eyebrow">Before review</p>
          <h2 className="m-0 text-xl font-black text-slate-950">Start with context</h2>
          <p className="m-0 text-sm font-semibold leading-6 text-slate-600">
            Show where the passage sits before asking what the group should do with it.
          </p>
        </article>
        <article className="card grid gap-2">
          <p className="eyebrow">During review</p>
          <h2 className="m-0 text-xl font-black text-slate-950">Invite careful feedback</h2>
          <p className="m-0 text-sm font-semibold leading-6 text-slate-600">
            A leader can help separate observation, interpretation, application, and creative connection.
          </p>
        </article>
        <article className="card grid gap-2">
          <p className="eyebrow">After review</p>
          <h2 className="m-0 text-xl font-black text-slate-950">Lead with humility</h2>
          <p className="m-0 text-sm font-semibold leading-6 text-slate-600">
            The goal is a faithful group conversation, not a perfect answer or a hidden meaning.
          </p>
        </article>
      </section>
    </>
  );
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <dt className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</dt>
      <dd className="m-0 mt-2 text-sm font-extrabold leading-6 text-slate-800">{value}</dd>
    </div>
  );
}
