import type { AuthSession } from "@/lib/auth/server";
import { uid } from "@/lib/utils";
import {
  roleForSession,
  type VolunteerHubAction,
  type VolunteerHubAttendanceSnapshot,
  type VolunteerHubPayload,
  type VolunteerHubRole,
  type VolunteerHubState,
  type VolunteerHubVolunteer
} from "@/lib/volunteer-hub/types";

function daysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createInitialState(): VolunteerHubState {
  return {
    volunteers: [
      {
        id: "vol_andrew",
        userId: "usr_leader",
        name: "Andrew Walker",
        role: "leader",
        email: "andrew@lead-emergence.test",
        servingAreas: ["8th Grade Boys", "Sunday Morning"],
        availability: "Sundays at 9:00 AM and leader meetings",
        skills: ["Small groups", "Student follow-up", "Teaching"],
        backgroundCheckExpires: daysFromNow(120),
        preferredCommunication: "groupme",
        connectedServices: { planningCenter: true, groupMe: false, google: false }
      },
      {
        id: "vol_patrick",
        name: "Patrick Reed",
        role: "volunteer",
        email: "patrick@lead-emergence.test",
        servingAreas: ["8th Grade Boys"],
        availability: "Sundays at 9:00 AM",
        skills: ["Discussion", "Hospitality"],
        backgroundCheckExpires: daysFromNow(80),
        preferredCommunication: "text",
        connectedServices: { planningCenter: true, groupMe: false, google: false }
      },
      {
        id: "vol_maya",
        name: "Maya Chen",
        role: "director",
        email: "maya@lead-emergence.test",
        servingAreas: ["Volunteer Development", "Training"],
        availability: "Weekdays and monthly trainings",
        skills: ["Training", "Leader care", "Resource publishing"],
        backgroundCheckExpires: daysFromNow(200),
        preferredCommunication: "email",
        connectedServices: { planningCenter: true, groupMe: false, google: true }
      }
    ],
    students: [
      {
        id: "stu_jordan",
        preferredName: "Jordan",
        fullName: "Jordan Hayes",
        grade: "8th Grade",
        school: "Riverbend Middle",
        birthday: "August 14",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        followUpNeeded: true,
        followUpStatus: "assigned",
        prayerRequestIndicator: true,
        parentContactAvailable: true,
        planningCenterProfileUrl: "https://example.com/planning-center/jordan"
      },
      {
        id: "stu_micah",
        preferredName: "Micah",
        fullName: "Micah Allen",
        grade: "8th Grade",
        school: "Northview Middle",
        birthday: "September 2",
        attendanceStatus: "absent",
        lastAttended: daysFromNow(-14),
        consecutiveAbsences: 2,
        followUpNeeded: true,
        followUpStatus: "suggested",
        parentContactAvailable: true,
        planningCenterProfileUrl: "https://example.com/planning-center/micah"
      },
      {
        id: "stu_eli",
        preferredName: "Eli",
        fullName: "Eli Brooks",
        grade: "8th Grade",
        school: "Riverbend Middle",
        birthday: "October 21",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: false
      },
      {
        id: "stu_noah",
        preferredName: "Noah",
        fullName: "Noah Carter",
        grade: "8th Grade",
        school: "Hillside",
        birthday: "November 8",
        attendanceStatus: "guest",
        lastAttended: daysFromNow(-1),
        consecutiveAbsences: 0,
        firstTimeGuest: true,
        followUpNeeded: true,
        followUpStatus: "suggested",
        parentContactAvailable: false
      }
    ],
    smallGroups: [
      {
        id: "group_8th_boys",
        name: "8th Grade Boys",
        leaderId: "vol_andrew",
        coLeaderId: "vol_patrick",
        room: "Room 202",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_jordan", "stu_micah", "stu_eli", "stu_noah"],
        groupMeConnected: false
      },
      {
        id: "group_7th_girls",
        name: "7th Grade Girls",
        leaderId: "vol_maya",
        room: "Room 201",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: [],
        groupMeConnected: false
      },
      {
        id: "group_6th_grade",
        name: "6th Grade",
        leaderId: "vol_patrick",
        room: "Room 101",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: [],
        groupMeConnected: false
      },
      {
        id: "group_consolidated",
        name: "High School Boys - Consolidated",
        leaderId: "vol_andrew",
        room: "Room 204",
        serviceTime: "Wednesday - 6:30 PM",
        memberStudentIds: [],
        groupMeConnected: false,
        archivedAt: daysFromNow(-3),
        archiveReason: "Consolidated into grade-specific high school groups."
      }
    ],
    tasks: [
      { id: "task_guide", label: "Read Leader Guide", detail: "Review the Luke 10 flow before group starts.", completed: false, dueLabel: "Before Sunday" },
      { id: "task_audio", label: "Listen to Audio Overview", detail: "18 minute prep from the teaching team.", completed: true, dueLabel: "Before leader meeting" },
      { id: "task_followup", label: "Student Follow-up", detail: "Check in on students flagged by attendance.", completed: false, dueLabel: "Today" },
      { id: "task_meeting", label: "Leader Meeting", detail: "Arrive by 8:40 AM in the Student Center.", completed: false, dueLabel: "8:40 AM" },
      { id: "task_group", label: "Small Group", detail: "Lead discussion and note follow-up needs.", completed: false, dueLabel: "9:00 AM" }
    ],
    resources: [
      { id: "res_leader_guide", title: "The Battles We Face", type: "leader_guide", detail: "Week 3 leader guide for Luke 10.", estimatedMinutes: 8, completed: false, shareable: true },
      { id: "res_audio", title: "Audio Overview", type: "audio", detail: "Teaching-team audio summary with transcript.", estimatedMinutes: 18, completed: true, shareable: true },
      { id: "res_questions", title: "Discussion Questions", type: "discussion", detail: "Icebreaker, observation, application, and prayer prompts.", estimatedMinutes: 6, completed: false, shareable: true },
      { id: "res_notes", title: "Leader Notes", type: "notes", detail: "Common misconceptions and when to involve staff.", estimatedMinutes: 5, completed: false, shareable: false },
      { id: "res_parent", title: "Parent Resource", type: "parent", detail: "Preview-only family follow-up summary.", estimatedMinutes: 3, completed: false, shareable: true }
    ],
    trainingModules: [
      { id: "train_safety", title: "Child Safety Refresher", category: "Safety", required: true, completed: true, dueDate: daysFromNow(5) },
      { id: "train_followup", title: "Pastoral Follow-up Basics", category: "Student Care", required: true, completed: false, dueDate: daysFromNow(12) },
      { id: "train_discussion", title: "Discussion Coaching", category: "Teaching", required: false, completed: false, dueDate: daysFromNow(20) }
    ],
    onboardingItems: [
      { id: "on_application", label: "Application", completed: true, blocksStudentContact: true },
      { id: "on_background", label: "Background Check", completed: true, blocksStudentContact: true },
      { id: "on_policy", label: "Child Safety Policy", completed: true, blocksStudentContact: true },
      { id: "on_shadow", label: "Shadow Sunday", completed: false, blocksStudentContact: false },
      { id: "on_approval", label: "Director Approval", completed: false, blocksStudentContact: true }
    ],
    notifications: [
      { id: "note_training", label: "Training Due", detail: "Pastoral Follow-up Basics is due soon.", href: "#training", unread: true },
      { id: "note_resource", label: "Resource Updated", detail: "Leader notes were refreshed for this week.", href: "#resources", unread: true },
      { id: "note_student", label: "Follow-up Assigned", detail: "Micah has missed two weeks.", href: "#attendance", unread: true }
    ],
    chatMessages: [
      { id: "chat_seed", groupId: "group_8th_boys", senderName: "Maya Chen", body: "Preview only: leader guide is ready for Sunday.", createdAt: daysFromNow(-1), previewOnly: true, resourceId: "res_leader_guide" }
    ],
    followUps: [
      { id: "fu_jordan", studentId: "stu_jordan", volunteerId: "vol_andrew", note: "Ask how the new school rhythm is going.", status: "assigned", createdAt: daysFromNow(-1) }
    ],
    audit: [
      { id: "audit_seed", actorName: "Maya Chen", action: "Published weekly resources", target: "The Battles We Face", createdAt: daysFromNow(-2) }
    ]
  };
}

