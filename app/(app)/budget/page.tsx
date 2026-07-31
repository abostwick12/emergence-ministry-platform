import { MinistryBudgetPage } from "@/components/ministry-launch-pages";
import { getServerSession } from "@/lib/auth/server";

export default async function BudgetPage() {
  const session = await getServerSession();
  return <MinistryBudgetPage readOnly={Boolean(session?.isGuest)} />;
}
