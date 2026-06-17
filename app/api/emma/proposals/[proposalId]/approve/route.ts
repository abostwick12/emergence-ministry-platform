import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { decideEmmaProposal } from "@/lib/emma/approvals/review-proposal";

export async function POST(_request: Request, { params }: { params: { proposalId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const result = await decideEmmaProposal(session, { proposalId: params.proposalId, decision: "approved" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Unable to review EMMA proposal safely." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}
