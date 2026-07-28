import { describe, expect, it } from "vitest";
import { buildMinistryChatAudit } from "@/lib/emma/ministry-chat-audit";

describe("buildMinistryChatAudit", () => {
  it("hides raw request/run/provider diagnostics after Azure failover", () => {
    const audit = buildMinistryChatAudit({
      providerMode: "live_provider",
      provider: "azure",
      proposalCreated: false,
      warnings: ["Primary EMMA provider failed safely; Azure OpenAI failover returned a valid response."]
    });

    expect(audit).toBe("AI response ready through Azure AI. Primary provider recovered through safe failover. Audit trail saved; no actions executed.");
    expect(audit).not.toMatch(/Request .* Run/);
    expect(audit).not.toContain("emma-camp-test");
    expect(audit).not.toContain("Primary EMMA provider failed safely; Azure OpenAI failover returned a valid response.");
  });

  it("keeps guest simulation and fallback wording user-safe", () => {
    expect(
      buildMinistryChatAudit({
        providerMode: "guest_simulation",
        provider: "mock",
        proposalCreated: false
      })
    ).toBe("Guest demo response. Read-only guidance shown; no writes, sends, workflow triggers, or external ministry data changes ran.");

    expect(
      buildMinistryChatAudit({
        providerMode: "audited_fallback",
        provider: "none",
        proposalCreated: true,
        warnings: ["EMMA audit persistence was unavailable. Deterministic fallback was returned and no action was executed."]
      })
    ).toBe("Audited EMMA response shown; audit storage was unavailable. No actions executed. Recommendation saved for review.");
  });
});
