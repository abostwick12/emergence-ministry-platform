import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { listMondayBoards, MondayConfigError } from "@/lib/command-center/integrations/monday";

// Read-only. Lists Andrew's boards to confirm the token works; there is no
// write/sync route anywhere in this integration yet.
export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const boards = await listMondayBoards({});
    await updateIntegration(access.session, "monday", { status: "connected", config: {} });
    return NextResponse.json({ boards });
  } catch (error) {
    if (error instanceof MondayConfigError) {
      return NextResponse.json({ error: "Monday.com is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "monday", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to list Monday.com boards." }, { status: 502 });
  }
}
