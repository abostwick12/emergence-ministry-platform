import { StudentQuestionsExperience } from "@/components/student/student-questions-experience";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { getServerSession } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { getStudentQuestionReflections } from "@/lib/scripture/student-reflections";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentScriptureQuestionsPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    return null;
  }

  const state = await getStudentDiscussionWorkflowState(access.session);
  const promptIds = state.prompts
    .filter((prompt) => prompt.submittedByUserId === access.session.user.id)
    .slice(0, 5)
    .map((prompt) => prompt.id);
  const reflections = await getStudentQuestionReflections(access.session, promptIds);

  return (
    <>
      <StudentScriptureTabs active="questions" />
      <StudentQuestionsExperience initialReflections={reflections} initialState={state} />
    </>
  );
}