const globalStore = globalThis as typeof globalThis & {
  __leadVolunteerHubState?: VolunteerHubState;
};

function state() {
  if (!globalStore.__leadVolunteerHubState) {
    globalStore.__leadVolunteerHubState = createInitialState();
  }
  return globalStore.__leadVolunteerHubState;
}

export function resetVolunteerHubStateForTests() {
  globalStore.__leadVolunteerHubState = createInitialState();
}

export function getVolunteerHubPayload(
  session: AuthSession,
  integrations: VolunteerHubPayload["integrations"]
): VolunteerHubPayload {
  const current = state();
  const role = roleForSession(session);
  const activeVolunteer = resolveActiveVolunteer(current, session, role);
  const visibleActiveGroups = getVisibleActiveGroups(current, activeVolunteer, role);
  const activeGroup = visibleActiveGroups[0] ?? current.smallGroups.find((group) => !group.archivedAt)!;
  const students = current.students.filter((student) => activeGroup.memberStudentIds.includes(student.id));
  const followUps = current.followUps.filter((followUp) => students.some((student) => student.id === followUp.studentId));

  return {
    role,
    activeVolunteer,
    activeGroup,
    students,
    activeGroups: visibleActiveGroups,
    archivedGroups: role === "admin" || role === "director" || role === "leader" ? current.smallGroups.filter((group) => group.archivedAt) : [],
    volunteers: current.volunteers,
    tasks: current.tasks,
    resources: current.resources,
    trainingModules: current.trainingModules,
    onboardingItems: current.onboardingItems,
    notifications: current.notifications,
    chatMessages: current.chatMessages.filter((message) => message.groupId === activeGroup.id),
    followUps,
    attendance: summarizeAttendance(students),
    audit: current.audit.slice(0, 20),
    integrations
  };
}

