import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Camp access admin UI permissions controls", () => {
  it("exposes assigned team scope controls and sends assigned teams to the API", () => {
    const source = readFileSync(join(process.cwd(), "components/camp/camp-access-admin.tsx"), "utf8");

    expect(source).toContain("Assigned team scope");
    expect(source).toContain("multiple");
    expect(source).toContain("assignedTeamIds");
    expect(source).toContain("teamScopeLabel");
    expect(source).toContain("body: JSON.stringify({ email, displayName, campRole, campEditScope, appAreaScope, canPostTeamBulletin, partnerChurchId, assignedTeamIds })");
  });
});
