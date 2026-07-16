import MinistryWorkspace from "@/components/ministry-workspace";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getDashboardPayload } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) {
    return <MinistryWorkspace view="dashboard" initialLoadError="Ministry workspace access could not be verified." />;
  }
  const payload = await getDashboardPayload(access.session);
  return <MinistryWorkspace view="dashboard" initialOverview={payload.overview} initialAttention={payload.attention} />;
}
