import { describe, expect, it } from "vitest";
import { COMMAND_CENTER_EMAIL, isCommandCenterUser } from "@/lib/command-center/access";

function sessionWithEmail(email: string) {
  return { user: { id: "usr_1", email, fullName: "Test User", role: "admin" } };
}

describe("isCommandCenterUser", () => {
  it("returns true for Andrew's exact email", () => {
    expect(isCommandCenterUser(sessionWithEmail(COMMAND_CENTER_EMAIL))).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isCommandCenterUser(sessionWithEmail(" Andrew.W.Bostwick12@GMAIL.com "))).toBe(true);
  });

  it("returns false for any other email", () => {
    expect(isCommandCenterUser(sessionWithEmail("someone.else@example.com"))).toBe(false);
  });

  it("returns false for a null session", () => {
    expect(isCommandCenterUser(null)).toBe(false);
  });

  it("returns false when the user email is missing", () => {
    expect(isCommandCenterUser({ user: {} })).toBe(false);
  });
});
