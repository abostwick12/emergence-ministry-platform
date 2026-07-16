import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { isDevAuthActive } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/server";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { resolveAppShellAccess } from "@/lib/camp/shell-access";
import { canAccessStudentHub } from "@/lib/student/access";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Server-only check: pass a non-sensitive boolean to the client shell so it
  // can show the DEV AUTH badge without ever importing the controlling env var.
  const devAuth = isDevAuthActive();
  const session = await getServerSession();
  if (!session) redirect("/login");
  const normalizedRole = session.user.role.trim().toLowerCase();
  if (normalizedRole === "student") redirect("/student");
  if (normalizedRole === "parent") redirect("/parent");
  const shellAccess = session.isMock ? { kind: "full" as const } : await resolveAppShellAccess(session);
  const sessionRole = session.user.role === "leader" || session.user.role === "student" || session.user.role === "parent" ? session.user.role : "admin";

  return (
    <RoleProvider initialRole={sessionRole}>
      <EventCardProvider>
        <AppShell
          canManageEvents={sessionRole === "admin" || sessionRole === "leader"}
          devAuth={devAuth}
          shellAccess={shellAccess}
          sessionRole={sessionRole}
          showCommandCenter={isCommandCenterUser(session)}
          showLeaderDiscipleship={session.user.role === "admin" || session.user.role === "leader"}
          showStudentPortal={canAccessStudentHub(session.user.role)}
          user={{ name: session.user.fullName, email: session.user.email }}
        >
          {children}
        </AppShell>
        <MasterEventCard />
      </EventCardProvider>
    </RoleProvider>
  );
}
