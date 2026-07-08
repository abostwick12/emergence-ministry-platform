import { redirect } from "next/navigation";

import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { getServerSession } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function ScriptureReviewPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    return null;
  }

  if (access.role === "student") {
    redirect("/student");
  }

  const state = await getStudentDiscussionWorkflowState(access.session);

  return <ScriptureLeaderReview initialState={state} />;
}
