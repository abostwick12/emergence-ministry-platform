import { redirect } from "next/navigation";

import { StudentShell } from "@/components/student/student-shell";
import { getServerSession } from "@/lib/auth/server";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    redirect(access.destination);
  }

  return (
    <StudentShell user={{ name: access.session.user.fullName, role: access.role }}>
      {children}
    </StudentShell>
  );
}
