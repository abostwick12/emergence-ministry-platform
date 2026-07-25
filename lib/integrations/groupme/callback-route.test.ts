import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  connectGroupMe: vi.fn(),
  redactGroupMeError: vi.fn((error: unknown) => (error instanceof Error ? error.message : "GroupMe action failed.")),
  refreshServerAccountSession: vi.fn(),
  requireEmergeOperationsWriteAccess: vi.fn(),
  resolveEmergeOperationsWriteAccess: vi.fn(),
  setAuthCookies: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: mocks.cookieGet })
}));

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsWriteAccess: mocks.requireEmergeOperationsWriteAccess,
  resolveEmergeOperationsWriteAccess: mocks.resolveEmergeOperationsWriteAccess
}));

vi.mock("@/lib/auth/server", () => ({
  refreshServerAccountSession: mocks.refreshServerAccountSession,
  setAuthCookies: mocks.setAuthCookies
}));

vi.mock("@/lib/integrations/groupme/client", () => ({
  GROUPME_OAUTH_STATE_COOKIE: "lead_groupme_oauth_state"
}));

vi.mock("@/lib/integrations/groupme/repository", () => ({
  connectGroupMe: mocks.connectGroupMe,
  redactGroupMeError: mocks.redactGroupMeError
}));

import { GET } from "@/app/api/integrations/groupme/callback/route";
import { POST as completePOST } from "@/app/api/integrations/groupme/callback/complete/route";

const session = {
  isMock: false,
  user: { id: "user-1", email: "leader@example.com", fullName: "Leader", role: "admin" }
};

describe("GroupMe OAuth callback", () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.connectGroupMe.mockReset();
    mocks.redactGroupMeError.mockClear();
    mocks.refreshServerAccountSession.mockReset();
    mocks.requireEmergeOperationsWriteAccess.mockReset();
    mocks.resolveEmergeOperationsWriteAccess.mockReset();
    mocks.setAuthCookies.mockReset();
    mocks.cookieGet.mockReturnValue({ value: "csrf-state" });
    mocks.requireEmergeOperationsWriteAccess.mockResolvedValue({ allowed: true, session });
    mocks.resolveEmergeOperationsWriteAccess.mockResolvedValue({ allowed: true, session });
  });

  it("redirects with the populated conversation count after a verified connection", async () => {
    mocks.connectGroupMe.mockResolvedValue({ groupCount: 4 });

    const response = await GET(new Request("https://platform.test/api/integrations/groupme/callback?access_token=token-123&state=csrf-state"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(mocks.connectGroupMe).toHaveBeenCalledWith(session, "token-123");
    expect(location.pathname).toBe("/people");
    expect(location.searchParams.get("groupme")).toBe("connected");
    expect(location.searchParams.get("groupme_groups")).toBe("4");
  });

  it("redirects with a safe reason when GroupMe verification fails", async () => {
    mocks.connectGroupMe.mockRejectedValue(new Error("GroupMe authorization expired. Reconnect GroupMe."));

    const response = await GET(new Request("https://platform.test/api/integrations/groupme/callback?access_token=expired&state=csrf-state"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/people");
    expect(location.searchParams.get("groupme")).toBe("error");
    expect(location.searchParams.get("groupme_reason")).toBe("GroupMe authorization expired. Reconnect GroupMe.");
  });

  it("rejects callback attempts without a matching connect cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await GET(new Request("https://platform.test/api/integrations/groupme/callback?access_token=token-123"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(mocks.connectGroupMe).not.toHaveBeenCalled();
    expect(location.searchParams.get("groupme")).toBe("error");
  });

  it("returns a Volunteer Hub redirect for the callback bridge after a verified connection", async () => {
    mocks.connectGroupMe.mockResolvedValue({ groupCount: 2 });

    const response = await completePOST(new Request("https://platform.test/api/integrations/groupme/callback/complete", {
      method: "POST",
      body: JSON.stringify({ accessToken: "token-123", state: "csrf-state" })
    }));
    const body = (await response.json()) as { redirectTo: string };

    expect(mocks.connectGroupMe).toHaveBeenCalledWith(session, "token-123");
    expect(body.redirectTo).toBe("/people?groupme=connected&groupme_groups=2");
  });

  it("refreshes the app session before completing the callback bridge when the access cookie expired", async () => {
    const refreshedSession = {
      isMock: false,
      user: { id: "user-2", email: "refreshed@example.com", fullName: "Refreshed Leader", role: "admin" }
    };
    mocks.requireEmergeOperationsWriteAccess.mockResolvedValue({
      allowed: false,
      response: Response.json({ error: "Authentication required" }, { status: 401 })
    });
    mocks.refreshServerAccountSession.mockResolvedValue({
      session: refreshedSession,
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token"
    });
    mocks.resolveEmergeOperationsWriteAccess.mockResolvedValue({ allowed: true, session: refreshedSession });
    mocks.connectGroupMe.mockResolvedValue({ groupCount: 1 });

    const response = await completePOST(new Request("https://platform.test/api/integrations/groupme/callback/complete", {
      method: "POST",
      body: JSON.stringify({ accessToken: "groupme-token", state: "csrf-state" })
    }));
    const body = (await response.json()) as { redirectTo: string };

    expect(mocks.refreshServerAccountSession).toHaveBeenCalled();
    expect(mocks.resolveEmergeOperationsWriteAccess).toHaveBeenCalledWith(refreshedSession);
    expect(mocks.connectGroupMe).toHaveBeenCalledWith(refreshedSession, "groupme-token");
    expect(mocks.setAuthCookies).toHaveBeenCalledWith(expect.any(Object), {
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token"
    });
    expect(body.redirectTo).toBe("/people?groupme=connected&groupme_groups=1");
  });

  it("rejects callback bridge attempts without the connect cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await completePOST(new Request("https://platform.test/api/integrations/groupme/callback/complete", {
      method: "POST",
      body: JSON.stringify({ accessToken: "token-123", state: "csrf-state" })
    }));
    const body = (await response.json()) as { redirectTo: string };

    expect(mocks.connectGroupMe).not.toHaveBeenCalled();
    expect(body.redirectTo).toBe("/people?groupme=error");
  });
});
