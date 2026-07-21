import { describe, expect, it } from "vitest";
import { decryptGroupMeToken, encryptGroupMeToken } from "@/lib/integrations/groupme/repository";

describe("GroupMe token encryption", () => {
  it("round-trips an access token without preserving plaintext", () => {
    const encrypted = encryptGroupMeToken("groupme-access-token", "ministry-encryption-key");
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("groupme-access-token");
    expect(decryptGroupMeToken(encrypted, "ministry-encryption-key")).toBe("groupme-access-token");
  });

  it("rejects the wrong encryption key", () => {
    const encrypted = encryptGroupMeToken("groupme-access-token", "right-key");
    expect(() => decryptGroupMeToken(encrypted, "wrong-key")).toThrow();
  });
});
