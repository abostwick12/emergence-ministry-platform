import { HowToReadPath } from "@/components/student/how-to-read-path";
import { StudentScriptureTabs } from "@/components/student/student-scripture-tabs";
import { howToReadModules } from "@/lib/scripture/how-to-read";

export default function StudentHowToReadPage() {
  return (
    <>
      <StudentScriptureTabs active="how-to-read" />
      <HowToReadPath modules={howToReadModules} />
    </>
  );
}
