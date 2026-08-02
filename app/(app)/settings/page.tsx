import { EmmaAdminTestPanel } from "@/components/emma-admin-test-panel";
import { EmmaProposalReviewPanel } from "@/components/emma-proposal-review-panel";
import { MinistrySettingsPage } from "@/components/ministry-launch-pages";
import { MeridianPersonalAiPanel } from "@/components/meridian-personal-ai-panel";
import { WebsiteAccessPanel } from "@/components/website-access-panel";
import { getServerSession } from "@/lib/auth/server";

export default async function SettingsPage() {
  const session = await getServerSession();
  const isAdmin = session?.user.role === "admin";

  return (
    <div className="grid">
      <MinistrySettingsPage
        user={
          session
            ? {
                fullName: session.user.fullName,
                email: session.user.email,
                role: session.user.role
              }
            : null
        }
      />
      <MeridianPersonalAiPanel canManage={isAdmin} />
      <WebsiteAccessPanel canManagePlatformAccess={isAdmin} />
      {isAdmin ? (
        <details className="settings-admin-diagnostics">
          <summary>Advanced EMMA review and diagnostics</summary>
          <div>
            <EmmaAdminTestPanel />
            <EmmaProposalReviewPanel />
          </div>
        </details>
      ) : null}
    </div>
  );
}
