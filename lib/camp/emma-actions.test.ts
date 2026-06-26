import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { buildCampAccessFromStoredRole } from "@/lib/camp/access-control";
import { handleCampEmmaAction, parseEmmaCampCommand } from "@/lib/camp/emma-actions";
import type { CampAccessContext } from "@/lib/camp/permissions";
import { __resetCampStoreForTests, listCampEmmaActionAudit, updateCampEmmaPendingAction } from "@/lib/camp/store";
import { getCampOverview, upsertCampStudent } from "@/lib/camp/repository";

function session(id = "usr_actor", fullName = "Alex Walker"): AuthSession {
  return {
    isMock: true,
    user: { id, email: `${id}@example.test`, fullName, role: "staff" }
  };
}

function adminContext(): CampAccessContext {
  return buildCampAccessFromStoredRole("camp_admin");
}

function readOnlyContext(): CampAccessContext {
  return buildCampAccessFromStoredRole("leader");
}

function partnerContext(church = "Grace Chapel"): CampAccessContext {
  return {
    ...buildCampAccessFromStoredRole("leader"),
    campEditScope: "partner_church_only",
    partnerChurchId: church
  };
}

beforeEach(() => {
  __resetCampStoreForTests();
});

describe("parseEmmaCampCommand", () => {
  it("recognizes supported action commands without broad edit behavior", () => {
    expect(parseEmmaCampCommand("Move John West to Blue Team")).toMatchObject({ actionType: "ASSIGN_CAMPER_TEAM", targetNameQuery: "John West", newValue: "Blue" });
    expect(parseEmmaCampCommand("Put James Alcorn as a leader on Green Team")).toMatchObject({ actionType: "ASSIGN_LEADER_TEAM", targetNameQuery: "James Alcorn", newValue: "Green" });
    expect(parseEmmaCampCommand("Change Ava's room to 508")).toMatchObject({ actionType: "UPDATE_CAMPER_ROOM", targetNameQuery: "Ava", newValue: "508" });
    expect(parseEmmaCampCommand("Show me all unassigned leaders")).toMatchObject({ actionType: "LIST_UNASSIGNED_LEADERS" });
  });

  it("blocks restricted medical/contact topics before any action is proposed", () => {
    expect(parseEmmaCampCommand("Update Avery's medication dose")).toMatchObject({ actionType: "UNSUPPORTED", reason: "restricted" });
    expect(parseEmmaCampCommand("Change Avery's guardian phone")).toMatchObject({ actionType: "UNSUPPORTED", reason: "restricted" });
  });
});

