import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getGame, upsertGame } from "@/lib/games/store";
import type { TriviaGame } from "@/lib/games/types";

export async function GET(_request: Request, { params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const game = getGame(params.gameId);
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  return NextResponse.json({ game });
}

export async function PATCH(request: Request, { params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as Partial<TriviaGame>;
  try {
    return NextResponse.json({ game: upsertGame(params.gameId, body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save game." }, { status: 400 });
  }
}
