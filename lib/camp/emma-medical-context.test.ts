import { describe, expect, it } from "vitest";
import { shouldUseMedicalCommandContext } from "@/lib/camp/emma-medical-context";

describe("Camp EMMA medical context classifier", () => {
  it("does not route operational aggregate questions through Medical Command", () => {
    expect(shouldUseMedicalCommandContext(true, "Which team has the fewest high school students")).toBe(false);
  });

  it("routes medication-specific questions through Medical Command for authorized users", () => {
    expect(shouldUseMedicalCommandContext(true, "What medicine is due?")).toBe(true);
    expect(shouldUseMedicalCommandContext(true, "Which campers need medication intake?")).toBe(true);
  });

  it("does not enable Medical Command context for unauthorized users", () => {
    expect(shouldUseMedicalCommandContext(false, "What medicine is due?")).toBe(false);
  });
});
