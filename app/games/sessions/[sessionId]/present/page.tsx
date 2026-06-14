import { notFound, redirect } from "next/navigation";
import { PresentationScreen } from "@/components/games/presentation-screen";
import { getServerSession } from "@/lib/auth/server";
import { getSnapshot } from "@/lib/games/store";

export default async function PresentSessionPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  try {
    return <PresentationScreen initialSnapshot={getSnapshot(params.sessionId)} />;
  } catch {
    notFound();
  }
}
