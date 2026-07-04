import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { isDevAuthActive } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/server";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { resolveAppShellAccess } from "@/lib/camp/shell-access";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Server-only check: pass a non-sensitive boolean to the client shell so it
  // can show the DEV AUTH badge without ever importing the controlling env var.
  const devAuth = isDevAuthActive();
  const session = await getServerSession();
  if (!session) redirect("/login");
  const shellAccess = await resolveAppShellAccess(session);

  return (
    <RoleProvider>
      <EventCardProvider>
        <AppShell
          devAuth={devAuth}
          shellAccess={shellAccess}
          showCommandCenter={isCommandCenterUser(session)}
          user={{ name: session.user.fullName, email: session.user.email }}
        >
          {children}
        </AppShell>
        <MasterEventCard />
      </EventCardProvider>
    </RoleProvider>
  );
}
