import type { AuthSession } from "@/lib/auth/server";

export type VolunteerHubRole = "volunteer" | "leader" | "director" | "admin";
export type VolunteerHubDataSource = "live" | "guest_demo" | "mock";
export type VolunteerHubStudentSource = "planning_center" | "camp_clc" | "demo";

export type VolunteerHubStudent = {
  id: string;
  source?: VolunteerHubStudentSource;
  preferredName: string;
  fullName: string;
  profilePhotoUrl?: string;
  grade: string;
  school: string;
  birthday: string;
  teamId?: string;
  teamName?: string;
  cabin?: string;
  vehicleName?: string;
  safeIndicators?: string[];
  attendanceStatus: "present" | "absent" | "guest" | "pending";
  lastAttended: string;
  consecutiveAbsences: number;
  firstTimeGuest?: boolean;
  followUpNeeded?: boolean;
  followUpStatus?: "suggested" | "assigned" | "completed";
  prayerRequestIndicator?: boolean;
  parentContactAvailable?: boolean;
  planningCenterProfileUrl?: string;
};

export type VolunteerHubTask = {
  id: string;
  label: string;
  detail: string;
  completed: boolean;
  dueLabel: string;
};

export type VolunteerHubResource = {
  id: string;
  title: string;
  type: "leader_guide" | "audio" | "discussion" | "notes" | "parent" | "student" | "slides";
  detail: string;
  estimatedMinutes: number;
  completed: boolean;
  shareable: boolean;
};

export type VolunteerHubTrainingModule = {
  id: string;
  title: string;
  category: string;
  required: boolean;
  completed: boolean;
  dueDate: string;
};

export type VolunteerHubOnboardingItem = {
  id: string;
  label: string;
  completed: boolean;
  blocksStudentContact: boolean;
};

export type VolunteerHubVolunteer = {
  id: string;
  userId?: string;
  name: string;
  role: VolunteerHubRole;
  email: string;
  profilePhotoUrl?: string;
  sourceChurch?: string;
  servingAreas: string[];
  availability: string;
  skills: string[];
  backgroundCheckExpires: string;
  preferredCommunication: "email" | "text" | "groupme";
  connectedServices: {
    planningCenter: boolean;
    groupMe: boolean;
    google: boolean;
  };
};

export type VolunteerHubSmallGroup = {
  id: string;
  name: string;
  leaderId: string;
  coLeaderId?: string;
  room: string;
  serviceTime: string;
  memberStudentIds: string[];
  groupMeConnected: boolean;
  archivedAt?: string;
  archiveReason?: string;
};

export type VolunteerHubAttendanceSnapshot = {
  assigned: number;
  present: number;
  absent: number;
  guests: number;
  needFollowUp: number;
  attendancePercent: number;
};

export type VolunteerHubNotification = {
  id: string;
  label: string;
  detail: string;
  href: string;
  unread: boolean;
};

export type VolunteerHubChatMessage = {
  id: string;
  groupId: string;
  senderName: string;
  body: string;
  createdAt: string;
  previewOnly: boolean;
  resourceId?: string;
};

export type VolunteerHubFollowUp = {
  id: string;
  studentId: string;
  volunteerId: string;
  note: string;
  status: "assigned" | "completed";
  createdAt: string;
};

export type VolunteerHubAuditEntry = {
  id: string;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};

export type VolunteerHubIntegrationStatus = {
  planningCenter: {
    displayStatus: string;
    peopleCount: number;
    attendanceCount: number;
    lastSyncAt?: string;
  };
  groupMe: {
    displayStatus: "preview_only" | "not_connected";
    message: string;
  };
};

export type VolunteerHubState = {
  volunteers: VolunteerHubVolunteer[];
  students: VolunteerHubStudent[];
  smallGroups: VolunteerHubSmallGroup[];
  tasks: VolunteerHubTask[];
  resources: VolunteerHubResource[];
  trainingModules: VolunteerHubTrainingModule[];
  onboardingItems: VolunteerHubOnboardingItem[];
  notifications: VolunteerHubNotification[];
  chatMessages: VolunteerHubChatMessage[];
  followUps: VolunteerHubFollowUp[];
  audit: VolunteerHubAuditEntry[];
};

export type VolunteerHubPayload = {
  dataSource: VolunteerHubDataSource;
  readOnlyReason?: string;
  role: VolunteerHubRole;
  activeVolunteer: VolunteerHubVolunteer;
  activeGroup: VolunteerHubSmallGroup;
  students: VolunteerHubStudent[];
  studentRoster: VolunteerHubStudent[];
  studentRosterSource: {
    planningCenterCount: number;
    campClcCount: number;
  };
  activeGroups: VolunteerHubSmallGroup[];
  archivedGroups: VolunteerHubSmallGroup[];
  volunteers: VolunteerHubVolunteer[];
  tasks: VolunteerHubTask[];
  resources: VolunteerHubResource[];
  trainingModules: VolunteerHubTrainingModule[];
  onboardingItems: VolunteerHubOnboardingItem[];
  notifications: VolunteerHubNotification[];
  chatMessages: VolunteerHubChatMessage[];
  followUps: VolunteerHubFollowUp[];
  attendance: VolunteerHubAttendanceSnapshot;
  audit: VolunteerHubAuditEntry[];
  integrations: VolunteerHubIntegrationStatus;
};

export type VolunteerHubAction =
  | { type: "complete_task"; taskId: string; completed?: boolean }
  | { type: "review_attendance"; studentId: string }
  | { type: "add_follow_up"; studentId: string; note: string }
  | { type: "complete_resource"; resourceId: string; completed?: boolean }
  | { type: "complete_training"; moduleId: string; completed?: boolean }
  | { type: "update_onboarding"; itemId: string; completed?: boolean }
  | { type: "update_profile"; availability?: string; preferredCommunication?: VolunteerHubVolunteer["preferredCommunication"] }
  | { type: "preview_chat_message"; groupId: string; body: string; resourceId?: string }
  | { type: "archive_group"; groupId: string; reason?: string }
  | { type: "restore_group"; groupId: string }
  | { type: "update_group"; groupId: string; leaderId?: string; coLeaderId?: string; room?: string }
  | { type: "add_leader"; name: string; email?: string; role?: string; sourceChurch?: string; profilePhotoUrl?: string }
  | { type: "delete_leader"; volunteerId: string };

export function roleForSession(session: AuthSession): VolunteerHubRole {
  const role = session.user.role.trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "leader" || session.isGuest) return "leader";
  return "volunteer";
}
