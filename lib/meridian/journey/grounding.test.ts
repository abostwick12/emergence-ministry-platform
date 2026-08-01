import { describe, expect, it } from "vitest";

import { validateJourneyScriptureAnchor } from "@/lib/meridian/journey/grounding";

describe("Meridian Journey Journal grounding contract", () => {
  it("accepts the exact supplied Scripture range as the primary reading", () => {
    expect(validateJourneyScriptureAnchor("Ephesians 2:8-10", [{ reference: "Ephesians 2:8-10" }])).toEqual({ ok: true });
    expect(validateJourneyScriptureAnchor("Genesis 1:26", [{ reference: "Genesis 1:26-31" }])).toEqual({ ok: true });
  });

  it("blocks topic templates that substitute a different primary passage", () => {
    expect(validateJourneyScriptureAnchor("Ephesians 2:8-10", [{ reference: "Mark 1:14-15" }])).toEqual({
      ok: false,
      reason: "scripture_anchor_substituted",
      expected: "Ephesians 2:8-10",
      actual: "Mark 1:14-15"
    });
  });

  it("allows Meridian to choose an anchor when the student did not supply one", () => {
    expect(validateJourneyScriptureAnchor("", [{ reference: "Mark 1:14-15" }])).toEqual({ ok: true });
  });
});
