import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  generateMeridianReadingPlanDraft,
  getMeridianAiReadiness,
  type MeridianReadingPlanDraftInput
} from "@/lib/scripture/meridian-ai";
import { resolveStudentHubAccess } from "@/lib/student/access";

type ReadingPlanRequestBody = Partial<Record<keyof MeridianReadingPlanDraftInput, unknown>>;

export async function POST(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  if (access.session.isGuest) {
    return NextResponse.json({
      ok: true,
      draft: {
        ok: true,
        provider: "gloo",
        model: "guest-stock-responses",
        modelReason: "Guest mode uses a curated stock Meridian response. No Gloo, Gemini, OpenAI, or database call ran.",
        title: "Guest Reading Plan Preview",
        audience: "Competition guest sandbox",
        duration: "5 days",
        primaryScripture: "Luke 15",
        movement: "Jesus / Kingdom Fulfilled",
        summary: "A leader-reviewed sample plan that helps students notice welcome, repentance, and joy in Jesus' parables.",
        contextFocus: "Use this as a demo of flow and tone, not as persisted curriculum.",
        weeklyRhythm: ["Notice the setting.", "Name the lost-and-found pattern.", "Ask what welcome reveals.", "Connect the story to community.", "Pray for one next step."],
        discussionPrompts: ["Where do you see grace moving toward someone before they have everything figured out?"],
        guardrailNotes: ["Guest mode does not save or publish this plan."],
        prayerPrompt: "Jesus, help us notice your welcome and respond honestly.",
        safetyNotes: "Stock guest simulation for leader review only."
      }
    }, { status: 201 });
  }

  const readiness = getMeridianAiReadiness();
  if (!readiness.configured) {
    return NextResponse.json(
      {
        ok: false,
        code: "ai_not_configured",
        error: "Meridian AI is not configured. Configure Gloo first, with Gemini or OpenAI as fallback."
      },
      { status: 503 }
    );
  }

  let body: ReadingPlanRequestBody;
  try {
    body = (await request.json()) as ReadingPlanRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  const input = normalizeInput(body);
  if (!input.primaryScripture && !input.contextNotes && !input.title) {
    return NextResponse.json(
      { ok: false, code: "missing_seed", error: "Add a title, Scripture reference, or context notes before generating a reading-plan draft." },
      { status: 400 }
    );
  }

  const draft = await generateMeridianReadingPlanDraft(input);
  if (!draft.ok) {
    return NextResponse.json({ ok: false, code: draft.code, error: draft.message, attemptedProviders: draft.attemptedProviders }, { status: 502 });
  }

  return NextResponse.json({ ok: true, draft }, { status: 201 });
}

function normalizeInput(body: ReadingPlanRequestBody): MeridianReadingPlanDraftInput {
  return {
    title: normalizeText(body.title, 140),
    audience: normalizeText(body.audience, 120),
    duration: normalizeText(body.duration, 80),
    primaryScripture: normalizeText(body.primaryScripture, 160),
    contextNotes: normalizeText(body.contextNotes, 1200),
    observationQuestion: normalizeText(body.observationQuestion, 500),
    interpretationQuestion: normalizeText(body.interpretationQuestion, 500),
    applicationQuestion: normalizeText(body.applicationQuestion, 500),
    discussionQuestion: normalizeText(body.discussionQuestion, 500),
    prayerPrompt: normalizeText(body.prayerPrompt, 500),
    guardrailNotes: normalizeText(body.guardrailNotes, 900)
  };
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}
