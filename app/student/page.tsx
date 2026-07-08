import { StudentHomeFeed } from "@/components/student/student-home-feed";
import { getServerSession } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { buildStudentHomeFeed } from "@/lib/scripture/student-home";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentPortalPage() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return null;

  const state = await getStudentDiscussionWorkflowState(access.session);
  const feed = buildStudentHomeFeed(state.prompts, access.session.user.id);

  return <StudentHomeFeed initialFeed={feed} initialState={state} userName={access.session.user.fullName} />;
}