export function applyVolunteerHubAction(session: AuthSession, action: VolunteerHubAction) {
  const current = state();
  const actor = resolveActiveVolunteer(current, session, roleForSession(session));

  switch (action.type) {
    case "complete_task": {
      const task = current.tasks.find((item) => item.id === action.taskId);
      if (!task) throw new Error("Task not found.");
      task.completed = action.completed ?? true;
      audit(current, actor, task.completed ? "Completed task" : "Reopened task", task.label);
      break;
    }
    case "review_attendance": {
      const student = current.students.find((item) => item.id === action.studentId);
      if (!student) throw new Error("Student not found.");
      student.followUpNeeded = false;
      student.followUpStatus = "completed";
      audit(current, actor, "Reviewed attendance follow-up", student.preferredName);
      break;
    }
    case "add_follow_up": {
      const student = current.students.find((item) => item.id === action.studentId);
      if (!student) throw new Error("Student not found.");
      if (!action.note.trim()) throw new Error("Follow-up note is required.");
      student.followUpNeeded = true;
      student.followUpStatus = "assigned";
      current.followUps.unshift({
        id: uid("fu"),
        studentId: student.id,
        volunteerId: actor.id,
        note: action.note.trim(),
        status: "assigned",
        createdAt: new Date().toISOString()
      });
      audit(current, actor, "Assigned student follow-up", student.preferredName);
      break;
    }
    case "complete_resource": {
      const resource = current.resources.find((item) => item.id === action.resourceId);
      if (!resource) throw new Error("Resource not found.");
      resource.completed = action.completed ?? true;
      audit(current, actor, resource.completed ? "Completed resource" : "Reopened resource", resource.title);
      break;
    }
    case "complete_training": {
      const trainingModule = current.trainingModules.find((item) => item.id === action.moduleId);
      if (!trainingModule) throw new Error("Training module not found.");
      trainingModule.completed = action.completed ?? true;
      audit(current, actor, trainingModule.completed ? "Completed training" : "Reopened training", trainingModule.title);
      break;
    }
    case "update_onboarding": {
      const item = current.onboardingItems.find((entry) => entry.id === action.itemId);
      if (!item) throw new Error("Onboarding item not found.");
      item.completed = action.completed ?? !item.completed;
      audit(current, actor, item.completed ? "Completed onboarding item" : "Reopened onboarding item", item.label);
      break;
    }
    case "update_profile": {
      if (action.availability?.trim()) actor.availability = action.availability.trim();
      if (action.preferredCommunication) actor.preferredCommunication = action.preferredCommunication;
      audit(current, actor, "Updated volunteer profile", actor.name);
      break;
    }
    case "preview_chat_message": {
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      if (!action.body.trim()) throw new Error("Message body is required.");
      current.chatMessages.unshift({
        id: uid("chat"),
        groupId: group.id,
        senderName: actor.name,
        body: action.body.trim(),
        resourceId: action.resourceId,
        createdAt: new Date().toISOString(),
        previewOnly: true
      });
      audit(current, actor, "Previewed GroupMe message", group.name);
      break;
    }
    case "archive_group": {
      requireDirector(actor);
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      group.archivedAt = new Date().toISOString();
      group.archiveReason = action.reason?.trim() || "Archived after small group consolidation.";
      audit(current, actor, "Archived small group", group.name);
      break;
    }
    case "restore_group": {
      requireDirector(actor);
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      group.archivedAt = undefined;
      group.archiveReason = undefined;
      audit(current, actor, "Restored small group", group.name);
      break;
    }
    case "add_leader": {
      requireDirector(actor);
      if (!action.name.trim()) throw new Error("Leader name is required.");
      const leader: VolunteerHubVolunteer = {
        id: uid("vol"),
        name: action.name.trim(),
        role: "volunteer",
        email: action.email?.trim() || `${action.name.trim().toLowerCase().replace(/\s+/g, ".")}@lead-emergence.local`,
        servingAreas: [action.role?.trim() || "Small Groups"],
        availability: "Availability not set",
        skills: [action.role?.trim() || "Small group leader"],
        backgroundCheckExpires: daysFromNow(90),
        preferredCommunication: "email",
        connectedServices: { planningCenter: false, groupMe: false, google: false }
      };
      current.volunteers.push(leader);
      audit(current, actor, "Added volunteer leader", leader.name);
      break;
    }
    case "delete_leader": {
      requireDirector(actor);
      const leader = current.volunteers.find((item) => item.id === action.volunteerId);
      if (!leader) throw new Error("Volunteer leader not found.");
      if (leader.role === "admin" || leader.role === "director") throw new Error("Director and admin leaders cannot be removed here.");
      current.smallGroups.forEach((group) => {
        if (group.leaderId === leader.id) group.leaderId = "vol_maya";
        if (group.coLeaderId === leader.id) group.coLeaderId = undefined;
      });
      current.volunteers = current.volunteers.filter((item) => item.id !== leader.id);
      audit(current, actor, "Removed volunteer leader", leader.name);
      break;
    }
    default:
      assertNever(action);
  }
}

