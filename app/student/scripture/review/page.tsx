import { ScriptureDiscussionWorkflow } from "@/components/student/scripture-discussion-workflow";
import { getServerSession } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function ScriptureReviewPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    return null;
  }

  if (access.role === "student") {
    return (
      <section className="panel grid gap-4 bg-white">
        <div className="grid gap-2">
          <p className="eyebrow">Leader review</p>
          <h1 className="title">Your questions are reviewed before group discussion.</h1>
          <p className="m-0 max-w-3xl text-base font-semibold leading-7 text-slate-600">
            Students can submit real questions from the Small Group Questions page. Leaders review the generated discussion
            draft, request changes, approve it, and only then post it to the configured group channel.
          </p>
        </div>
        <a className="button primary w-fit" href="/student/scripture/questions">
          Open Small Group Questions
        </a>
      </section>
    );
  }

  const state = await getStudentDiscussionWorkflowState(access.session);

  return <ScriptureDiscussionWorkflow initialState={state} role={access.role} />;
}
