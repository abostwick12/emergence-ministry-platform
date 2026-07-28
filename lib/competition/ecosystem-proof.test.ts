import { describe, expect, it } from "vitest";

import {
  competitionBoundaryGroups,
  competitionEcosystemProof,
  competitionVerificationRoutes
} from "@/lib/competition/ecosystem-proof";

describe("competition ecosystem proof", () => {
  it("keeps the judged provider path explicit", () => {
    expect(competitionEcosystemProof.map((layer) => layer.label)).toEqual([
      "Operational hub",
      "Meridian context",
      "YouVersion grounding",
      "Gloo AI Studio",
      "Leader approval"
    ]);
    expect(competitionEcosystemProof.find((layer) => layer.label === "YouVersion grounding")?.detail).toContain("without storing licensed Bible text");
    expect(competitionEcosystemProof.find((layer) => layer.label === "Gloo AI Studio")?.detail).toContain("Primary draft provider");
  });

  it("documents demo boundaries without overclaiming live automation", () => {
    const boundaryText = competitionBoundaryGroups.flatMap((group) => group.items).join(" ");

    expect(boundaryText).toContain("No autonomous verdicts");
    expect(boundaryText).toContain("No automatic sending");
    expect(boundaryText).toContain("No stored Bible text");
  });

  it("routes judges into the real verification surfaces", () => {
    expect(competitionVerificationRoutes.map((route) => route.href)).toEqual([
      "/login",
      "/dashboard",
      "/ministry",
      "/student/scripture/resources?reference=John%203%3A16",
      "/student/scripture/questions",
      "/discipleship"
    ]);
  });
});
