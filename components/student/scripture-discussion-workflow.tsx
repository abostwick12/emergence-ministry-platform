import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";

type ScriptureDiscussionWorkflowProps = {
  initialState: DiscussionWorkflowState;
  role: "admin" | "leader" | "student";
};

export function ScriptureDiscussionWorkflow({ initialState, role }: ScriptureDiscussionWorkflowProps) {
  const canLead = role === "admin" || role === "leader";

  return (
    <div className="scripture-discussion">{canLead ? <ScriptureLeaderReview initialState={initialState} /> : <StudentQuestionComposer readiness={initialState.readiness} />}</div>
  );
}
