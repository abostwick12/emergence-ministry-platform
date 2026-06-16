import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";
import { isDevAuthActive } from "@/lib/auth/config";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Server-only check: pass a non-sensitive boolean to the client shell so it
  // can show the DEV AUTH badge without ever importing the controlling env var.
  const devAuth = isDevAuthActive();

  return (
    <RoleProvider>
      <EventCardProvider>
        <AppShell devAuth={devAuth}>{children}</AppShell>
        <MasterEventCard />
      </EventCardProvider>
    </RoleProvider>
  );
}
