import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import { confirmCampEmmaRoomChange, getCampOverview } from "@/lib/camp/repository";
import { __resetCampStoreForTests, listCampEmmaActions } from "@/lib/camp/store";

function session(fullName = "MVP Staff User", email = "staff@example.com"): AuthSession {
  return {
    isMock: true,
    user: { id: "usr_mock", email, fullName, role: "admin" }
  };
}

const AVERY_STUDENT_ID = "stu-1"; // "Avery Johnson", seeded in lib/camp/public-data.ts with cabin "Cabin A"

beforeEach(() => {
  __resetCampStoreForTests();
});

describe("confirmCampEmmaRoomChange", () => {
  it("writes the room change only after an explicit confirm, when Andrew is the actor", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "andrew");

    const before = await getCampOverview(mockSession, context);
    const avery = before.students.find((student) => student.id === AVERY_STUDENT_ID);
    expect(avery?.cabin).toBe("Cabin A");

    const result = await confirmCampEmmaRoomChange(mockSession, context, {
      studentId: AVERY_STUDENT_ID,
      proposedRoom: "Cabin Z",
      originalRequest: "Change Avery Johnson to Cabin Z",
      model: "gpt-4o-mini",
      deployment: "emma-camp-test"
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error("expected confirm to succeed");
    expect(result.student.cabin).toBe("Cabin Z");

    const after = await getCampOverview(mockSession, context);
    expect(after.students.find((student) => student.id === AVERY_STUDENT_ID)?.cabin).toBe("Cabin Z");
  });

  it("leaves the record unchanged when the proposal is never confirmed (cancel behavior)", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "andrew");

    // Simulates the user pressing Cancel: a proposal may have been generated
    // elsewhere, but confirmCampEmmaRoomChange is simply never called.
    const overview = await getCampOverview(mockSession, context);
    expect(overview.students.find((student) => student.id === AVERY_STUDENT_ID)?.cabin).toBe("Cabin A");
    expect(listCampEmmaActions()).toHaveLength(0);
  });

  it("logs an audit record with actor, old/new room, source, original request, and model metadata", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "andrew");

    const result = await confirmCampEmmaRoomChange(mockSession, context, {
      studentId: AVERY_STUDENT_ID,
      proposedRoom: "Cabin Z",
      originalRequest: "Change Avery Johnson to Cabin Z",
      model: "gpt-4o-mini",
      deployment: "emma-camp-test"
    });
    expect(result.allowed).toBe(true);

    const actions = listCampEmmaActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actor: "Andrew",
      studentId: AVERY_STUDENT_ID,
      studentName: "Avery Johnson",
      oldRoom: "Cabin A",
      newRoom: "Cabin Z",
      source: "emma",
      originalRequest: "Change Avery Johnson to Cabin Z",
      model: "gpt-4o-mini",
      deployment: "emma-camp-test"
    });
    expect(actions[0].createdAt).toBeTruthy();
    expect(JSON.stringify(actions[0])).not.toMatch(/AZURE_OPENAI|api[-_]?key/i);
  });

  it("blocks a General Leader from making an EMMA operational room change", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "general_leader");

    const result = await confirmCampEmmaRoomChange(mockSession, context, {
      studentId: AVERY_STUDENT_ID,
      proposedRoom: "Cabin Z",
      originalRequest: "Change Avery Johnson to Cabin Z",
      model: "gpt-4o-mini",
      deployment: "emma-camp-test"
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("expected General Leader to be blocked");
    expect(result.status).toBe(403);

    const overview = await getCampOverview(mockSession, context);
    expect(overview.students.find((student) => student.id === AVERY_STUDENT_ID)?.cabin).toBe("Cabin A");
    expect(listCampEmmaActions()).toHaveLength(0);
  });

  it("blocks Jaci from operational EMMA updates in this first slice", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "jaci");

    const result = await confirmCampEmmaRoomChange(mockSession, context, {
      studentId: AVERY_STUDENT_ID,
      proposedRoom: "Cabin Z",
      originalRequest: "Change Avery Johnson to Cabin Z",
      model: "gpt-4o-mini",
      deployment: "emma-camp-test"
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("expected Jaci to be blocked");
    expect(result.status).toBe(403);
    expect(listCampEmmaActions()).toHaveLength(0);
  });
});
