import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { listMondayBoardItems, MondayConfigError } from "@/lib/command-center/integrations/monday";

// Read-only. Lists the items (tasks) inside one board, including each
// item's column values. There is no write/sync route anywhere in this
// integration yet.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const items = await listMondayBoardItems({ boardId: params.id });
    await updateIntegration(access.session, "monday", { status: "connected", config: {} });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof MondayConfigError) {
      return NextResponse.json({ error: "Monday.com is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "monday", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to list items for this Monday.com board." }, { status: 502 });
  }
}
