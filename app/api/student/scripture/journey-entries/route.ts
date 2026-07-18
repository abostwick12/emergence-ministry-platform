import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  getStudentJourneyEntries,
  saveStudentJourneyEntry,
  StudentJourneyEntryError
} from "@/lib/scripture/student-journey-entries";
import type { SaveStudentJourneyEntryInput } from "@/lib/scripture/student-journey-entry-shared";
import { resolveStudentHubAccess } from "@/lib/student/access";

type JourneyEntryRequestBody = Partial<Record<keyof SaveStudentJourneyEntryInput, unknown>>;

export async function GET() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  const entries = await getStudentJourneyEntries(access.session);
  return NextResponse.json({ ok: true, entries });
}

export async function PATCH(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: JourneyEntryRequestBody;
  try {
    body = (await request.json()) as JourneyEntryRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  const invalidField = validateBody(body);
  if (invalidField) {
    return NextResponse.json({ ok: false, code: "invalid_entry", error: `${invalidField} is invalid.` }, { status: 400 });
  }

  try {
    const entry = await saveStudentJourneyEntry(access.session, body as SaveStudentJourneyEntryInput);
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    if (error instanceof StudentJourneyEntryError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, code: "journey_entry_error", error: "Journey entry could not be saved." }, { status: 500 });
  }
}

function validateBody(body: JourneyEntryRequestBody) {
  const requiredStrings: Array<keyof SaveStudentJourneyEntryInput> = [
    "journeyId",
    "journeyKind",
    "scriptureReflection",
    "questionReflection",
    "practiceReflection",
    "livingReflection",
    "fruitReflection",
    "selectedPractice",
    "studyPath",
    "selectedReadingId"
  ];
  const invalidString = requiredStrings.find((field) => typeof body[field] !== "string");
  if (invalidString) return invalidString;
  if (body.promptId !== undefined && typeof body.promptId !== "string") return "promptId";
  if (typeof body.entrySequence !== "number") return "entrySequence";
  return undefined;
}
