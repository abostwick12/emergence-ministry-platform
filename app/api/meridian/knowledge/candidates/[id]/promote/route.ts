import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  MeridianKnowledgeRepositoryError,
  SupabaseMeridianKnowledgeRepository
} from "@/lib/meridian/knowledge/repository";
import { meridianAuthorityClasses } from "@/lib/meridian/knowledge/types";

const promotionSchema = z.object({
  rationale: z.string().trim().min(1).max(1200),
  source: z.object({
    title: z.string().trim().min(1).max(240),
    attribution: z.string().trim().max(400).optional(),
    authorityClass: z.enum(meridianAuthorityClasses).refine((value) => value !== "none", "Approved authority is required."),
    externalVisibility: z.enum(["ministry", "external"]),
    quotePolicy: z.enum(["never", "review_required", "allowed"]),
    sensitivity: z.enum(["general", "internal", "safeguarding"])
  }),
  fragment: z.object({
    text: z.string().trim().min(1).max(12000),
    locator: z.object({ kind: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(240) }),
    canQuote: z.boolean(),
    canParaphrase: z.boolean(),
    canCite: z.boolean(),
    canUseFinalAnswer: z.boolean(),
    canUseExternalCommunication: z.boolean()
  }),
  claim: z.object({
    proposition: z.string().trim().min(1).max(2000),
    kind: z.enum([
      "scripture_text",
      "doctrinal_position",
      "policy_rule",
      "strategy_priority",
      "teaching_history",
      "scholarly_perspective",
      "operational_observation",
      "interpretation",
      "recommendation",
      "draft"
    ]),
    attribution: z.string().trim().max(400).optional(),
    authorityClass: z.enum(meridianAuthorityClasses).refine((value) => value !== "none", "Approved authority is required."),
    confidence: z.number().min(0).max(1),
    scope: z.object({
      ministryIds: z.array(z.string().uuid()).max(20).optional(),
      audience: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      taskTypes: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      traditions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      sensitivity: z.array(z.enum(["general", "internal", "pastoral", "person_specific", "safeguarding"])).max(5).optional(),
      validFrom: z.string().datetime().optional(),
      validUntil: z.string().datetime().optional()
    })
  })
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  if (session.user.role !== "admin") {
    return NextResponse.json({ ok: false, code: "forbidden", error: "Only admins can promote Meridian knowledge." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON is required." }, { status: 400 });
  }
  const parsed = promotionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "invalid_promotion", error: "Promotion fields are invalid.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await new SupabaseMeridianKnowledgeRepository().promoteCandidate(session, {
      candidateId: params.id,
      ...parsed.data
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof MeridianKnowledgeRepositoryError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "promotion_failed", error: "Meridian promotion could not be completed." }, { status: 500 });
  }
}
