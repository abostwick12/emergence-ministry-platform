import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  MeridianKnowledgeRepositoryError,
  SupabaseMeridianKnowledgeRepository
} from "@/lib/meridian/knowledge/repository";

const reviewedText = z.string().trim().min(1).max(500);
const questionMapSchema = z.object({
  aliases: z.array(reviewedText).min(1).max(20),
  facets: z.array(reviewedText).min(1).max(4),
  topics: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  rationale: z.string().trim().min(1).max(1200)
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { ok: false, code: "forbidden", error: "Only admins can promote Meridian question maps." },
      { status: 403 }
    );
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json(
      { ok: false, code: "invalid_candidate_id", error: "Candidate identifier is invalid." },
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON is required." }, { status: 400 });
  }
  const parsed = questionMapSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "invalid_question_map", error: "Question-map fields are invalid.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await new SupabaseMeridianKnowledgeRepository().promoteQuestionMap(session, {
      candidateId: params.id,
      ...parsed.data
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof MeridianKnowledgeRepositoryError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, code: "promotion_failed", error: "Meridian question-map promotion could not be completed." },
      { status: 500 }
    );
  }
}
