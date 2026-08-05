import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  MeridianKnowledgeRepositoryError,
  SupabaseMeridianKnowledgeRepository
} from "@/lib/meridian/knowledge/repository";

const reviewSchema = z.object({
  decision: z.enum(["started_review", "rejected"]),
  rationale: z.string().trim().max(1200).default("")
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.rationale) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rationale"],
      message: "Rejection requires a review rationale."
    });
  }
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  if (session.user.role !== "admin") {
    return NextResponse.json({ ok: false, code: "forbidden", error: "Only admins can review Meridian candidates." }, { status: 403 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ ok: false, code: "invalid_candidate_id", error: "Candidate identifier is invalid." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON is required." }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "invalid_review", error: "Review fields are invalid.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await new SupabaseMeridianKnowledgeRepository().reviewCandidate(session, {
      candidateId: params.id,
      ...parsed.data
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MeridianKnowledgeRepositoryError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "review_failed", error: "Meridian review could not be completed." }, { status: 500 });
  }
}