describe("handleCampEmmaAction", () => {
  it("denies read-only write requests and records a denied audit entry", async () => {
    const result = await handleCampEmmaAction(session(), readOnlyContext(), {
      originalCommandText: "Move Avery Johnson to Red Team"
    });

    expect(result).toMatchObject({ status: "denied" });
    expect(listCampEmmaActionAudit()).toEqual([
      expect.objectContaining({
        actionType: "ASSIGN_CAMPER_TEAM",
        targetName: "Avery Johnson",
        status: "denied"
      })
    ]);
  });

  it("creates a pending action without mutating, then writes only after confirmation", async () => {
    const actor = session();
    const context = adminContext();

    const proposal = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Move Avery Johnson to Red Team"
    });
    expect(proposal).toMatchObject({
      status: "confirmation_required",
      summary: { targetName: "Avery Johnson", field: "team", oldValue: "Blue", newValue: "Red" }
    });

    let overview = await getCampOverview(actor, context);
    expect(overview.students.find((student) => student.id === "stu-1")?.teamName).toBe("Blue");

    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");
    const completed = await handleCampEmmaAction(actor, context, {
      pendingActionId: proposal.pendingActionId,
      confirmed: true
    });
    expect(completed).toMatchObject({ status: "completed" });

    overview = await getCampOverview(actor, context);
    expect(overview.students.find((student) => student.id === "stu-1")?.teamName).toBe("Red");
    expect(listCampEmmaActionAudit().map((entry) => entry.status)).toEqual(["completed", "proposed"]);
  });

  it("cancels pending actions without writing and logs the cancellation", async () => {
    const actor = session();
    const context = adminContext();
    const proposal = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Change Avery Johnson's room to Cabin Z"
    });
    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");

    const cancelled = await handleCampEmmaAction(actor, context, {
      pendingActionId: proposal.pendingActionId,
      confirmed: false
    });
    expect(cancelled).toMatchObject({ status: "cancelled" });

    const overview = await getCampOverview(actor, context);
    expect(overview.students.find((student) => student.id === "stu-1")?.cabin).toBe("Cabin A");
    expect(listCampEmmaActionAudit().map((entry) => entry.status)).toEqual(["cancelled", "proposed"]);
  });

  it("does not let a different user confirm another user's pending action", async () => {
    const proposal = await handleCampEmmaAction(session("usr_one"), adminContext(), {
      originalCommandText: "Change Avery Johnson's room to Cabin Z"
    });
    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");

    const blocked = await handleCampEmmaAction(session("usr_two"), adminContext(), {
      pendingActionId: proposal.pendingActionId,
      confirmed: true
    });
    expect(blocked).toMatchObject({ status: "failed" });

    const overview = await getCampOverview(session("usr_one"), adminContext());
    expect(overview.students.find((student) => student.id === "stu-1")?.cabin).toBe("Cabin A");
  });

  it("rejects expired pending actions", async () => {
    const actor = session();
    const proposal = await handleCampEmmaAction(actor, adminContext(), {
      originalCommandText: "Change Avery Johnson's room to Cabin Z"
    });
    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");
    updateCampEmmaPendingAction(proposal.pendingActionId, { expiresAt: new Date(Date.now() - 1000).toISOString() });

    const expired = await handleCampEmmaAction(actor, adminContext(), {
      pendingActionId: proposal.pendingActionId,
      confirmed: true
    });
    expect(expired).toMatchObject({ status: "failed" });
    expect(listCampEmmaActionAudit()[0]).toMatchObject({ status: "failed", errorMessage: "Pending action expired." });
  });

  it("asks for clarification on ambiguous camper names and exposes only safe fields", async () => {
    const actor = session();
    const context = adminContext();
    await upsertCampStudent(actor, context, { name: "John West", grade: "8th", teamId: "team-red", vehicleId: "", cabin: "Cabin 1", limitedSafetyFlags: ["Restricted info on file"] });
    await upsertCampStudent(actor, context, { name: "John Carter", grade: "10th", teamId: "", vehicleId: "", cabin: "", limitedSafetyFlags: ["Medication plan on file"] });

    const result = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Move John to Blue Team"
    });
    expect(result).toMatchObject({ status: "clarification_required" });
    if (result.status !== "clarification_required") throw new Error("expected clarification");
    expect(result.options.map((option) => option.targetName).sort()).toEqual(["John Carter", "John West"]);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/medication|insurance|guardian|emergency|restricted info/);
  });

  it("filters out-of-scope partner church targets before clarification or proposal", async () => {
    const actor = session();
    const admin = adminContext();
    await upsertCampStudent(actor, admin, { name: "Grace Camper", grade: "8th", teamId: "", vehicleId: "", cabin: "", sourceChurch: "Grace Chapel", rosterType: "partner", limitedSafetyFlags: [] });
    await upsertCampStudent(actor, admin, { name: "Other Camper", grade: "8th", teamId: "", vehicleId: "", cabin: "", sourceChurch: "Other Church", rosterType: "partner", limitedSafetyFlags: [] });

    const inScope = await handleCampEmmaAction(actor, partnerContext("Grace Chapel"), {
      originalCommandText: "Move Grace Camper to Blue Team"
    });
    expect(inScope).toMatchObject({ status: "confirmation_required" });

    const outOfScope = await handleCampEmmaAction(actor, partnerContext("Grace Chapel"), {
      originalCommandText: "Move Other Camper to Blue Team"
    });
    expect(outOfScope).toMatchObject({ status: "failed" });
    expect(JSON.stringify(outOfScope)).not.toContain("Other Church");
  });

  it("rejects invalid teams and unsafe room values", async () => {
    await expect(handleCampEmmaAction(session(), adminContext(), {
      originalCommandText: "Move Avery Johnson to Silver Team"
    })).resolves.toMatchObject({ status: "failed", message: "I couldn't find that team. Please choose one of the active camp teams." });

    await expect(handleCampEmmaAction(session(), adminContext(), {
      originalCommandText: "Change Avery Johnson's room to <script>alert(1)</script>"
    })).resolves.toMatchObject({ status: "failed" });

    await expect(handleCampEmmaAction(session(), adminContext(), {
      originalCommandText: `Change Avery Johnson's room to ${"A".repeat(60)}`
    })).resolves.toMatchObject({ status: "failed", message: "Room value is too long." });
  });
});
