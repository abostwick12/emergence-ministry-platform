import { NextResponse } from "next/server";

import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getOverview } from "@/lib/data/ministry-repository";
import { getMinistryEmmaReadiness, runMinistryPageServerChat } from "@/lib/emma/ministry-page-server-chat";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json({
    ok: true,
    readiness: getMinistryEmmaReadiness({ session: access.session })
  });
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const overview = await getOverview(access.session);
  const result = await runMinistryPageServerChat({
    overview,
    rawInput: body,
    session: access.session
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "EMMA chat failed safely." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...result.data,
    readiness: getMinistryEmmaReadiness({ session: access.session })
  });
}
