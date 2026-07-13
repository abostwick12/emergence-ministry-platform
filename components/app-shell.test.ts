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

    expect(navigation.primaryLinks).toEqual([
      { href: "/student", label: "Student Portal" },
      { href: "/student/scripture/questions", label: "Journey Journal" },
      { href: "/student/scripture/resources", label: "Scripture" },
      { href: "/student/scripture/plans", label: "Plans" },
      { href: "/student/scripture/how-to-read", label: "How to Read" }
    ]);
    expect(navigation.mobileLinks).toEqual([
      { href: "/student", label: "Student Portal" },
      { href: "/student/scripture/questions", label: "Journey Journal" },
      { href: "/student/scripture/resources", label: "Scripture" },
      { href: "/student/scripture/plans", label: "Plans" }
    ]);
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
      "/events",
      "/student",
      "/student/scripture/questions",
      "/discipleship",
      "/camp",
      "/worship",
      "/tasks",
      "/communications",
      "/people",
      "/budget",
      "/settings",
      "/command-center"
    ]);
  });
});
