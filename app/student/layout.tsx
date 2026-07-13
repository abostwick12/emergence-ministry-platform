import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { RoleProvider } from "@/components/role-context";
import { getServerSession } from "@/lib/auth/server";
import { isDevAuthActive } from "@/lib/auth/config";
import { resolveAppShellAccess } from "@/lib/camp/shell-access";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const devAuth = isDevAuthActive();
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    redirect(access.destination);
  }

  const isStudentSession = access.role === "student";
  const canManageEvents = access.role === "admin" || access.role === "leader";
  const shellAccess = isStudentSession ? { kind: "full" as const } : await resolveAppShellAccess(access.session);

  return (
    <RoleProvider initialRole={access.role}>
      <EventCardProvider>
        <AppShell
          canManageEvents={canManageEvents}
          devAuth={devAuth}
          shellAccess={shellAccess}
          sessionRole={access.role}
          showCommandCenter={!isStudentSession && isCommandCenterUser(access.session)}
          showLeaderDiscipleship={canManageEvents}
          showStudentPortal
          user={{ name: access.session.user.fullName, email: access.session.user.email }}
        >
          {children}
        </AppShell>
        {canManageEvents ? <MasterEventCard /> : null}
      </EventCardProvider>
    </RoleProvider>
  );
}
