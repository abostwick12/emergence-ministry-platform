import { HowToReadPath } from "@/components/student/how-to-read-path";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { getServerSession } from "@/lib/auth/server";
import { howToReadModules } from "@/lib/scripture/how-to-read";
import { getStudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentHowToReadPage() {
  const access = resolveStudentHubAccess(await getServerSession());
  const progress = access.allowed ? await getStudentHowToReadProgress(access.session) : undefined;

  return (
    <>
      <StudentScriptureTabs active="how-to-read" />
      <HowToReadPath initialCompletedModuleIds={progress?.completedModuleIds ?? []} initialProgressStorage={progress?.storage ?? "unavailable"} modules={howToReadModules} />
    </>
  );
}
