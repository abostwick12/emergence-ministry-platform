import { describe, expect, it } from "vitest";

import { getAppShellNavigation } from "@/lib/app-shell-navigation";

describe("app shell navigation", () => {
  it("limits student sessions to the Student Portal navigation", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: true,
      showCommandCenter: true,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/student"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/student",
      "/student/scripture/questions",
      "/student/scripture/resources",
      "/student/scripture/plans",
      "/student/scripture/how-to-read"
    ]);
    expect(navigation.mobileLinks.map((link) => link.href)).toEqual([
      "/student",
      "/student/scripture/questions",
      "/student/scripture/resources",
      "/student/scripture/plans"
    ]);
    expect(navigation.mobileMoreLinks).toEqual([]);
  });

  it("shows portal groups from the main dashboard for admin and leader sessions", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: true,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/dashboard"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/ministry",
      "/student",
      "/people",
      "/directors",
      "/camp",
      "/settings",
      "/command-center"
    ]);
  });

  it("uses the ministry hub menu inside ministry operations routes", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: false,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/events"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/ministry",
      "/events",
      "/worship",
      "/tasks",
      "/communications",
      "/budget"
    ]);
  });

  it("uses the directors hub menu inside director routes", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: false,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/leader-prep"
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/directors",
      "/leader-prep",
      "/directors/resources",
      "/discipleship",
      "/directors/volunteers"
    ]);
  });

  it("uses the volunteer hub menu on the People route", () => {
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
      "/people"
    ]);
  });

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

  it("filters contextual links by visible page access", () => {
    const navigation = getAppShellNavigation({
      campOnly: false,
      isStudentShell: false,
      showCommandCenter: false,
      showLeaderDiscipleship: true,
      showStudentPortal: true,
      pathname: "/events",
      visiblePageKeys: ["dashboard", "ministry_hub", "events", "tasks"]
    });

    expect(navigation.primaryLinks.map((link) => link.href)).toEqual([
      "/dashboard",
      "/ministry",
      "/events",
      "/tasks"
    ]);
  });
});
