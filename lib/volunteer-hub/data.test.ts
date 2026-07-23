import { beforeEach, describe, expect, it } from "vitest";
import { applyVolunteerHubAction, getVolunteerHubPayload, resetVolunteerHubStateForTests } from "@/lib/volunteer-hub/data";
import type { AuthSession } from "@/lib/auth/server";
import type { VolunteerHubIntegrationStatus } from "@/lib/volunteer-hub/types";

const session: AuthSession = {
  isMock: true,
  user: { id: "usr_leader", email: "leader@example.test", fullName: "Andrew Walker", role: "leader" }
};

const integrations: VolunteerHubIntegrationStatus = {
  planningCenter: { displayStatus: "connected", peopleCount: 4, attendanceCount: 3 },
  groupMe: { configured: true, displayStatus: "disconnected", connectedGroupCount: 0, message: "Not connected." }
};

describe("Volunteer Hub data", () => {
  beforeEach(() => {
    resetVolunteerHubStateForTests();
  });

  it("filters archived small groups out of active volunteer payloads", async () => {
    const payload = await getVolunteerHubPayload(session, integrations);

    expect(payload.dataSource).toBe("mock");
    expect(payload.activeGroups.some((group) => group.archivedAt)).toBe(false);
    expect(payload.archivedGroups).toHaveLength(1);
    expect(payload.activeGroup.name).toBe("8th Grade Boys");
    expect(payload.volunteers.map((volunteer) => volunteer.role)).not.toContain("director");
  });

  it("archives and restores small groups without deleting audit history", async () => {
    applyVolunteerHubAction(session, { type: "archive_group", groupId: "group_8th_boys", reason: "Consolidated with middle school group." });
    let payload = await getVolunteerHubPayload(session, integrations);

    expect(payload.activeGroups.find((group) => group.id === "group_8th_boys")).toBeUndefined();
    expect(payload.archivedGroups.find((group) => group.id === "group_8th_boys")?.archiveReason).toBe("Consolidated with middle school group.");
    expect(payload.audit[0]).toMatchObject({ action: "Archived small group", target: "8th Grade Boys" });

    applyVolunteerHubAction(session, { type: "restore_group", groupId: "group_8th_boys" });
    payload = await getVolunteerHubPayload(session, integrations);

    expect(payload.activeGroups.find((group) => group.id === "group_8th_boys")).toBeTruthy();
    expect(payload.audit[0]).toMatchObject({ action: "Restored small group", target: "8th Grade Boys" });
  });

  it("updates attendance follow-up and task/resource progress", async () => {
    applyVolunteerHubAction(session, { type: "review_attendance", studentId: "stu_micah" });
    applyVolunteerHubAction(session, { type: "complete_task", taskId: "task_followup" });
    applyVolunteerHubAction(session, { type: "complete_resource", resourceId: "res_questions" });

    const payload = await getVolunteerHubPayload(session, integrations);

    expect(payload.students.find((student) => student.id === "stu_micah")?.followUpNeeded).toBe(false);
    expect(payload.tasks.find((task) => task.id === "task_followup")?.completed).toBe(true);
    expect(payload.resources.find((resource) => resource.id === "res_questions")?.completed).toBe(true);
  });

  it("logs preview-only chat messages and follow-up assignments", async () => {
    applyVolunteerHubAction(session, { type: "preview_chat_message", groupId: "group_8th_boys", body: "Please read the guide.", resourceId: "res_leader_guide" });
    applyVolunteerHubAction(session, { type: "add_follow_up", studentId: "stu_jordan", note: "Ask about school." });

    const payload = await getVolunteerHubPayload(session, integrations);

    expect(payload.chatMessages[0]).toMatchObject({ body: "Please read the guide.", previewOnly: true, resourceId: "res_leader_guide" });
    expect(payload.followUps[0]).toMatchObject({ studentId: "stu_jordan", note: "Ask about school.", status: "assigned" });
    expect(payload.audit[0].action).toBe("Assigned student follow-up");
  });

  it("creates groups and moves a student to one managed roster", async () => {
    applyVolunteerHubAction(session, {
      type: "create_group",
      name: "9th Grade Boys",
      leaderId: "vol_andrew",
      room: "Room 210",
      serviceTime: "Sunday - 10:30 AM",
      memberStudentIds: ["stu_jordan"]
    });
    let payload = await getVolunteerHubPayload(session, integrations);
    const created = payload.activeGroups.find((group) => group.name === "9th Grade Boys");
    expect(created).toMatchObject({ room: "Room 210", memberStudentIds: ["stu_jordan"] });
    expect(payload.activeGroups.find((group) => group.id === "group_8th_boys")?.memberStudentIds).not.toContain("stu_jordan");

    applyVolunteerHubAction(session, {
      type: "update_group",
      groupId: "group_8th_boys",
      memberStudentIds: ["stu_jordan", "stu_micah"]
    });
    payload = await getVolunteerHubPayload(session, integrations);
    expect(payload.activeGroups.find((group) => group.id === "group_8th_boys")?.memberStudentIds).toEqual(["stu_jordan", "stu_micah"]);
    expect(payload.activeGroups.find((group) => group.id === created?.id)?.memberStudentIds).not.toContain("stu_jordan");
  });

  it("does not seed demo content for registered live sessions", async () => {
    const payload = await getVolunteerHubPayload(
      { isMock: false, user: { id: "real-user-1", email: "real@example.com", fullName: "Real Leader", role: "leader" } },
      { ...integrations, planningCenter: { displayStatus: "connected", peopleCount: 60, attendanceCount: 0 } }
    );

    expect(payload.dataSource).toBe("live");
    expect(payload.activeVolunteer.name).toBe("Real Leader");
    expect(payload.students).toHaveLength(0);
    expect(payload.tasks).toHaveLength(0);
    expect(payload.resources).toHaveLength(0);
    expect(payload.notifications).toHaveLength(0);
    expect(payload.audit).toHaveLength(0);
    expect(payload.activeGroup.name).toBe("Volunteer Hub setup");
  });
});
