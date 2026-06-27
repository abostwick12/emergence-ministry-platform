import { describe, expect, it } from "vitest";
import { buildCampEmmaWelcomeGreeting } from "@/lib/camp/emma-greeting";

describe("Camp EMMA greeting", () => {
  it("opens with a polished Camp Oakwood assistant introduction", () => {
    expect(buildCampEmmaWelcomeGreeting("Alex Walker")).toContain("Hey! I\u2019m EMMA \u2014 your Camp Oakwood assistant.");
  });

  it("uses the leader's first name in the helper copy when available", () => {
    expect(buildCampEmmaWelcomeGreeting("Alex Walker")).toContain("Alex, I can help you quickly find");
  });

  it("falls back cleanly when no first name is available", () => {
    expect(buildCampEmmaWelcomeGreeting("")).toContain("I can help you quickly find");
  });

  it("does not advertise restricted medical capabilities to general users", () => {
    const greeting = buildCampEmmaWelcomeGreeting("Alex Walker").toLowerCase();
    expect(greeting).not.toMatch(/medical|medication|insurance|guardian|emergency contact/);
  });
});
