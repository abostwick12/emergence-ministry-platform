import { CampAccessAdminPanel } from "@/components/camp/camp-access-admin";
import { EmmaAdminTestPanel } from "@/components/emma-admin-test-panel";
import { EmmaProposalReviewPanel } from "@/components/emma-proposal-review-panel";
import { MinistrySettingsPage } from "@/components/ministry-launch-pages";
import { getServerSession } from "@/lib/auth/server";
import { isCampAccessAdmin } from "@/lib/camp/access-admin";

export default async function SettingsPage() {
  const session = await getServerSession();
  const isAdmin = session?.user.role === "admin";
  const canManageCampAccess = session ? await isCampAccessAdmin(session) : false;

  return (
    <div className="grid">
      <MinistrySettingsPage
        canManageCampAccess={canManageCampAccess}
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
