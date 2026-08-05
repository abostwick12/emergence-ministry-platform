import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { andrewAuthoredSourceKinds } from "@/lib/meridian/knowledge/authored-corpus";
import {
  MeridianKnowledgeRepositoryError,
  SupabaseMeridianKnowledgeRepository
} from "@/lib/meridian/knowledge/repository";

const approvedAuthoredAuthorities = ["adopted_doctrine", "approved_teaching", "attributed_scholarship"] as const;
const approvedAuthoredClaimKinds = ["doctrinal_position", "teaching_history", "scholarly_perspective", "interpretation", "recommendation"] as const;

const promotionSchema = z.object({
  legacyChunkId: z.string().uuid(),
  sourceKind: z.enum(andrewAuthoredSourceKinds),
  rationale: z.string().trim().min(1).max(1200),
  source: z.object({
    title: z.string().trim().min(1).max(240),
    attribution: z.string().trim().max(400).optional(),
    authorityClass: z.enum(approvedAuthoredAuthorities),
    externalVisibility: z.enum(["ministry", "external"]),
    quotePolicy: z.enum(["never", "review_required", "allowed"]),
    sensitivity: z.enum(["general", "internal", "safeguarding"])
  }),
  fragment: z.object({
    text: z.string().trim().min(1).max(12000),
    locator: z.object({
      kind: z.literal("record"),
      value: z.string().trim().min(1).max(240)
    }),
    canQuote: z.boolean(),
    canParaphrase: z.boolean(),
    canCite: z.boolean(),
    canUseFinalAnswer: z.literal(true),
    canUseExternalCommunication: z.boolean()
  }),
  claim: z.object({
    proposition: z.string().trim().min(1).max(2000),
    kind: z.enum(approvedAuthoredClaimKinds),
    attribution: z.string().trim().max(400).optional(),
    authorityClass: z.enum(approvedAuthoredAuthorities),
    confidence: z.number().min(0).max(1),
    scope: z.object({
      audience: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      taskTypes: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      traditions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      sensitivity: z.array(z.enum(["general", "internal", "safeguarding"])).max(3).optional(),
      scriptureReferences: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      topics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      validFrom: z.string().datetime().optional(),
      validUntil: z.string().datetime().optional()
    })
  })
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  if (session.user.role !== "admin") {
    return NextResponse.json({ ok: false, code: "forbidden", error: "Only admins can approve Meridian knowledge." }, { status: 403 });
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
      { ok: false, code: "invalid_promotion", error: "Review the category, claim, excerpt, and permissions before approving." },
      { status: 400 }
    );
  }

  try {
    const result = await new SupabaseMeridianKnowledgeRepository().promoteLegacyClaim(session, {
      legacySourceId: params.id,
      ...parsed.data
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof MeridianKnowledgeRepositoryError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "promotion_failed", error: "Meridian approval could not be completed." }, { status: 500 });
  }
}
