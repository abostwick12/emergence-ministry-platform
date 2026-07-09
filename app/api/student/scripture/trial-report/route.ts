import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { buildScriptureTrialReport } from "@/lib/scripture/trial-report";
import { getScriptureTrialInsights } from "@/lib/scripture/trial-insights";
import { resolveStudentHubAccess } from "@/lib/student/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  if (access.role === "student") {
    return NextResponse.json({ ok: false, error: "Only leaders can export trial reports." }, { status: 403 });
  }

  const state = await getStudentDiscussionWorkflowState(access.session);
  const insights = await getScriptureTrialInsights(access.session, state);
  const report = buildScriptureTrialReport(insights);

  return new NextResponse(report, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="lead-emergence-scripture-trial-report.md"`,
      "Content-Type": "text/markdown; charset=utf-8"
    }
  });
}
