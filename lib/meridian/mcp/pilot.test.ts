import { describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { runPlatformMcpPilotOperation, type PlatformMcpPilotRepository } from "@/lib/meridian/mcp/pilot";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

const session: AuthSession = {
  user: { id: "323e4567-e89b-42d3-a456-426614174000", email: "leader@example.test", fullName: "Leader", role: "leader" },
  accessToken: "live-token",
  isMock: false
};

describe("platform MCP pilot operation guard", () => {
  it("requires cohort access before running a platform tool", async () => {
    const repository = fakeRepository();
    repository.assertAccess = vi.fn().mockRejectedValue(new MeridianMcpError("mcp_pilot_access_denied", 403, "Pilot only."));
    const run = vi.fn();
    await expect(runPlatformMcpPilotOperation({
      session,
      toolName: "list_events",
      clientName: "Codex",
      context: { operationKind: "read" },
      repository,
      run
    })).rejects.toMatchObject({ code: "mcp_pilot_access_denied", status: 403 });
    expect(run).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("records only bounded metrics for a verified idempotent write", async () => {
    const repository = fakeRepository();
    const ticks = [100, 142];
    const result = await runPlatformMcpPilotOperation({
      session,
      toolName: "create_resource_bundle",
      clientName: "Codex\u0000 Desktop",
      context: {
        operationKind: "write",
        targetRecordType: "resource_bundle",
        parentRecordType: "weekly_leader_prep",
        parentRecordId: "current-week",
        artifactCount: 2,
        privateDiscoveryStatus: "passed"
      },
      repository,
      now: () => ticks.shift() ?? 142,
      run: async () => ({ id: "423e4567-e89b-42d3-a456-426614174000", idempotentReplay: true })
    });
    expect(result.idempotentReplay).toBe(true);
    expect(repository.recordEvent).toHaveBeenCalledWith(session, expect.objectContaining({
      toolName: "create_resource_bundle",
      clientCategory: "codex",
      pilotStage: "leader_pilot",
      outcome: "idempotent_replay",
      durationMs: 42,
      targetRecordId: "423e4567-e89b-42d3-a456-426614174000",
      artifactCount: 2,
      errorCode: null
    }));
    expect(JSON.stringify(vi.mocked(repository.recordEvent).mock.calls)).not.toContain("bodyMarkdown");
  });

  it("records categorical EMMA outcome and finding counts", async () => {
    const repository = fakeRepository();
    await runPlatformMcpPilotOperation({
      session,
      toolName: "submit_bundle_for_emma_review",
      clientName: "Codex",
      context: { operationKind: "write", targetRecordType: "resource_bundle", targetRecordId: "423e4567-e89b-42d3-a456-426614174000", artifactCount: 1, groundingClaimCount: 2 },
      repository,
      run: async () => ({
        outcome: "changes_required",
        findings: [{ severity: "advisory" }, { severity: "required_change" }, { severity: "blocker" }],
        idempotentReplay: false
      })
    });
    expect(repository.recordEvent).toHaveBeenCalledWith(session, expect.objectContaining({
      emmaOutcome: "changes_required",
      advisoryCount: 1,
      requiredChangeCount: 1,
      blockerCount: 1,
      groundingClaimCount: 2
    }));
  });

  it("preserves the original safe rejection if failure telemetry is unavailable", async () => {
    const repository = fakeRepository();
    repository.recordEvent = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(runPlatformMcpPilotOperation({
      session,
      toolName: "create_resource_bundle",
      clientName: "Codex",
      context: { operationKind: "write" },
      repository,
      run: async () => { throw new MeridianMcpError("private_discovery_leakage", 422, "Sensitive raw text that must not be logged."); }
    })).rejects.toMatchObject({ code: "private_discovery_leakage", status: 422 });
    expect(repository.recordEvent).toHaveBeenCalledWith(session, expect.objectContaining({
      outcome: "rejected",
      errorCode: "private_discovery_leakage",
      privateDiscoveryStatus: undefined
    }));
    expect(JSON.stringify(vi.mocked(repository.recordEvent).mock.calls)).not.toContain("Sensitive raw text");
  });

  it("fails a successful call safely when required pilot telemetry cannot be stored", async () => {
    const repository = fakeRepository();
    repository.recordEvent = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(runPlatformMcpPilotOperation({
      session,
      toolName: "create_event",
      clientName: "Codex",
      context: { operationKind: "write" },
      repository,
      run: async () => ({ event: { id: "123e4567-e89b-42d3-a456-426614174000" }, idempotentReplay: false })
    })).rejects.toMatchObject({ code: "mcp_pilot_telemetry_unavailable", status: 503 });
  });
});

function fakeRepository(): PlatformMcpPilotRepository {
  return {
    assertAccess: vi.fn().mockResolvedValue({ pilotStage: "leader_pilot" }),
    recordEvent: vi.fn().mockResolvedValue(undefined)
  };
}
