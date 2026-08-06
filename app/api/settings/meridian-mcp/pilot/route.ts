import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, getSupabaseAuthClient, unauthorizedResponse } from "@/lib/auth/server";

const cohortSchema = z.object({
  userId: z.string().uuid(),
  pilotStage: z.enum(["not_enrolled", "admin_pilot", "leader_pilot"])
}).strict();

const feedbackSchema = z.object({
  reviewId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9._:-]+$/),
  usefulness: z.enum(["useful", "mixed", "not_useful"]),
  placementCorrect: z.boolean(),
  groundingHelpful: z.boolean(),
  privacyHandling: z.enum(["correct", "concern", "not_applicable"]),
  issueCodes: z.array(z.enum([
    "wrong_destination",
    "weak_grounding",
    "citation_problem",
    "privacy_concern",
    "permission_concern",
    "theology_concern",
    "audience_mismatch",
    "too_many_false_positives",
    "duplicate_write"
  ])).max(8)
}).strict();

export async function GET() {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();
  const result = await getSupabaseAuthClient(session.accessToken).rpc("get_meridian_mcp_pilot_dashboard", { p_days: 30 });
  if (result.error) {
    if (isUnavailable(result.error)) return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "MCP pilot status could not be loaded." }, { status: 403 });
  }
  return NextResponse.json({ available: true, ...(result.data as Record<string, unknown>) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();
  if (session.user.role !== "admin") return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  const parsed = cohortSchema.safeParse(await safeJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Pilot member settings are invalid." }, { status: 400 });
  const result = await getSupabaseAuthClient(session.accessToken).rpc("set_meridian_mcp_pilot_member", {
    p_user_id: parsed.data.userId,
    p_pilot_stage: parsed.data.pilotStage
  });
  if (result.error) return NextResponse.json({ error: "Pilot enrollment could not be updated." }, { status: 400 });
  return NextResponse.json({ member: result.data });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();
  const parsed = feedbackSchema.safeParse(await safeJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Pilot review feedback is invalid." }, { status: 400 });
  const result = await getSupabaseAuthClient(session.accessToken).rpc("save_meridian_mcp_pilot_review_feedback", {
    p_review_id: parsed.data.reviewId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_usefulness: parsed.data.usefulness,
    p_placement_correct: parsed.data.placementCorrect,
    p_grounding_helpful: parsed.data.groundingHelpful,
    p_privacy_handling: parsed.data.privacyHandling,
    p_issue_codes: parsed.data.issueCodes
  });
  if (result.error) return NextResponse.json({ error: "Pilot review feedback could not be saved." }, { status: 400 });
  return NextResponse.json({ feedback: result.data });
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isUnavailable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST202" || error.code === "42883" || message.includes("get_meridian_mcp_pilot_dashboard");
}
