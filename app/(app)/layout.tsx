import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";
import { EventCardProvider } from "@/components/event-card-context";
import { MasterEventCard } from "@/components/master-event-card";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <EventCardProvider>
        <AppShell>{children}</AppShell>
        <MasterEventCard />
      </EventCardProvider>
    </RoleProvider>
  );
}
