import type { AuthSession } from "@/lib/auth/server";
import { buildDashboardAttention, type DashboardAttention } from "@/lib/dashboard-attention";
import { getOverview, type MinistryOverview } from "@/lib/data/ministry-repository";
import { measureServerOperation } from "@/lib/performance/timing";
import { getStudentCareDiscussionState } from "@/lib/scripture/discussion-workflow";

export type DashboardPayload = {
  overview: MinistryOverview;
  attention: DashboardAttention;
};

export async function getDashboardPayload(session: AuthSession): Promise<DashboardPayload> {
  return measureServerOperation("dashboard.payload", async () => {
    const role = session.user.role.trim().toLowerCase();
    const canReviewStudentCare = role === "admin" || role === "administrator" || role === "leader";
    const [overview, discussion] = await Promise.all([
      getOverview(session),
      canReviewStudentCare ? loadStudentCare(session) : Promise.resolve(null)
    ]);
    return { overview, attention: buildDashboardAttention(overview, discussion) };
  });
}

async function loadStudentCare(session: AuthSession) {
  try {
    return await getStudentCareDiscussionState(session);
  } catch (error) {
    console.warn("[dashboard] student-care attention unavailable", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return null;
  }
}
