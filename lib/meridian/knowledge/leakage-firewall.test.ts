import { describe, expect, it } from "vitest";

import { inspectPrivateFragmentLeakage } from "@/lib/meridian/knowledge/leakage-firewall";

const privateFragment = {
  id: "private-1",
  contentHash: "b".repeat(64),
  rawText: "Leader Rowan privately recorded that the blue lantern meeting should remain confined to the pastoral review team."
};

describe("Meridian private-fragment leakage firewall", () => {
  it("blocks exact overlap without returning private text in diagnostics", async () => {
    const result = await inspectPrivateFragmentLeakage(
      "The blue lantern meeting should remain confined to the pastoral review team.",
      [privateFragment]
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected leakage block.");
    expect(result.action).toBe("block_and_require_review");
    expect(result.findings[0]).toMatchObject({ fragmentId: "private-1", kind: "exact", contentHash: "b".repeat(64) });
    expect(JSON.stringify(result)).not.toContain("Rowan");
  });

  it("blocks high-similarity paraphrase overlap", async () => {
    const result = await inspectPrivateFragmentLeakage(
      "Leader Rowan privately noted that the blue lantern meeting must stay confined to the pastoral review team.",
      [privateFragment]
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected leakage block.");
    expect(result.findings[0].kind).toBe("fuzzy");
  });

  it("allows unrelated grounded output", async () => {
    const result = await inspectPrivateFragmentLeakage("Review the approved strategy and ask the ministry leader what changed this season.", [privateFragment]);
    expect(result).toEqual({ ok: true, findings: [] });
  });
});
