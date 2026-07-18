import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { isDevAuthActive } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/server";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { resolvePageAccessForSession, visiblePlatformPagesForSession } from "@/lib/platform/access-admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Server-only check: pass a non-sensitive boolean to the client shell so it
  // can show the DEV AUTH badge without ever importing the controlling env var.
  const devAuth = isDevAuthActive();
  const session = await getServerSession();
  if (!session) redirect("/login");
  const pathname = headers().get("x-lead-emergence-pathname") ?? "/dashboard";
  if (!(await resolvePageAccessForSession(session, pathname))) redirect(session.isGuest ? "/" : "/dashboard");
  const normalizedRole = session.user.role.trim().toLowerCase();
  if (!session.isGuest && normalizedRole === "student") redirect("/student");
  if (normalizedRole === "parent") redirect("/parent");
  const shellAccess = { kind: "full" as const };
  const sessionRole = session.user.role === "leader" || session.user.role === "student" || session.user.role === "parent" ? session.user.role : session.isGuest ? "leader" : "admin";
  const visiblePageKeys = await visiblePlatformPagesForSession(session);

  return (
    <RoleProvider initialRole={sessionRole}>
      <EventCardProvider>
        <AppShell
          canManageEvents={sessionRole === "admin" || sessionRole === "leader"}
          devAuth={devAuth}
          shellAccess={shellAccess}
          sessionRole={sessionRole}
          showCommandCenter={!session.isGuest && isCommandCenterUser(session)}
          showLeaderDiscipleship={visiblePageKeys.includes("discipleship")}
          showStudentPortal={visiblePageKeys.includes("student_portal")}
          visiblePageKeys={visiblePageKeys}
          user={{ name: session.user.fullName, email: session.user.email }}
        >
          {children}
        </AppShell>
        <MasterEventCard />
      </EventCardProvider>
    </RoleProvider>
  );
}
