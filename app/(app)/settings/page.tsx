import { EmmaAdminTestPanel } from "@/components/emma-admin-test-panel";
import { EmmaProposalReviewPanel } from "@/components/emma-proposal-review-panel";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getServerSession } from "@/lib/auth/server";

export default async function SettingsPage() {
  const session = await getServerSession();
  const isAdmin = session?.user.role === "admin";

  return (
    <div className="grid">
      <PlaceholderPage
        eyebrow="Settings"
        title="Platform Settings"
        description="MVP settings shell for configuration planning. API keys and secrets are not exposed in the UI."
        sections={[
          "User profile",
          "Roles and permissions",
          "Ministry areas",
          "Event types",
          "Locations",
          "Stub Mode integrations",
          "Future API connection settings"
        ]}
      />
      {isAdmin ? (
        <>
          <EmmaAdminTestPanel />
          <EmmaProposalReviewPanel />
        </>
      ) : null}
    </div>
  );
}
