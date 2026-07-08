import type { ReactNode } from "react";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { CommandCenterHeader } from "@/components/command-center/command-center-header";
import { CommandCenterSidebar } from "@/components/command-center/command-center-sidebar";
import { QuickCaptureButton } from "@/components/command-center/quick-capture-button";
import { getServerSession } from "@/lib/auth/server";
import { isDevAuthActive, isSupabaseConfigured } from "@/lib/auth/config";
import { getOverview, listIntegrations } from "@/lib/command-center/repository";
import { INTEGRATION_CATALOG } from "@/lib/command-center/integrations-meta";

// Scoped to the Command Center shell only (see the `variable` classNames
// applied below) — never affects the rest of the app's typography.
const sans = Inter({ subsets: ["latin"], variable: "--font-cc-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-cc-mono" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-cc-serif", weight: ["500", "600"] });

export async function CommandCenterShell({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) return null;

  const [overview, integrations] = await Promise.all([getOverview(session), listIntegrations(session)]);
  const connectedCount = integrations.filter((integration) => integration.status === "connected").length;
  const notificationCount = overview.unprocessedCaptureCount + overview.jobFollowUpsDueCount;

  return (
    <div className={`command-center-shell ${sans.variable} ${mono.variable} ${serif.variable}`}>
      <CommandCenterSidebar connectedCount={connectedCount} totalCount={INTEGRATION_CATALOG.length} />
      <div className="cc-main">
        <CommandCenterHeader
          fullName={session.user.fullName}
          devAuth={isDevAuthActive()}
          stubMode={!isSupabaseConfigured()}
          notificationCount={notificationCount}
        />
        {children}
      </div>
      <QuickCaptureButton />
    </div>
  );
}
