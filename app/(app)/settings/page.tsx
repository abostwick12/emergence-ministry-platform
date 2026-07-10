import { CampAccessAdminPanel } from "@/components/camp/camp-access-admin";
import { EmmaAdminTestPanel } from "@/components/emma-admin-test-panel";
import { EmmaProposalReviewPanel } from "@/components/emma-proposal-review-panel";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getServerSession } from "@/lib/auth/server";
import { isCampAccessAdmin } from "@/lib/camp/access-admin";

export default async function SettingsPage() {
  const session = await getServerSession();
  const isAdmin = session?.user.role === "admin";
  const canManageCampAccess = session ? await isCampAccessAdmin(session) : false;

  return (
    <div className="grid">
      <PlaceholderPage
        eyebrow="Settings"
        title="Platform Settings"
        description="Configuration planning for profile, roles, ministry defaults, event setup, and provider readiness. Secrets are never exposed in the UI."
        sections={[
          "User profile",
          "Roles and permissions",
          "Ministry areas",
          "Event types",
          "Locations",
          "Preview integration adapters",
          "Future API connection settings"
        ]}
      />
      {canManageCampAccess ? <CampAccessAdminPanel /> : null}
      {isAdmin ? (
        <>
          <EmmaAdminTestPanel />
          <EmmaProposalReviewPanel />
        </>
      ) : null}
    </div>
  );
}
