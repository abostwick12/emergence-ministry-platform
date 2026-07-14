import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import {
  buildPlanningCenterAuthUrl,
  PlanningCenterConfigError,
  PLANNING_CENTER_OAUTH_STATE_COOKIE
} from "@/lib/integrations/planning-center/client";
import { PlanningCenterStorageUnavailableError, getPlanningCenterStatus } from "@/lib/integrations/planning-center/repository";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const current = await getPlanningCenterStatus(access.session);
  if (!current.storageConfigured) {
    return NextResponse.json({ error: new PlanningCenterStorageUnavailableError().message }, { status: 503 });
  }

  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(buildPlanningCenterAuthUrl({ state }));
    response.cookies.set(PLANNING_CENTER_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/planning-center",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof PlanningCenterConfigError) {
      return NextResponse.json({ error: "Planning Center is not configured yet.", missing: error.missing }, { status: 503 });
    }
    throw error;
  }
}
