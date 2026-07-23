import { describe, expect, it } from "vitest";
import { buildGoogleDemoAuthUrl, GoogleDemoConfigError, readGoogleDemoConfig } from "@/lib/integrations/google-demo/client";

const sharedGoogleEnv = {
  GOOGLE_CLIENT_ID: "shared-client-id",
  GOOGLE_CLIENT_SECRET: "shared-client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/integrations/google-demo/callback",
  GOOGLE_INTEGRATION_ENCRYPTION_KEY: "shared-encryption-key"
};

const legacyGoogleDemoEnv = {
  GOOGLE_DEMO_CLIENT_ID: "demo-client-id",
  GOOGLE_DEMO_CLIENT_SECRET: "demo-client-secret",
  GOOGLE_DEMO_REDIRECT_URI: "https://example.com/api/integrations/google-demo/callback",
  GOOGLE_DEMO_ENCRYPTION_KEY: "demo-encryption-key"
};

describe("Google Calendar and Drive configuration", () => {
  it("accepts the shared Google OAuth variables used by Command Center integrations", () => {
    const config = readGoogleDemoConfig(sharedGoogleEnv);
    expect(config.configured).toBe(true);
    expect(config.missing).toEqual([]);
    expect(config.clientId).toBe("shared-client-id");
    expect(config.clientSecret).toBe("shared-client-secret");
    expect(config.redirectUri).toBe("https://example.com/api/integrations/google-demo/callback");
    expect(config.encryptionKey).toBe("shared-encryption-key");
  });

  it("keeps legacy Google demo variables working as compatibility fallbacks", () => {
    const config = readGoogleDemoConfig(legacyGoogleDemoEnv);
    expect(config.configured).toBe(true);
    expect(config.clientId).toBe("demo-client-id");
    expect(config.encryptionKey).toBe("demo-encryption-key");
  });

  it("builds OAuth URLs without exposing the encryption key", () => {
    const url = new URL(buildGoogleDemoAuthUrl({ state: "csrf-state", env: sharedGoogleEnv }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("shared-client-id");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.toString()).not.toContain("shared-encryption-key");
  });

  it("fails closed with clear shared-or-legacy missing labels", () => {
    const config = readGoogleDemoConfig({});
    expect(config.missing).toEqual([
      "GOOGLE_CLIENT_ID or GOOGLE_DEMO_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET or GOOGLE_DEMO_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI or GOOGLE_DEMO_REDIRECT_URI",
      "GOOGLE_INTEGRATION_ENCRYPTION_KEY or GOOGLE_DEMO_ENCRYPTION_KEY"
    ]);
    expect(() => buildGoogleDemoAuthUrl({ state: "state", env: {} })).toThrow(GoogleDemoConfigError);
  });
});
