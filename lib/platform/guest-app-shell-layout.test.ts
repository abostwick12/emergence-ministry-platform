import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("guest app shell layout wiring", () => {
  it("keeps guest route access and navigation visibility delegated to platform access helpers", () => {
    const source = readFileSync(join(process.cwd(), "app/(app)/layout.tsx"), "utf8");

    expect(source).toContain("resolvePageAccessForSession(session, pathname)");
    expect(source).toContain("visiblePlatformPagesForSession(session)");
    expect(source).toContain("redirect(session.isGuest ? \"/\" : \"/dashboard\")");
  });
});
