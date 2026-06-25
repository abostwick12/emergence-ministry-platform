import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  clearAuthCookiesMock,
  getServerSessionMock,
  getStoredCampRoleStateMock,
  getSupabaseAuthClientMock,
  isSupabaseConfiguredMock,
  setAuthCookiesMock
} = vi.hoisted(() => ({
  clearAuthCookiesMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  getStoredCampRoleStateMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(() => true),
  setAuthCookiesMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  clearAuthCookies: clearAuthCookiesMock,
  getServerSession: getServerSessionMock,
  getSupabaseAuthClient: getSupabaseAuthClientMock,
  setAuthCookies: setAuthCookiesMock,
  unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
}));

vi.mock("@/lib/camp/access-control", () => ({
  campStoredRoleLabels: {
    camp_admin: "Camp Admin",
    driver: "Driver",
    leader: "General Leader",
    medical_coordinator: "Medical Coordinator",
    restricted_assistant: "Restricted Assistant"
  },
  getStoredCampRoleState: getStoredCampRoleStateMock
}));

import { POST as inviteSessionPOST } from "@/app/api/auth/invite-session/route";
import { POST as setPasswordPOST } from "@/app/api/auth/set-password/route";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function realInviteSession(): AuthSession {
  return {
    user: { id: "usr_invited", email: "leader@example.test", fullName: "Leader Person", role: "staff" },
    accessToken: "user-access-token",
    isMock: false
  };
}

beforeEach(() => {
  clearAuthCookiesMock.mockReset();
  getServerSessionMock.mockReset();
  getStoredCampRoleStateMock.mockReset();
  getSupabaseAuthClientMock.mockReset();
  isSupabaseConfiguredMock.mockReset();
  isSupabaseConfiguredMock.mockReturnValue(true);
  setAuthCookiesMock.mockReset();
});

describe("invite password setup routes", () => {
  it("rejects an invite session request without Supabase session tokens", async () => {
    const response = await inviteSessionPOST(jsonRequest("http://localhost/api/auth/invite-session", { type: "invite" }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/missing session credentials/i);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("validates invite tokens with normal Supabase Auth and sets app session cookies", async () => {
    const setSessionMock = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: "validated-access-token", refresh_token: "validated-refresh-token" },
        user: {
          id: "usr_invited",
          email: "Leader@Example.test",
          user_metadata: { full_name: "Leader Person", role: "staff" }
        }
      },
      error: null
    });
    getSupabaseAuthClientMock.mockReturnValue({ auth: { setSession: setSessionMock } });

    const response = await inviteSessionPOST(
      jsonRequest("http://localhost/api/auth/invite-session", {
        accessToken: " raw-access-token ",
        refreshToken: " raw-refresh-token ",
        type: "invite"
      })
    );
    const payload = (await response.json()) as { user: { id: string; email: string; fullName: string } };

    expect(response.status).toBe(200);
    expect(getSupabaseAuthClientMock).toHaveBeenCalledWith();
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: "raw-access-token",
      refresh_token: "raw-refresh-token"
    });
    expect(clearAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object));
    expect(setAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object), {
      accessToken: "validated-access-token",
      refreshToken: "validated-refresh-token"
    });
    expect(payload.user).toMatchObject({
      id: "usr_invited",
      email: "Leader@Example.test",
      fullName: "Leader Person"
    });
  });

  it("rejects password setup when no invited user session is active", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await setPasswordPOST(jsonRequest("http://localhost/api/auth/set-password", { password: "leaderPass123" }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/authentication required/i);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("sets the password with the invited user's Supabase session and opens Camp when access activates", async () => {
    const session = realInviteSession();
    const updateUserMock = vi.fn().mockResolvedValue({ data: { user: { id: session.user.id } }, error: null });
    getServerSessionMock.mockResolvedValue(session);
    getStoredCampRoleStateMock.mockResolvedValue({ available: true, role: "leader" });
    getSupabaseAuthClientMock.mockReturnValue({ auth: { updateUser: updateUserMock } });

    const response = await setPasswordPOST(jsonRequest("http://localhost/api/auth/set-password", { password: "leaderPass123" }));
    const payload = (await response.json()) as { redirectTo: string; campRole: string; campRoleLabel: string };

    expect(response.status).toBe(200);
    expect(getSupabaseAuthClientMock).toHaveBeenCalledWith("user-access-token");
    expect(updateUserMock).toHaveBeenCalledWith({ password: "leaderPass123" });
    expect(getStoredCampRoleStateMock).toHaveBeenCalledWith(session);
    expect(payload).toEqual({
      redirectTo: "/camp",
      campRole: "leader",
      campRoleLabel: "General Leader"
    });
  });

  it("keeps a clear resolved state when the password saves but Camp access is not active", async () => {
    const updateUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "usr_invited" } }, error: null });
    getServerSessionMock.mockResolvedValue(realInviteSession());
    getStoredCampRoleStateMock.mockResolvedValue({ available: true, role: null });
    getSupabaseAuthClientMock.mockReturnValue({ auth: { updateUser: updateUserMock } });

    const response = await setPasswordPOST(jsonRequest("http://localhost/api/auth/set-password", { password: "leaderPass123" }));
    const payload = (await response.json()) as { error: string; passwordUpdated: boolean };

    expect(response.status).toBe(409);
    expect(payload.passwordUpdated).toBe(true);
    expect(payload.error).toMatch(/password was saved/i);
    expect(payload.error).toMatch(/Camp access is not active/i);
  });
});
