import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createSession, getSnapshot } from "@/lib/games/store";

export async function POST(_request: Request, { params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const gameSession = createSession(params.gameId);
    return NextResponse.json({ snapshot: getSnapshot(gameSession.id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start session." }, { status: 400 });
  }
}
