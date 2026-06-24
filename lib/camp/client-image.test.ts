import { describe, expect, it } from "vitest";
import { campImageUploadProfiles, shouldPrepareCampImage } from "@/lib/camp/client-image";

describe("camp client image upload profiles", () => {
  it("keeps camper photos identification quality while avoiding full phone-size uploads", () => {
    expect(campImageUploadProfiles.camperProfile.maxDimension).toBeGreaterThanOrEqual(1200);
    expect(campImageUploadProfiles.camperProfile.maxPassthroughBytes).toBeLessThanOrEqual(1_500_000);
    expect(campImageUploadProfiles.camperProfile.quality).toBeGreaterThanOrEqual(0.8);
    expect(shouldPrepareCampImage({ size: 4_000_000, type: "image/jpeg" }, campImageUploadProfiles.camperProfile)).toBe(true);
  });

  it("keeps medication label photos larger and clearer than camper profile photos", () => {
    expect(campImageUploadProfiles.medicationLabel.maxDimension).toBeGreaterThan(campImageUploadProfiles.camperProfile.maxDimension);
    expect(campImageUploadProfiles.medicationLabel.quality).toBeGreaterThan(campImageUploadProfiles.camperProfile.quality);
    expect(shouldPrepareCampImage({ size: 1_800_000, type: "image/jpeg" }, campImageUploadProfiles.medicationLabel)).toBe(false);
    expect(shouldPrepareCampImage({ size: 3_500_000, type: "image/jpeg" }, campImageUploadProfiles.medicationLabel)).toBe(true);
  });

  it("prepares HEIC/HEIF captures even when file size is already modest", () => {
    expect(shouldPrepareCampImage({ size: 400_000, type: "image/heic" }, campImageUploadProfiles.camperProfile)).toBe(true);
    expect(shouldPrepareCampImage({ size: 400_000, type: "image/heif" }, campImageUploadProfiles.medicationLabel)).toBe(true);
  });
});
