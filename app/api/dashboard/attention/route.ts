import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { buildDashboardAttention } from "@/lib/dashboard-attention";
import { getOverview } from "@/lib/data/ministry-repository";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const overview = await getOverview(access.session);
  const role = access.session.user.role.trim().toLowerCase();
  let discussion = null;

  if (role === "admin" || role === "administrator" || role === "leader") {
    try {
      discussion = await getStudentDiscussionWorkflowState(access.session);
    } catch (error) {
      console.warn("[dashboard] student-care attention unavailable", {
        reason: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  return NextResponse.json(buildDashboardAttention(overview, discussion), {
    headers: { "Cache-Control": "no-store" }
  });
}
