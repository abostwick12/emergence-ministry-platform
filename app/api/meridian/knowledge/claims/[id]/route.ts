import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { SupabaseMeridianMcpRepository } from "@/lib/meridian/mcp/repository";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  const repository = new SupabaseMeridianMcpRepository();
  try {
    await repository.requireGrant(session, "search");
    const item = await repository.fetch(session, params.id);
    if (!item) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MeridianMcpError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "meridian_fetch_failed" }, { status: 500 });
  }
}
