import { describe, expect, it } from "vitest";
import { isIntegrationConfigured } from "@/lib/command-center/integrations-meta";

describe("isIntegrationConfigured", () => {
  it("requires all listed env vars for a Google-backed integration", () => {
    expect(isIntegrationConfigured("google_calendar", {})).toBe(false);
    expect(
      isIntegrationConfigured("google_calendar", {
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REDIRECT_URI: "https://example.com/callback"
      })
    ).toBe(true);
  });

  it("LinkedIn is configured exactly when SAGE's own AI provider is configured, not a dedicated env var", () => {
    expect(isIntegrationConfigured("linkedin", {})).toBe(false);
    expect(isIntegrationConfigured("linkedin", { OPENAI_API_KEY: "sk-test" })).toBe(true);
    expect(
      isIntegrationConfigured("linkedin", {
        SAGE_AI_PROVIDER: "azure",
        AZURE_OPENAI_API_KEY: "key",
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
        AZURE_OPENAI_DEPLOYMENT: "deployment"
      })
    ).toBe(true);
  });
});
