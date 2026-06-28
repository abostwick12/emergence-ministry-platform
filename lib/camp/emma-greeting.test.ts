import { describe, expect, it } from "vitest";
import { buildCampEmmaWelcomeGreeting } from "@/lib/camp/emma-greeting";

describe("Camp EMMA greeting", () => {
  it("opens with the EMMA agent introduction", () => {
    expect(buildCampEmmaWelcomeGreeting("Alex Walker")).toContain("I'm EMMA, the Emerge Ministry Management Agent.");
  });

  it("uses the leader's first name in the greeting when available", () => {
    expect(buildCampEmmaWelcomeGreeting("Alex Walker")).toContain("Hey, Alex!");
  });

  it("falls back cleanly when no first name is available", () => {
    const greeting = buildCampEmmaWelcomeGreeting("");
    expect(greeting).toContain("Hey there!");
    expect(greeting).toContain("help you find what you need fast");
  });

  it("does not advertise restricted medical capabilities to general users", () => {
    const greeting = buildCampEmmaWelcomeGreeting("Alex Walker").toLowerCase();
    expect(greeting).not.toMatch(/medical|medication|insurance|guardian|emergency contact/);
  });
});
