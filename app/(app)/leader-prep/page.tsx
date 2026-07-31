import { LeaderPreparationPage } from "@/components/leader-preparation-page";
import { getServerSession } from "@/lib/auth/server";

export default async function LeaderPrepPage() {
  const session = await getServerSession();
  return <LeaderPreparationPage readOnly={Boolean(session?.isGuest)} />;
}
