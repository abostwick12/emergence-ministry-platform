import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createGame, listGames } from "@/lib/games/store";
import type { TriviaGame } from "@/lib/games/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return NextResponse.json({ games: listGames(includeArchived) });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as Partial<TriviaGame>;
  return NextResponse.json({ game: createGame(body) }, { status: 201 });
}
