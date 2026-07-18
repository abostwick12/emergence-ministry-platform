import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { StudentJourneyEntry } from "@/lib/scripture/student-journey-entry-shared";

const { getEntriesMock, getServerSessionMock, saveEntryMock } = vi.hoisted(() => ({
  getEntriesMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  saveEntryMock: vi.fn()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/scripture/student-journey-entries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/student-journey-entries")>("@/lib/scripture/student-journey-entries");
  return {
    ...actual,
    getStudentJourneyEntries: getEntriesMock,
    saveStudentJourneyEntry: saveEntryMock
  };
});

import { GET as entriesGET, PATCH as entriesPATCH } from "@/app/api/student/scripture/journey-entries/route";

beforeEach(() => {
  getEntriesMock.mockReset();
  getServerSessionMock.mockReset();
  saveEntryMock.mockReset();
});

describe("student journey entries route", () => {
  it("returns the authenticated student's account entries", async () => {
    const entry = journeyEntry();
    getServerSessionMock.mockResolvedValue(session());
    getEntriesMock.mockResolvedValue([entry]);

    const response = await entriesGET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, entries: [entry] });
  });

  it("saves a structured formation day", async () => {
    const entry = journeyEntry();
    getServerSessionMock.mockResolvedValue(session());
    saveEntryMock.mockResolvedValue(entry);

    const body = {
      journeyId: entry.journeyId,
      journeyKind: entry.journeyKind,
      entrySequence: entry.entrySequence,
      scriptureReflection: entry.scriptureReflection,
      questionReflection: entry.questionReflection,
      practiceReflection: entry.practiceReflection,
      livingReflection: entry.livingReflection,
      fruitReflection: entry.fruitReflection,
      selectedPractice: entry.selectedPractice,
      studyPath: entry.studyPath,
      selectedReadingId: entry.selectedReadingId
    };
    const response = await entriesPATCH(jsonRequest(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, entry });
    expect(saveEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: "usr_student" }) }),
      body
    );
  });

  it("rejects malformed entry requests", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await entriesPATCH(jsonRequest({ journeyId: "growth-journey-1", entrySequence: "two" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "invalid_entry" });
    expect(saveEntryMock).not.toHaveBeenCalled();
  });

  it("fails closed for unauthenticated writes", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await entriesPATCH(jsonRequest({}));

    expect(response.status).toBe(401);
    expect(saveEntryMock).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/student/scripture/journey-entries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function journeyEntry(): StudentJourneyEntry {
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
    selectedReadingId: "growth-journey-1-day-2-primary",
    savedAt: "2026-07-18T13:00:00.000Z",
    updatedAt: "2026-07-18T13:00:00.000Z"
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
