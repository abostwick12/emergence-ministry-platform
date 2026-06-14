import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { archiveGame } from "@/lib/games/store";

export async function POST(_request: Request, { params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    return NextResponse.json({ game: archiveGame(params.gameId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not archive game." }, { status: 400 });
  }
}
