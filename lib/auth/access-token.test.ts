import { describe, expect, it } from "vitest";

import { getAccessTokenExpiration, isAccessTokenUnexpired } from "@/lib/auth/access-token";

describe("access token lifecycle parsing", () => {
  it("accepts a structurally valid access token before its expiration", () => {
    const token = jwt({ exp: 2_000 });

    expect(getAccessTokenExpiration(token)).toBe(2_000);
    expect(isAccessTokenUnexpired(token, 1_000_000)).toBe(true);
  });

  it("rejects an expired access token", () => {
    expect(isAccessTokenUnexpired(jwt({ exp: 1_000 }), 1_000_000)).toBe(false);
  });

  it.each([
    "not-a-jwt",
    "header.payload.",
    jwt({}),
    jwt({ exp: "tomorrow" })
  ])("rejects a malformed token or missing expiration: %s", (token) => {
    expect(getAccessTokenExpiration(token)).toBeNull();
    expect(isAccessTokenUnexpired(token, 1_000_000)).toBe(false);
  });
});

function jwt(payload: Record<string, unknown>) {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.test-signature`;
}

function encode(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
