import { redirect } from "next/navigation";
import { GameBuilder } from "@/components/games/game-builder";
import { getServerSession } from "@/lib/auth/server";
import { createGame } from "@/lib/games/store";

export default async function NewGamePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const game = createGame({
    title: "Untitled Team Trivia Game",
    description: "New team trivia game",
    status: "draft"
  });

  return <GameBuilder initialGame={game} />;
}
