import { redirect } from "next/navigation";
import { GamesLibrary } from "@/components/games/games-library";
import { getServerSession } from "@/lib/auth/server";
import { listGames } from "@/lib/games/store";

export default async function GamesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <GamesLibrary initialGames={listGames()} />;
}
