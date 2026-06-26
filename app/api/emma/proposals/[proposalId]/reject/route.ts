import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { decideEmmaProposal } from "@/lib/emma/approvals/review-proposal";

export async function POST(_request: Request, { params }: { params: { proposalId: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const result = await decideEmmaProposal(access.session, { proposalId: params.proposalId, decision: "rejected" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Unable to review EMMA proposal safely." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}
