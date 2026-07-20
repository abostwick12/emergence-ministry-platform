import { describe, expect, it } from "vitest";

import { getAppShellNavigation } from "@/lib/app-shell-navigation";

describe("volunteer hub navigation", () => {
  it("hides Command Center from Volunteer Hub navigation contexts", () => {
    for (const pathname of ["/people", "/directors/volunteers"]) {
      const navigation = getAppShellNavigation({
        campOnly: false,
        isStudentShell: false,
        showCommandCenter: true,
        showLeaderDiscipleship: true,
        showStudentPortal: true,
        pathname
      });

      expect(navigation.primaryLinks.map((link) => link.href)).not.toContain("/command-center");
    }
  });

  it("includes director volunteer monitoring in the Volunteer Hub context", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: false,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/people"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/people",
      "/directors/volunteers"
    ]);
  });

  it("keeps direct Command Center navigation available outside Volunteer Hub contexts", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: true,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/command-center"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toContain("/command-center");
  });
});
