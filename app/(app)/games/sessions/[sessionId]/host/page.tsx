import { notFound, redirect } from "next/navigation";
import { HostConsole } from "@/components/games/host-console";
import { getServerSession } from "@/lib/auth/server";
import { getSnapshot } from "@/lib/games/store";

export default async function HostSessionPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  try {
    return <HostConsole initialSnapshot={getSnapshot(params.sessionId)} />;
  } catch {
    notFound();
  }
}
