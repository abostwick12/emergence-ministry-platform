import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decideOAuthAuthorization, getOAuthAuthorizationDetails } from "./supabase-oauth-server";

describe("Supabase server OAuth transport", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retrieves authorization details with the authenticated bearer token", async () => {
    const payload = {
      authorization_id: "request-123",
      client: { id: "client-123", name: "Codex", uri: "https://openai.com" },
      user: { email: "leader@example.com" },
      scope: "openid profile email",
      redirect_uri: "http://127.0.0.1:45000/callback"
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOAuthAuthorizationDetails("account-access-token", "request-123");

    expect(result).toEqual({ data: payload, error: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/oauth/authorizations/request-123",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          apikey: "public-anon-key",
          Authorization: "Bearer account-access-token"
        })
      })
    );
  });

  it("submits the explicit consent decision with the same account boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirect_url: "http://127.0.0.1/callback?code=safe" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await decideOAuthAuthorization("account-access-token", "request-123", "approve");

    expect(result.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/oauth/authorizations/request-123/consent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer account-access-token"
        })
      })
    );
  });

  it("fails closed when Supabase rejects or cannot parse the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 400 })));

    const result = await getOAuthAuthorizationDetails("account-access-token", "expired-request");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Supabase OAuth request failed (400).");
  });
});
