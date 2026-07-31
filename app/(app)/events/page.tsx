import MinistryWorkspace from "@/components/ministry-workspace";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getOverview } from "@/lib/data/ministry-repository";
import { canPlatformUserSaveChanges } from "@/lib/platform/access-admin";

export default async function EventsPage() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) {
    return <MinistryWorkspace view="events" initialLoadError="Ministry workspace access could not be verified." />;
  }
  return <MinistryWorkspace view="events" initialOverview={await getOverview(access.session)} canSaveChanges={await canPlatformUserSaveChanges(access.session)} />;
}
