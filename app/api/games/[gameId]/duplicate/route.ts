import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { duplicateGame } from "@/lib/games/store";

export async function POST(_request: Request, { params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    return NextResponse.json({ game: duplicateGame(params.gameId) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not duplicate game." }, { status: 400 });
  }
}
