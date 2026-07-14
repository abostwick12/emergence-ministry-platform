import { NextResponse } from "next/server";

import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getOverview } from "@/lib/data/ministry-repository";
import { createMinistryPageProposal } from "@/lib/emma/proposals/create-page-proposal";

export async function POST(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const overview = await getOverview(access.session);
  const result = await createMinistryPageProposal({
    overview,
    rawInput: body,
    session: access.session
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Unable to create EMMA page proposal safely." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    proposalCreated: result.data.proposalCreated,
    proposalId: result.data.proposalId,
    requestId: result.data.requestId,
    runId: result.data.runId,
    summary: result.data.summary,
    executed: false
  });
}
