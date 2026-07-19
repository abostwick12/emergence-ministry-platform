import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import {
  PlanningCenterConnectionExpiredError,
  PlanningCenterConnectionInvalidError,
  PlanningCenterNotConnectedError,
  getPlanningCenterStatus,
  redactProviderError,
  syncPlanningCenterReferences
} from "@/lib/integrations/planning-center/repository";

function statusFor(error: unknown) {
  if (
    error instanceof PlanningCenterNotConnectedError ||
    error instanceof PlanningCenterConnectionInvalidError ||
    error instanceof PlanningCenterConnectionExpiredError
  ) {
    return 409;
  }
  return 502;
}

export async function POST() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    const result = await syncPlanningCenterReferences(access.session);
    const status = await getPlanningCenterStatus(access.session);
    return NextResponse.json({ result, status });
  } catch (error) {
    return NextResponse.json({ error: redactProviderError(error) }, { status: statusFor(error) });
  }
}
