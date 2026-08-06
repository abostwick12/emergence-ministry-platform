import type { AuthSession } from "@/lib/auth/server";
import type { ActiveTask, EventType, MinistryEvent, TaskStatus, User } from "@/lib/types";
import type { ResourceType } from "@/lib/resources/types";

export const platformEventTypes = [
  "sunday_morning_service",
  "sunday_evening_service",
  "middle_school_event",
  "high_school_event",
  "small_group_gathering",
  "missions_trip",
  "conference",
  "combined_event",
  "other"
] as const satisfies readonly EventType[];

export const platformTaskStatuses = ["todo", "in_progress", "blocked", "done"] as const satisfies readonly TaskStatus[];

export const platformResourceKinds = [
  "sermon_support",
  "leader_guide",
  "discussion_questions",
  "slide_plan",
  "activity",
  "devotional",
  "curriculum",
  "other"
] as const;

export type PlatformResourceKind = (typeof platformResourceKinds)[number];

export type PlatformEventSummary = Pick<
  MinistryEvent,
  "id" | "title" | "description" | "type" | "startTime" | "endTime" | "status" | "location" | "targetGroup" | "priority" | "contactOwnerId" | "notes"
> & { url: string };

export type PlatformTaskSummary = Pick<ActiveTask, "id" | "eventId" | "taskTitle" | "dueDate" | "assignedUserId" | "status" | "notes"> & {
  url: string;
};

export type PlatformTeamMember = Pick<User, "id" | "firstName" | "lastName" | "role">;

export type PlatformResourceSummary = {
  id: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  createdAt: string;
  reviewRequired: boolean;
  url: string;
};

export type CreatePlatformEventInput = {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startTime: string;
  endTime: string;
  location?: string;
  targetGroup?: string;
  priority?: string;
  contactOwnerId?: string;
};

export type UpdatePlatformEventInput = Partial<Pick<
  MinistryEvent,
  "title" | "description" | "type" | "startTime" | "endTime" | "status" | "location" | "targetGroup" | "priority" | "contactOwnerId" | "notes"
>>;

export type CreatePlatformTaskInput = {
  id: string;
  eventId: string;
  taskTitle: string;
  dueDate: string;
  assignedUserId: string;
  status?: TaskStatus;
};

export type UpdatePlatformTaskInput = Partial<Pick<ActiveTask, "taskTitle" | "dueDate" | "assignedUserId" | "status" | "notes">>;

export type CreatePlatformResourceBundleInput = {
  id: string;
  ministryId: string;
  userId: string;
  clientName: string;
  idempotencyKey: string;
  title: string;
  destinationType: "event" | "weekly_leader_prep";
  destinationId: string;
  privateDiscoveryStatus: "not_used" | "passed";
  privateDiscoveryProvenance: Array<{
    sourceReference: string;
    contentHash: string;
  }>;
  items: Array<{
    id: string;
    attachmentId: string;
    kind: PlatformResourceKind;
    title: string;
    bodyMarkdown: string;
    position: number;
  }>;
};

export type PlatformResourceBundleResult = {
  id: string;
  status: "review_required";
  emmaStatus: "not_reviewed";
  privateDiscoveryStatus: "not_used" | "passed";
  destinationType: "event" | "weekly_leader_prep";
  destinationId: string;
  itemIds: string[];
  attachmentIds: string[];
  url: string;
  idempotentReplay: boolean;
};

export interface PlatformMcpRepository {
  listEvents(session: AuthSession): Promise<PlatformEventSummary[]>;
  getEvent(session: AuthSession, eventId: string): Promise<(PlatformEventSummary & { tasks: PlatformTaskSummary[] }) | null>;
  listTasks(session: AuthSession, eventId?: string): Promise<PlatformTaskSummary[]>;
  listTeamMembers(session: AuthSession): Promise<PlatformTeamMember[]>;
  listResources(session: AuthSession, input: { destinationType: "event" | "weekly_leader_prep"; destinationId: string }): Promise<PlatformResourceSummary[]>;
  createEvent(session: AuthSession, input: CreatePlatformEventInput): Promise<PlatformEventSummary>;
  updateEvent(session: AuthSession, eventId: string, input: UpdatePlatformEventInput): Promise<PlatformEventSummary | null>;
  createTask(session: AuthSession, input: CreatePlatformTaskInput): Promise<PlatformTaskSummary>;
  updateTask(session: AuthSession, taskId: string, input: UpdatePlatformTaskInput): Promise<PlatformTaskSummary | null>;
  createResourceBundle(session: AuthSession, input: CreatePlatformResourceBundleInput): Promise<PlatformResourceBundleResult>;
}
