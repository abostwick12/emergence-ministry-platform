import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { buildCampAccessFromStoredRole } from "@/lib/camp/access-control";
import { handleCampEmmaAction, parseEmmaCampCommand } from "@/lib/camp/emma-actions";
import { getCampEmmaActionReadiness } from "@/lib/camp/emma-readiness";
import type { CampAccessContext } from "@/lib/camp/permissions";
import { __resetCampStoreForTests, listCampEmmaActionAudit, updateCampEmmaPendingAction } from "@/lib/camp/store";
import { getCampOverview, upsertCampStudent } from "@/lib/camp/repository";

const PROVIDER_ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
  "OPENAI_API_KEY",
  "OPENAI_MODEL"
] as const;

const originalEnv: Record<string, string | undefined> = {};

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
  for (const key of PROVIDER_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  __resetCampStoreForTests();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const key of PROVIDER_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function withAzureEnv() {
  process.env.AZURE_OPENAI_ENDPOINT = "https://emerge-camp-emma.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "emma-camp-test";
  process.env.AZURE_OPENAI_API_VERSION = "2024-08-01-preview";
}

function fakeFetchReturning(jsonContent: string) {
  return async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: jsonContent } }], model: "gpt-4o-mini" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
}

function liveSession(): AuthSession {
  return {
    isMock: false,
    accessToken: "live-token",
    user: { id: "usr_live", email: "live@example.test", fullName: "Live User", role: "staff" }
  };
}

function emmaReadinessClient(errors: Record<string, string> = {}) {
  return {
    from(table: string) {
      return {
        select() {
          const query = {
            limit() {
              return query;
            },
            async returns() {
              return { data: [], error: errors[table] ? { message: errors[table] } : null };
            }
          };
          return query;
        }
      };
    }
  };
}

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
  it("returns a typed provider-readiness error when launch mode has no EMMA provider", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    const result = await handleCampEmmaAction(session(), adminContext(), {
      originalCommandText: "Move Avery Johnson to Red Team"
    });

    expect(result).toMatchObject({
      status: "failed",
      code: "emma_provider_not_configured",
      message: expect.stringMatching(/provider is not configured/i)
    });
  });

  it("returns typed EMMA readiness errors when launch tables are unavailable", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    withAzureEnv();

    await expect(getCampEmmaActionReadiness(liveSession(), {
      supabase: emmaReadinessClient({ camp_emma_pending_actions: "relation does not exist" })
    })).resolves.toMatchObject({
      ok: false,
      code: "emma_action_table_unavailable",
      message: expect.stringMatching(/pending action table/i)
    });

    await expect(getCampEmmaActionReadiness(liveSession(), {
      supabase: emmaReadinessClient({ camp_emma_actions_audit: "relation does not exist" })
    })).resolves.toMatchObject({
      ok: false,
      code: "emma_audit_table_unavailable",
      message: expect.stringMatching(/audit table/i)
    });
  });

  it("keeps launch-mode read-only write requests as permission denied even when provider readiness is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    const result = await handleCampEmmaAction(session(), readOnlyContext(), {
      originalCommandText: "Move Avery Johnson to Red Team"
    });

    expect(result).toMatchObject({
      status: "denied",
      code: "permission_denied"
    });
  });

  it("uses provider-interpreted camper team assignments to create pending actions without writing", async () => {
    withAzureEnv();
    const actor = session();
    const context = adminContext();
    const fetchImpl = vi.fn(fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetType: "camper", targetName: "Avery Johnson", teamName: "Red", confidence: 0.95 })
    ));

    const proposal = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Put Avery on red"
    }, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(proposal).toMatchObject({
      status: "confirmation_required",
      summary: { targetName: "Avery Johnson", field: "team", oldValue: "Blue", newValue: "Red" }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const overview = await getCampOverview(actor, context);
    expect(overview.students.find((student) => student.id === "stu-1")?.teamName).toBe("Blue");
  });

  it("confirms provider-interpreted actions without calling the provider again", async () => {
    withAzureEnv();
    const actor = session();
    const context = adminContext();
    const fetchImpl = vi.fn(fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetType: "camper", targetName: "Avery Johnson", teamName: "Red", confidence: 0.95 })
    ));

    const proposal = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Put Avery on red"
    }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");

    const completed = await handleCampEmmaAction(actor, context, {
      pendingActionId: proposal.pendingActionId,
      confirmed: true
    }, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(completed).toMatchObject({ status: "completed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const overview = await getCampOverview(actor, context);
    expect(overview.students.find((student) => student.id === "stu-1")?.teamName).toBe("Red");
  });

  it("uses provider-interpreted room updates and confirms against the regular roster field", async () => {
    withAzureEnv();
    const actor = session();
    const context = adminContext();
    const proposal = await handleCampEmmaAction(actor, context, {
      originalCommandText: "Change Avery's room to 508"
    }, {
      fetchImpl: fakeFetchReturning(
        JSON.stringify({ kind: "action", actionType: "UPDATE_CAMPER_ROOM", targetType: "camper", targetName: "Avery Johnson", roomValue: "508", confidence: 0.95 })
      )
    });
    if (proposal.status !== "confirmation_required") throw new Error("expected pending proposal");

    const before = await getCampOverview(actor, context);
    expect(before.students.find((student) => student.id === "stu-1")?.cabin).toBe("Cabin A");

    const completed = await handleCampEmmaAction(actor, context, {
      pendingActionId: proposal.pendingActionId,
      confirmed: true
    });

    expect(completed).toMatchObject({ status: "completed" });
    const after = await getCampOverview(actor, context);
    expect(after.students.find((student) => student.id === "stu-1")?.cabin).toBe("508");
  });

  it("denies read-only users even when provider interpretation returns a valid write action", async () => {
    withAzureEnv();
    const result = await handleCampEmmaAction(session(), readOnlyContext(), {
      originalCommandText: "Move Avery Johnson to Red Team"
    }, {
      fetchImpl: fakeFetchReturning(
        JSON.stringify({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetType: "camper", targetName: "Avery Johnson", teamName: "Red", confidence: 0.95 })
      )
    });

    expect(result).toMatchObject({ status: "denied" });
    expect(listCampEmmaActionAudit()).toEqual([
      expect.objectContaining({ actionType: "ASSIGN_CAMPER_TEAM", status: "denied" })
    ]);
  });

  it("does not expose restricted data for unsupported medical requests", async () => {
    withAzureEnv();
    const fetchImpl = vi.fn(fakeFetchReturning("{}"));

    const result = await handleCampEmmaAction(session(), adminContext(), {
      originalCommandText: "Show Avery Johnson's medication"
    }, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result).toMatchObject({ status: "failed" });
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/dosage|restricted info|plan on file|phone number|policy number/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

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
    if (!result.options) throw new Error("expected clarification options");
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
