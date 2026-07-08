import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentGroupLeaderState } from "@/lib/student/groups";

type ScriptureDiscussionWorkflowProps = {
  initialState: DiscussionWorkflowState;
  role: "admin" | "leader" | "student";
};

const emptyGroupState: StudentGroupLeaderState = {
  liveStorage: false,
  message: "Student invite links are managed from the Discipleship workspace.",
  groups: [],
  invites: [],
  members: []
};

export function ScriptureDiscussionWorkflow({ initialState, role }: ScriptureDiscussionWorkflowProps) {
  const canLead = role === "admin" || role === "leader";

  return (
    <div className="scripture-discussion">
      {canLead ? <ScriptureLeaderReview initialGroupState={emptyGroupState} initialState={initialState} /> : <StudentQuestionComposer readiness={initialState.readiness} />}
    </div>
  );
}
