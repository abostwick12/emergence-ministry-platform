import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import { getServerSession } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentScriptureQuestionsPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    return null;
  }

  const state = await getStudentDiscussionWorkflowState(access.session);

  return (
    <div className="student-ask-page">
      <StudentQuestionComposer readiness={state.readiness} />
      <section className="student-feed-section">
        <div className="student-feed-section-heading">
          <h2>Your recent questions</h2>
        </div>
        {state.prompts.length ? (
          <div className="student-feed-list">
            {state.prompts.slice(0, 5).map((prompt) => (
              <article className="student-feed-row" key={prompt.id}>
                <div>
                  <span>{prompt.scriptureReference || "No passage selected"}</span>
                  <h3>{prompt.question}</h3>
                  <p>{prompt.status === "pending_review" ? "Sent to your leader for review." : prompt.status.replace(/_/g, " ")}</p>
                </div>
                <span className="pill blue">{prompt.status === "pending_review" ? "With leader" : prompt.status.replace(/_/g, " ")}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-feed-empty">
            <strong>No questions sent yet.</strong>
            <p>When you send a real question, it will show here while your leader reviews it.</p>
          </div>
        )}
      </section>
    </div>
  );
}
