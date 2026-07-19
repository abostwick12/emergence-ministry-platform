import { isSupabaseAdminConfigured, getSupabaseAdminClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";
import * as mockStore from "@/lib/store";
import { normalizeEventType } from "@/lib/event-categories";
import type { ActiveTask, ActivityLog, EventExpense, EventType, MinistryEvent, Role, TaskStatus, User } from "@/lib/types";
import type { MinistryIntelligenceData } from "@/lib/daily-intelligence/types";

type ProfileRow = {
  id: string;
  ministry_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type EventRow = {
  id: string;
  ministry_id: string | null;
  title: string;
  ministry_area: string | null;
  description: string | null;
  vision: string | null;
  target_group: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  owner: string | null;
  status: string | null;
  priority: string | null;
  budget_target: number | null;
  budget_actual: number | null;
  volunteers_needed: number | null;
  communication_owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  ministry_id: string | null;
  event_id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: string | null;
  critical: boolean | null;
};

type ActivityRow = {
  id: string;
  ministry_id: string | null;
  event_id: string | null;
  task_id: string | null;
  action: string;
  actor_id: string | null;
  created_at: string;
};

export async function getMinistryIntelligenceData(): Promise<MinistryIntelligenceData> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return getMockMinistryIntelligenceData();

  const supabase = getSupabaseAdminClient();
  const [profiles, events, tasks, activity] = await Promise.all([
    supabase.from("profiles").select("id,ministry_id,email,full_name,role").order("created_at", { ascending: true }).returns<ProfileRow[]>(),
    supabase
      .from("events")
      .select(
        "id,ministry_id,title,ministry_area,description,vision,target_group,start_date,end_date,start_time,end_time,location,owner,status,priority,budget_target,budget_actual,volunteers_needed,communication_owner,notes,created_at,updated_at"
      )
      .order("start_date", { ascending: true })
      .returns<EventRow[]>(),
    supabase.from("tasks").select("id,ministry_id,event_id,title,owner,due_date,status,critical").order("due_date", { ascending: true }).returns<TaskRow[]>(),
    supabase
      .from("activity_logs")
      .select("id,ministry_id,event_id,task_id,action,actor_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<ActivityRow[]>()
  ]);

  throwIfSupabaseError(profiles.error);
  throwIfSupabaseError(events.error);
  throwIfSupabaseError(tasks.error);
  throwIfSupabaseError(activity.error);

  const users = toUsers(profiles.data ?? []);
  const eventRows = events.data ?? [];
  return {
    ministryId: eventRows[0]?.ministry_id ?? users[0]?.ministryId,
    events: eventRows.map((event) => toEvent(event, users)),
    tasks: (tasks.data ?? []).map((task) => toTask(task)),
    users,
    expenses: toExpenses(eventRows),
    communications: [],
    integrationLogs: [],
    activity: (activity.data ?? []).map(toActivity)
  };
}

function getMockMinistryIntelligenceData(): MinistryIntelligenceData {
  const events = mockStore.listEvents();
  const workspaces = events.flatMap((event) => mockStore.getWorkspace(event.id) ?? []);
  return {
    ministryId: DEFAULT_MINISTRY_ID,
    events,
    tasks: mockStore.listTasks(),
    users: mockStore.listUsers(),
    expenses: mockStore.listExpenses(),
    communications: workspaces.flatMap((workspace) => workspace.communications),
    integrationLogs: workspaces.flatMap((workspace) => workspace.integrationLogs),
    activity: mockStore.listActivity()
  };
}

function toUsers(rows: ProfileRow[]): User[] {
  return rows.map((row) => {
    const [firstName, ...lastName] = (row.full_name?.trim() || row.email || "Staff Member").split(" ");
    return {
      id: row.id,
      ministryId: row.ministry_id ?? undefined,
      firstName: firstName || "Staff",
      lastName: lastName.join(" "),
      email: row.email ?? "",
      role: toRole(row.role)
    };
  });
}

function toEvent(row: EventRow, users: User[]): MinistryEvent {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    title: row.title,
    description: row.description ?? row.vision ?? "",
    type: toEventType(row.ministry_area),
    startTime: fromDateAndTime(row.start_date, row.start_time),
    endTime: fromDateAndTime(row.end_date ?? row.start_date, row.end_time ?? row.start_time),
    status: row.status === "completed" ? "completed" : "planning",
    location: row.location ?? undefined,
    targetGroup: row.target_group ?? undefined,
    budgetTarget: row.budget_target ?? undefined,
    budgetActual: row.budget_actual ?? 0,
    volunteersNeeded: row.volunteers_needed ?? undefined,
    priority: row.priority ?? "normal",
    registrationDeadline: undefined,
    contactOwnerId: toOwnerId(row.communication_owner ?? row.owner, users),
    autoGeneratedTimeline: [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at
  };
}

function toTask(row: TaskRow): ActiveTask {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    eventId: row.event_id,
    taskTitle: row.title,
    dueDate: row.due_date ? `${row.due_date}T12:00:00.000Z` : new Date().toISOString(),
    assignedUserId: row.owner ?? "",
    status: toTaskStatus(row.status),
    autoGenerated: true,
    timelineOffsetDays: row.critical ? -30 : 0,
    notes: undefined
  };
}

function toActivity(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    eventId: row.event_id ?? undefined,
    taskId: row.task_id ?? undefined,
    actorId: row.actor_id ?? "",
    type: "task_edited",
    message: row.action,
    metadata: {},
    timestamp: row.created_at
  };
}

function toExpenses(rows: EventRow[]): EventExpense[] {
  return rows
    .filter((row) => Number(row.budget_actual ?? 0) > 0)
    .map((row) => ({
      id: `budget_actual_${row.id}`,
      eventId: row.id,
      categoryId: "budget_actual",
      amount: Number(row.budget_actual ?? 0),
      description: "Budget actual from event record",
      timestamp: row.updated_at
    }));
}

function toOwnerId(value: string | null | undefined, users: User[]) {
  if (!value) return undefined;
  return users.find((user) => user.id === value || user.email === value || `${user.firstName} ${user.lastName}` === value)?.id ?? value;
}

function toRole(value?: string | null): Role {
  if (value === "admin" || value === "leader" || value === "student" || value === "parent") return value;
  return value === "staff" ? "admin" : "leader";
}

function toEventType(value?: string | null): EventType {
  return normalizeEventType(value);
}

function toTaskStatus(value?: string | null): TaskStatus {
  if (value === "todo" || value === "in_progress" || value === "blocked" || value === "done") return value;
  return "todo";
}

function fromDateAndTime(date?: string | null, time?: string | null) {
  if (!date) return new Date().toISOString();
  const normalizedTime = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time || "12:00:00";
  return new Date(`${date}T${normalizedTime}`).toISOString();
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
