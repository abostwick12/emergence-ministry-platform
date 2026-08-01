import { describe, expect, it } from "vitest";

import { isGuestAiGenerationEnabled, isGuestSandboxWritesEnabled } from "@/lib/competition/guest-runtime";

describe("competition guest runtime controls", () => {
  it("fails closed outside production when the variables are absent or use a non-boolean value", () => {
    expect(isGuestAiGenerationEnabled({})).toBe(false);
    expect(isGuestSandboxWritesEnabled({ GUEST_SANDBOX_WRITES_ENABLED: "1" })).toBe(false);
  });

  it("enables guest AI by default for the production demo while preserving an explicit kill switch", () => {
    expect(isGuestAiGenerationEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(isGuestAiGenerationEnabled({ VERCEL_ENV: "production", GUEST_AI_GENERATION_ENABLED: "false" })).toBe(false);
  });

  it("accepts only the explicit true value without exposing a public variable", () => {
    expect(isGuestAiGenerationEnabled({ GUEST_AI_GENERATION_ENABLED: " true " })).toBe(true);
    expect(isGuestSandboxWritesEnabled({ GUEST_SANDBOX_WRITES_ENABLED: "TRUE" })).toBe(true);
    expect(isGuestAiGenerationEnabled({ NEXT_PUBLIC_GUEST_AI_GENERATION_ENABLED: "true" })).toBe(false);
  });
});
