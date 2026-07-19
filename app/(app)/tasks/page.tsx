import MinistryWorkspace from "@/components/ministry-workspace";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { canPlatformUserSaveChanges } from "@/lib/platform/access-admin";

export default async function TasksPage() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return <MinistryWorkspace view="tasks" initialLoadError="Ministry workspace access could not be verified." />;
  return <MinistryWorkspace view="tasks" canSaveChanges={access.session.isGuest || await canPlatformUserSaveChanges(access.session)} />;
}
