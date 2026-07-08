import { redirect } from "next/navigation";

import { ScriptureKnowledgeControlRoom } from "@/components/student/scripture-knowledge-control-room";
import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { getServerSession } from "@/lib/auth/server";
import { getKnowledgeControlRoomState } from "@/lib/scripture/knowledge-control-room";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { resolveStudentHubAccess } from "@/lib/student/access";
import { getStudentGroupLeaderState } from "@/lib/student/groups";

export default async function DiscipleshipPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    redirect(access.destination);
  }

  if (access.role === "student") {
    redirect("/student");
  }

  const state = await getStudentDiscussionWorkflowState(access.session);
  const groupState = await getStudentGroupLeaderState(access.session);
  const knowledgeState = await getKnowledgeControlRoomState(access.session);
  return (
    <div className="discipleship-workspace-stack">
      <ScriptureKnowledgeControlRoom initialState={knowledgeState} />
      <ScriptureLeaderReview initialGroupState={groupState} initialState={state} />
    </div>
  );
}
