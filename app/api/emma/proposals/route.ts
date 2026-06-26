import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { listPendingEmmaProposalsForReview } from "@/lib/emma/approvals/review-proposal";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const result = await listPendingEmmaProposalsForReview(access.session);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Unable to load EMMA proposals safely." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, proposals: result.data });
}
