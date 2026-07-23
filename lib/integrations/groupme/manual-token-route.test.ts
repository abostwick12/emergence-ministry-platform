import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectGroupMe: vi.fn(),
  getGroupMeStatus: vi.fn(),
  redactGroupMeError: vi.fn((error: unknown) => (error instanceof Error ? error.message : "GroupMe action failed.")),
  requireEmergeOperationsWriteAccess: vi.fn()
}));

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsWriteAccess: mocks.requireEmergeOperationsWriteAccess
}));

vi.mock("@/lib/integrations/groupme/repository", () => ({
  connectGroupMe: mocks.connectGroupMe,
  getGroupMeStatus: mocks.getGroupMeStatus,
  redactGroupMeError: mocks.redactGroupMeError
}));

import { POST } from "@/app/api/integrations/groupme/token/route";

const session = {
  isMock: false,
  user: { id: "user-1", email: "leader@example.com", fullName: "Leader", role: "admin" }
};

describe("GroupMe manual token route", () => {
  beforeEach(() => {
    mocks.connectGroupMe.mockReset();
    mocks.getGroupMeStatus.mockReset();
    mocks.redactGroupMeError.mockClear();
    mocks.requireEmergeOperationsWriteAccess.mockReset();
    mocks.requireEmergeOperationsWriteAccess.mockResolvedValue({ allowed: true, session });
  });

  it("rejects blank token submissions", async () => {
    const response = await POST(new Request("https://platform.test/api/integrations/groupme/token", {
      method: "POST",
      body: JSON.stringify({ accessToken: "   " })
    }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Paste a GroupMe access token before connecting.");
    expect(mocks.connectGroupMe).not.toHaveBeenCalled();
  });

  it("connects with a trimmed token through the encrypted repository path", async () => {
    mocks.connectGroupMe.mockResolvedValue({ groupCount: 3 });
    mocks.getGroupMeStatus.mockResolvedValue({
      configured: true,
      storageConfigured: true,
      displayStatus: "connected",
      connectedAt: "2026-07-23T12:00:00.000Z",
      connectedGroupCount: 0,
      message: "Connected."
    });

    const response = await POST(new Request("https://platform.test/api/integrations/groupme/token", {
      method: "POST",
      body: JSON.stringify({ accessToken: "  token-123  " })
    }));
    const body = (await response.json()) as { displayStatus: string; groupCount: number };

    expect(response.status).toBe(200);
    expect(mocks.connectGroupMe).toHaveBeenCalledWith(session, "token-123", "manual_token");
    expect(body.displayStatus).toBe("connected");
    expect(body.groupCount).toBe(3);
  });

  it("returns a redacted connection error", async () => {
    mocks.connectGroupMe.mockRejectedValue(new Error("GroupMe authorization expired. Reconnect GroupMe."));

    const response = await POST(new Request("https://platform.test/api/integrations/groupme/token", {
      method: "POST",
      body: JSON.stringify({ accessToken: "expired-token" })
    }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe("GroupMe authorization expired. Reconnect GroupMe.");
  });
});
