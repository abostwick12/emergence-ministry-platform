import { describe, expect, it } from "vitest";

import { getAppShellNavigation } from "@/components/app-shell";

describe("app shell navigation", () => {
  it("limits student sessions to the Student Portal navigation", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: true,
      showCommandCenter: true,
      showLeaderDiscipleship: true,
      showStudentPortal: true
    });

    expect(navigation.primaryLinks).toEqual([{ href: "/student", label: "Student Portal" }]);
    expect(navigation.mobileLinks).toEqual([{ href: "/student", label: "Student Portal" }]);
    expect(navigation.mobileMoreLinks).toEqual([]);
  });

  it("keeps full ministry navigation for admin and leader sessions", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: true,
      showLeaderDiscipleship: true,
      showStudentPortal: true
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/camp",
      "/events",
      "/worship",
      "/student",
      "/tasks",
      "/communications",
      "/people",
      "/budget",
      "/settings",
      "/discipleship",
      "/command-center"
    ]);
  });
});
