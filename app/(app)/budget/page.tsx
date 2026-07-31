import { MinistryBudgetPage } from "@/components/ministry-launch-pages";
import { getServerSession } from "@/lib/auth/server";
import { canPlatformUserSaveChanges } from "@/lib/platform/access-admin";

export default async function BudgetPage() {
  const session = await getServerSession();
  return <MinistryBudgetPage readOnly={!session || !(await canPlatformUserSaveChanges(session))} />;
}
