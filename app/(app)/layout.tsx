import { AppShell } from "@/components/app-shell";
import { RoleProvider } from "@/components/role-context";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
