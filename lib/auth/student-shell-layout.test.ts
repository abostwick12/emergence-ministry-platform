import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("student shell layout wiring", () => {
  it("passes the resolved role into AppShell so real student sessions get student-only navigation", () => {
    const source = readFileSync(join(process.cwd(), "app/student/layout.tsx"), "utf8");

    expect(source).toContain("sessionRole={access.role}");
    expect(source).toContain('const isStudentSession = access.role === "student";');
  });

  it("does not run staff-only shell checks for student sessions on every student page navigation", () => {
    const source = readFileSync(join(process.cwd(), "app/student/layout.tsx"), "utf8");

    expect(source).toContain('const shellAccess = { kind: "full" as const };');
    expect(source).not.toContain("resolveAppShellAccess(access.session)");
    expect(source).toContain("showCommandCenter={!isStudentSession && isCommandCenterUser(access.session)}");
  });
});
