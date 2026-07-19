import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { disconnectPlanningCenter, getPlanningCenterStatus, redactProviderError } from "@/lib/integrations/planning-center/repository";

export async function POST() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    await disconnectPlanningCenter(access.session);
    return NextResponse.json(await getPlanningCenterStatus(access.session));
  } catch (error) {
    return NextResponse.json({ error: redactProviderError(error) }, { status: 503 });
  }
}
