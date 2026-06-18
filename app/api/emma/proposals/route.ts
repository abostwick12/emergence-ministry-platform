import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { listPendingEmmaProposalsForReview } from "@/lib/emma/approvals/review-proposal";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const result = await listPendingEmmaProposalsForReview(session);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Unable to load EMMA proposals safely." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, proposals: result.data });
}
