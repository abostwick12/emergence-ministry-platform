export type VolunteerLeader = {
  id: string;
  name: string;
  role: string;
  email?: string;
  profilePhotoUrl?: string;
  sourceChurch?: string;
};

export type EventLeaderAssignments = Record<string, string[]>;

const CUSTOM_LEADERS_KEY = "lead-emergence.volunteer-hub.custom-leaders.v1";
const DELETED_LEADERS_KEY = "lead-emergence.volunteer-hub.deleted-leaders.v1";
const EVENT_ASSIGNMENTS_KEY = "lead-emergence.volunteer-hub.event-leader-assignments.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadCustomVolunteerLeaders() {
  return readJson<VolunteerLeader[]>(CUSTOM_LEADERS_KEY, []);
}

export function saveCustomVolunteerLeaders(leaders: VolunteerLeader[]) {
  writeJson(CUSTOM_LEADERS_KEY, leaders);
}

export function loadDeletedVolunteerLeaderIds() {
  return readJson<string[]>(DELETED_LEADERS_KEY, []);
}

export function saveDeletedVolunteerLeaderIds(ids: string[]) {
  writeJson(DELETED_LEADERS_KEY, ids);
}

export function loadEventLeaderAssignments() {
  return readJson<EventLeaderAssignments>(EVENT_ASSIGNMENTS_KEY, {});
}

export function saveEventLeaderAssignments(assignments: EventLeaderAssignments) {
  writeJson(EVENT_ASSIGNMENTS_KEY, assignments);
}

export function mergeVolunteerLeaders(baseLeaders: VolunteerLeader[], customLeaders: VolunteerLeader[], deletedLeaderIds: string[]) {
  const deleted = new Set(deletedLeaderIds);
  const byId = new Map<string, VolunteerLeader>();
  for (const leader of [...baseLeaders, ...customLeaders]) {
    if (!deleted.has(leader.id)) byId.set(leader.id, leader);
  }
  return Array.from(byId.values()).sort((first, second) => first.name.localeCompare(second.name));
}

export function removeLeaderFromAssignments(assignments: EventLeaderAssignments, leaderId: string) {
  return Object.fromEntries(
    Object.entries(assignments).map(([eventId, leaderIds]) => [eventId, leaderIds.filter((id) => id !== leaderId)])
  );
}

export function createLocalLeaderId(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "leader";
  return `local-leader-${slug}-${Date.now().toString(36)}`;
}

