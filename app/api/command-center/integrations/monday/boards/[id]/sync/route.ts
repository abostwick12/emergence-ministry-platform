import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { syncMondayBoardTasks, updateIntegration } from "@/lib/command-center/repository";
import { MondayConfigError } from "@/lib/command-center/integrations/monday";
import type { PersonalDomain } from "@/lib/command-center/types";

const VALID_DOMAINS: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

// Monday.com -> Command Center only, Andrew-triggered, one board at a time.
// Imports each board item as a personal_task at most once (deduped by
// mondayItemId in syncMondayBoardTasks) -- personal_tasks are never written
// back to Monday.com, and there is still no mutation call anywhere in
// lib/command-center/integrations/monday.ts.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json().catch(() => null)) as { domain?: string } | null;
  if (!body?.domain || !VALID_DOMAINS.includes(body.domain as PersonalDomain)) {
    return NextResponse.json({ error: "A valid domain is required." }, { status: 400 });
  }

  try {
    const result = await syncMondayBoardTasks(access.session, { boardId: params.id, domain: body.domain as PersonalDomain });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MondayConfigError) {
      return NextResponse.json({ error: "Monday.com is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "monday", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to sync tasks from this Monday.com board." }, { status: 502 });
  }
}
