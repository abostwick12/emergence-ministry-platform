import { notFound, redirect } from "next/navigation";
import { GameBuilder } from "@/components/games/game-builder";
import { getServerSession } from "@/lib/auth/server";
import { getGame } from "@/lib/games/store";

export default async function EditGamePage({ params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const game = getGame(params.gameId);
  if (!game) notFound();

  return <GameBuilder initialGame={game} />;
}
