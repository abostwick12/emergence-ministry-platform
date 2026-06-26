import { describe, expect, it } from "vitest";
import { buildCampEmmaWelcomeGreeting } from "@/lib/camp/emma-greeting";

describe("Camp EMMA greeting", () => {
  it("uses the leader's first name when available", () => {
    expect(buildCampEmmaWelcomeGreeting("Alex Walker")).toContain("Hey, Alex! I\u2019m EMMA, the Emerge Ministry Management Agent.");
  });

  it("falls back when no first name is available", () => {
    expect(buildCampEmmaWelcomeGreeting("")).toContain("Hey there! I\u2019m EMMA, the Emerge Ministry Management Agent.");
  });

  it("does not advertise restricted medical capabilities to general users", () => {
    const greeting = buildCampEmmaWelcomeGreeting("Alex Walker").toLowerCase();
    expect(greeting).not.toMatch(/medical|medication|insurance|guardian|emergency contact/);
  });
});
