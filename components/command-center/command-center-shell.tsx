import type { ReactNode } from "react";
import { CommandCenterHeader } from "@/components/command-center/command-center-header";
import { CommandCenterSidebar } from "@/components/command-center/command-center-sidebar";
import { CommandCenterMobileNavProvider, CommandCenterSidebarBackdrop } from "@/components/command-center/command-center-mobile-nav";
import { QuickCaptureButton } from "@/components/command-center/quick-capture-button";
import { getServerSession } from "@/lib/auth/server";
import { isDevAuthActive, isSupabaseConfigured } from "@/lib/auth/config";
import { getOverview, listIntegrations } from "@/lib/command-center/repository";
import { INTEGRATION_CATALOG } from "@/lib/command-center/integrations-meta";

// Scoped to the Command Center shell only; never affects the rest of the app's typography.
export async function CommandCenterShell({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) return null;

  const [overview, integrations] = await Promise.all([getOverview(session), listIntegrations(session)]);
  const connectedCount = integrations.filter((integration) => integration.status === "connected").length;
  const notificationCount = overview.unprocessedCaptureCount + overview.jobFollowUpsDueCount;

  return (
    <div className="command-center-shell">
      <CommandCenterMobileNavProvider>
        <CommandCenterSidebar connectedCount={connectedCount} totalCount={INTEGRATION_CATALOG.length} />
        <CommandCenterSidebarBackdrop />
        <div className="cc-main">
          <CommandCenterHeader
            fullName={session.user.fullName}
            devAuth={isDevAuthActive()}
            stubMode={!isSupabaseConfigured()}
            notificationCount={notificationCount}
          />
          {children}
        </div>
      </CommandCenterMobileNavProvider>
      <QuickCaptureButton />
    </div>
  );
}
