import { StudentQuestionsExperience } from "@/components/student/student-questions-experience";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
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
    <>
      <StudentScriptureTabs active="questions" />
      <StudentQuestionsExperience initialState={state} />
    </>
  );
}
