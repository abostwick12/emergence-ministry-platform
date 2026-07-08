import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { runGlooDiscussionDiagnostic } from "@/lib/scripture/gloo";
import { resolveStudentHubAccess } from "@/lib/student/access";

export async function POST() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  const role = access.session.user.role.trim().toLowerCase();
  if (role !== "admin" && role !== "leader") {
    return NextResponse.json({ ok: false, error: "Only leaders can run Gloo diagnostics." }, { status: 403 });
  }

  const diagnostic = await runGlooDiscussionDiagnostic();
  return NextResponse.json({ ok: true, diagnostic });
}
