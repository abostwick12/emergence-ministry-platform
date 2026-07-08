import { describe, expect, it } from "vitest";
import { draftLinkedInContent, linkedInDraftInstructions } from "@/lib/command-center/integrations/linkedin";
import { SageProviderConfigError } from "@/lib/command-center/sage";

describe("linkedInDraftInstructions", () => {
  it("returns post-specific instructions that forbid claiming it was published", () => {
    const instructions = linkedInDraftInstructions("post");
    expect(instructions).toContain("LinkedIn post");
    expect(instructions).toContain("never claim it has been posted or published");
  });

  it("returns outreach-specific instructions that forbid claiming it was sent", () => {
    const instructions = linkedInDraftInstructions("outreach");
    expect(instructions).toContain("outreach/connection message");
    expect(instructions).toContain("never claim it has been sent");
  });
});

describe("draftLinkedInContent", () => {
  it("throws SageProviderConfigError instead of reaching a provider when SAGE is not configured", async () => {
    const controller = new AbortController();
    await expect(
      draftLinkedInContent({ kind: "post", topic: "New VA claim milestone", signal: controller.signal, env: {} })
    ).rejects.toThrow(SageProviderConfigError);
  });
});
