import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { RoleProvider } from "@/components/role-context";
import { getServerSession } from "@/lib/auth/server";
import { isDevAuthActive } from "@/lib/auth/config";
import { resolveAppShellAccess } from "@/lib/camp/shell-access";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { resolvePageAccessForSession, visiblePlatformPagesForSession } from "@/lib/platform/access-admin";
import { resolveStudentHubAccess } from "@/lib/student/access";
import { headers } from "next/headers";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const devAuth = isDevAuthActive();
  const session = await getServerSession();

  if (session?.isGuest) {
    const pathname = headers().get("x-lead-emergence-pathname") ?? "/student";
    if (!(await resolvePageAccessForSession(session, pathname))) redirect("/");
    const visiblePageKeys = await visiblePlatformPagesForSession(session);
    return (
      <RoleProvider initialRole="student">
        <EventCardProvider>
          <AppShell
            canManageEvents={false}
            devAuth={devAuth}
            shellAccess={{ kind: "full" }}
            sessionRole="student"
            showCommandCenter={false}
            showLeaderDiscipleship={visiblePageKeys.includes("discipleship")}
            showStudentPortal
            visiblePageKeys={visiblePageKeys}
            user={{ name: session.user.fullName, email: session.user.email }}
          >
            {children}
          </AppShell>
        </EventCardProvider>
      </RoleProvider>
    );
  }

  const access = resolveStudentHubAccess(session);

  if (!access.allowed) {
    redirect(access.destination);
  }

  const isStudentSession = access.role === "student";
  const canManageEvents = access.role === "admin" || access.role === "leader";
  const shellAccess = isStudentSession || access.session.isMock ? { kind: "full" as const } : await resolveAppShellAccess(access.session);
  const visiblePageKeys = await visiblePlatformPagesForSession(access.session);

  return (
    <RoleProvider initialRole={access.role}>
      <EventCardProvider>
        <AppShell
          canManageEvents={canManageEvents}
          devAuth={devAuth}
          shellAccess={shellAccess}
          sessionRole={access.role}
          showCommandCenter={!isStudentSession && isCommandCenterUser(access.session)}
          showLeaderDiscipleship={visiblePageKeys.includes("discipleship")}
          showStudentPortal
          visiblePageKeys={visiblePageKeys}
          user={{ name: access.session.user.fullName, email: access.session.user.email }}
        >
          {children}
        </AppShell>
        {canManageEvents ? <MasterEventCard /> : null}
      </EventCardProvider>
    </RoleProvider>
  );
}
