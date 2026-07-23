import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  connectGroupMe: vi.fn(),
  redactGroupMeError: vi.fn((error: unknown) => (error instanceof Error ? error.message : "GroupMe action failed.")),
  requireEmergeOperationsWriteAccess: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: mocks.cookieGet })
}));

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsWriteAccess: mocks.requireEmergeOperationsWriteAccess
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
    mocks.requireEmergeOperationsWriteAccess.mockReset();
    mocks.cookieGet.mockReturnValue({ value: "csrf-state" });
    mocks.requireEmergeOperationsWriteAccess.mockResolvedValue({ allowed: true, session });
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
