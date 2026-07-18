import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getSupabaseAuthClientMock, isSupabaseConfiguredMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getSupabaseAuthClientMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: getSupabaseAuthClientMock
}));

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import {
  getStudentJourneyEntries,
  saveStudentJourneyEntry,
  StudentJourneyEntryError
} from "@/lib/scripture/student-journey-entries";
import type { SaveStudentJourneyEntryInput } from "@/lib/scripture/student-journey-entry-shared";

describe("student journey entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("loads structured entries owned by the authenticated student", async () => {
    const query = journeyEntryQuery([journeyRow()]);
    getSupabaseAuthClientMock.mockReturnValue(query.client);

    const entries = await getStudentJourneyEntries(session());

    expect(entries).toEqual([
      expect.objectContaining({
        journeyId: "growth-journey-1",
        journeyKind: "formation",
        entrySequence: 2,
        scriptureReflection: "God called creation good.",
        fruitReflection: "I noticed potential in someone."
      })
    ]);
    expect(query.query.eq).toHaveBeenCalledWith("student_user_id", "usr_student");
  });

  it("upserts a formation day without requiring a submitted question", async () => {
    const save = journeyEntrySaveClient(journeyRow());
    getSupabaseAuthClientMock.mockReturnValue(save.client);

    const entry = await saveStudentJourneyEntry(session(), formationInput());

    expect(save.table.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ministry_id: "ministry_1",
        student_user_id: "usr_student",
        journey_id: "growth-journey-1",
        journey_kind: "formation",
        prompt_id: null,
        entry_sequence: 2,
        scripture_reflection: "God called creation good."
      }),
      { onConflict: "student_user_id,journey_id,entry_sequence" }
    );
    expect(entry.journeyId).toBe("growth-journey-1");
  });

  it("requires question journeys to match their submitted prompt", async () => {
    await expect(
      saveStudentJourneyEntry(session(), {
        ...formationInput(),
        journeyId: "prompt_1",
        journeyKind: "question",
        promptId: "prompt_2"
      })
    ).rejects.toMatchObject({ code: "invalid_prompt", status: 400 } satisfies Partial<StudentJourneyEntryError>);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("fails clearly when a student profile has no ministry scope", async () => {
    resolveMinistryScopeMock.mockResolvedValue(undefined);

    await expect(saveStudentJourneyEntry(session(), formationInput())).rejects.toMatchObject({
      code: "missing_student_profile",
      status: 409
    } satisfies Partial<StudentJourneyEntryError>);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });
});

function journeyEntryQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const table = { select: vi.fn(() => query) };
  return { client: { from: vi.fn(() => table) }, query, table };
}

function journeyEntrySaveClient(row: Record<string, unknown>) {
  const result = { single: vi.fn(async () => ({ data: row, error: null })) };
  const table = {
    upsert: vi.fn(() => ({ select: vi.fn(() => result) }))
  };
  return { client: { from: vi.fn(() => table) }, result, table };
}

function formationInput(): SaveStudentJourneyEntryInput {
  return {
    journeyId: "growth-journey-1",
    journeyKind: "formation",
    entrySequence: 2,
    scriptureReflection: "God called creation good.",
    questionReflection: "Tov is goodness with purpose.",
    practiceReflection: "I will practice silence.",
    livingReflection: "I will notice potential.",
    fruitReflection: "I noticed potential in someone.",
    selectedPractice: "embodied",
    studyPath: "word",
    selectedReadingId: "growth-journey-1-day-2-primary"
  };
}

function journeyRow() {
  return {
    journey_id: "growth-journey-1",
    journey_kind: "formation",
    prompt_id: null,
    entry_sequence: 2,
    scripture_reflection: "God called creation good.",
    question_reflection: "Tov is goodness with purpose.",
    practice_reflection: "I will practice silence.",
    living_reflection: "I will notice potential.",
    fruit_reflection: "I noticed potential in someone.",
    selected_practice: "embodied",
    study_path: "word",
    selected_reading_id: "growth-journey-1-day-2-primary",
    saved_at: "2026-07-18T13:00:00.000Z",
    updated_at: "2026-07-18T13:00:00.000Z"
  };
}

function session(): AuthSession {
  return {
    isMock: false,
    accessToken: "student-token",
    user: {
      id: "usr_student",
      email: "student@example.test",
      fullName: "Student User",
      role: "student"
    }
  };
}