function resolveActiveVolunteer(stateValue: VolunteerHubState, session: AuthSession, role: VolunteerHubRole) {
  if (role === "admin") return stateValue.volunteers.find((volunteer) => volunteer.role === "director") ?? stateValue.volunteers[0];
  const byUser = stateValue.volunteers.find((volunteer) => volunteer.userId === session.user.id);
  return byUser ?? stateValue.volunteers.find((volunteer) => volunteer.id === "vol_andrew") ?? stateValue.volunteers[0];
}

function getVisibleActiveGroups(stateValue: VolunteerHubState, activeVolunteer: VolunteerHubVolunteer, role: VolunteerHubRole) {
  const activeGroups = stateValue.smallGroups.filter((group) => !group.archivedAt);
  if (role === "admin" || role === "director") return activeGroups;
  return activeGroups.filter((group) => group.leaderId === activeVolunteer.id || group.coLeaderId === activeVolunteer.id);
}

function summarizeAttendance(students: Array<{ attendanceStatus: string; followUpNeeded?: boolean }>): VolunteerHubAttendanceSnapshot {
  const assigned = students.length;
  const present = students.filter((student) => student.attendanceStatus === "present").length;
  const absent = students.filter((student) => student.attendanceStatus === "absent").length;
  const guests = students.filter((student) => student.attendanceStatus === "guest").length;
  const needFollowUp = students.filter((student) => student.followUpNeeded).length;
  return {
    assigned,
    present,
    absent,
    guests,
    needFollowUp,
    attendancePercent: assigned ? Math.round((present / assigned) * 100) : 0
  };
}

function audit(stateValue: VolunteerHubState, actor: VolunteerHubVolunteer, action: string, target: string) {
  stateValue.audit.unshift({
    id: uid("audit"),
    actorName: actor.name,
    action,
    target,
    createdAt: new Date().toISOString()
  });
}

function requireDirector(actor: VolunteerHubVolunteer) {
  if (actor.role !== "admin" && actor.role !== "director" && actor.role !== "leader") {
    throw new Error("Director-level Volunteer Hub access is required.");
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Volunteer Hub action: ${JSON.stringify(value)}`);
}
