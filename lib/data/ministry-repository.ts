import { integrationAdapters } from "@/lib/adapters/integrations";
import { getMissingInformation } from "@/lib/missing-info";
import { defaultTemplateTasks } from "@/lib/templates";
import { normalizeEventType } from "@/lib/event-categories";
import { applyTaskDerivedEventStatuses, deriveEventStatusFromTaskStatuses } from "@/lib/ministry/event-status";
import type {
  ActiveTask,
  ActivityLog,
  CommunicationPackage,
  EventExpense,
  EventType,
  EventWorkspace,
  IntegrationSyncLog,
  MinistryEvent,
  Role,
  TaskStatus,
  User
} from "@/lib/types";
import { addDays, uid } from "@/lib/utils";
import type { AuthSession } from "@/lib/auth/server";
import { resolvePersonName } from "@/lib/auth/display-name";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { measureServerOperation } from "@/lib/performance/timing";
import { getPlatformDataAccessModeForSession } from "@/lib/platform/access-admin";
import { normalizePlatformRole } from "@/lib/platform/roles";
import { syncPlatformEventToGoogle } from "@/lib/integrations/google-demo/repository";
import * as mockStore from "@/lib/store";
import {
  addGuestExpense,
  createGuestEvent,
  createGuestTask,
  deleteGuestEvent,
  deleteGuestTask,
  generateGuestCommunicationPreview,
  getGuestOverview,
  getGuestWorkspace,
  runGuestIntegrationStub,
  updateGuestEvent,
  updateGuestTask
} from "@/lib/guest/sandbox-store";

// Builds an optional `{ ministry_id }` fragment for inserts. Returns an empty
// object when scope cannot be resolved (e.g. a pre-migration database), so the
// insert still succeeds and the DB default/trigger + RLS enforce scope. The
// explicit single return type keeps spread payloads from widening to a union.
function ministryScopeColumns(ministryId: string | undefined): { ministry_id?: string } {
  return ministryId ? { ministry_id: ministryId } : {};
}

export type MinistryOverview = {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  activity: ActivityLog[];
};

type SupabaseProfileRow = {
  id: string;
  ministry_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseEventRow = {
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
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archive_reason?: string | null;
  google_calendar_event_id?: string | null;
  google_calendar_event_url?: string | null;
  google_drive_folder_id?: string | null;
  google_drive_folder_url?: string | null;
  google_import_status?: "imported_from_google" | "planning_details_incomplete" | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseTaskRow = {
  id: string;
  ministry_id: string | null;
  event_id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  critical: boolean | null;
  file_status: string | null;
  notes?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const MINISTRY_TASK_LIST_SELECT = "id,ministry_id,event_id,title,owner,due_date,status,critical";
const MINISTRY_EVENT_LIST_SELECT =
  "id,ministry_id,title,ministry_area,description,vision,target_group,start_date,end_date,start_time,end_time,location,owner,status,priority,budget_target,budget_actual,volunteers_needed,communication_owner,notes,archived_at,archived_by_user_id,archive_reason,google_calendar_event_id,google_calendar_event_url,google_drive_folder_id,google_drive_folder_url,google_import_status,created_at,updated_at";
const MINISTRY_EVENT_LIST_SELECT_LEGACY =
  "id,ministry_id,title,ministry_area,description,vision,target_group,start_date,end_date,start_time,end_time,location,owner,status,priority,budget_target,budget_actual,volunteers_needed,communication_owner,notes,created_at,updated_at";

type SupabaseActivityRow = {
  id: string;
  ministry_id: string | null;
  event_id: string | null;
  task_id: string | null;
  action: string;
  actor_id: string | null;
  created_at: string;
};

type EphemeralMvpState = {
  communications: CommunicationPackage[];
  integrationLogs: IntegrationSyncLog[];
};

const globalState = globalThis as typeof globalThis & {
  __emergePhase1Ephemeral?: EphemeralMvpState;
};

const ephemeral = globalState.__emergePhase1Ephemeral ?? {
  communications: [],
  integrationLogs: []
};
globalState.__emergePhase1Ephemeral = ephemeral;

function shouldUseMock(session: AuthSession) {
  return session.isGuest || session.isMock || !isSupabaseConfigured();
}

function guestSessionId(session: AuthSession) {
  return session.guestSessionId ?? session.user.id;
}

function sessionSandboxId(session: AuthSession) {
  return session.isGuest ? guestSessionId(session) : `platform_user_${session.user.id}`;
}

async function shouldUseSessionOnlySandbox(session: AuthSession) {
  if (session.isGuest) return true;
  if (session.isMock || !isSupabaseConfigured()) return false;
  return (await getPlatformDataAccessModeForSession(session)) === "demo";
}

export async function getOverview(session: AuthSession): Promise<MinistryOverview> {
  return measureServerOperation("ministry.overview", async () => {
    if (await shouldUseSessionOnlySandbox(session)) return getGuestOverview(sessionSandboxId(session));
    if (shouldUseMock(session)) {
      return {
        events: mockStore.listEvents(),
        tasks: mockStore.listTasks(),
        users: mockStore.listUsers(),
        expenses: mockStore.listExpenses(),
        activity: mockStore.listActivity()
      };
    }

    const supabase = getSupabaseAuthClient(session.accessToken);
    const [profileResult, taskResult, activityResult] = await Promise.all([
      measureServerOperation("supabase.profiles.list", async () => supabase.from("profiles")
        .select("id,ministry_id,email,full_name,role")
        .order("created_at", { ascending: true })
        .returns<SupabaseProfileRow[]>()),
      measureServerOperation("supabase.tasks.list", async () => supabase.from("tasks")
        .select(MINISTRY_TASK_LIST_SELECT)
        .order("due_date", { ascending: true })
        .returns<SupabaseTaskRow[]>()),
      measureServerOperation("supabase.activity.list", async () => supabase.from("activity_logs")
        .select("id,ministry_id,event_id,task_id,action,actor_id,created_at")
        .order("created_at", { ascending: false })
        .returns<SupabaseActivityRow[]>())
    ]);
    let eventResult = await measureServerOperation("supabase.events.list", async () => supabase.from("events")
      .select(MINISTRY_EVENT_LIST_SELECT)
      .order("start_date", { ascending: true })
      .returns<SupabaseEventRow[]>());
    if (isMissingColumnError(eventResult.error)) {
      eventResult = await measureServerOperation("supabase.events.list.legacy", async () => supabase.from("events")
        .select(MINISTRY_EVENT_LIST_SELECT_LEGACY)
        .order("start_date", { ascending: true })
        .returns<SupabaseEventRow[]>());
    }

    throwIfSupabaseError(profileResult.error);
    throwIfSupabaseError(eventResult.error);
    throwIfSupabaseError(taskResult.error);
    throwIfSupabaseError(activityResult.error);

    const users = toUsers(profileResult.data ?? [], session);
    const rawEvents = (eventResult.data ?? []).map((event) => toMinistryEvent(event, users));
    const tasks = (taskResult.data ?? []).map((task) => toActiveTask(task, users));
    const events = applyTaskDerivedEventStatuses(rawEvents, tasks);
    return {
      events,
      tasks,
      users,
      expenses: toEventExpenses(eventResult.data ?? []),
      activity: (activityResult.data ?? []).map(toActivityLog)
    };
  });
}

export async function getEventWorkspace(session: AuthSession, eventId: string): Promise<EventWorkspace | undefined> {
  if (await shouldUseSessionOnlySandbox(session)) return getGuestWorkspace(sessionSandboxId(session), eventId);
  if (shouldUseMock(session)) {
    return mockStore.getWorkspace(eventId);
  }

  const overview = await getOverview(session);
  const event = overview.events.find((item) => item.id === eventId);
  if (!event) return undefined;

  const expenses = overview.expenses.filter((expense) => expense.eventId === eventId);

  return {
    event,
    tasks: overview.tasks.filter((task) => task.eventId === eventId),
    communications: ephemeral.communications.filter((item) => item.eventId === eventId),
    integrationLogs: ephemeral.integrationLogs.filter((log) => log.eventId === eventId),
    expenses,
    missingInformation: getMissingInformation(event, expenses),
    activity: overview.activity.filter((item) => item.eventId === eventId)
  };
}

export async function createMinistryEvent(
  session: AuthSession,
  input: {
    title: string;
    description: string;
    type: EventType;
    startTime: string;
    endTime: string;
    location?: string;
    targetGroup?: string;
    budgetTarget?: number;
    budgetActual?: number;
    volunteersNeeded?: number;
    priority?: string;
    contactOwnerId?: string;
  }
) {
  if (await shouldUseSessionOnlySandbox(session)) return createGuestEvent(sessionSandboxId(session), input);
  if (shouldUseMock(session)) {
    return mockStore.createEvent(input);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const ministryId = await resolveMinistryScope(session);
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);

  const defaultVolunteers = input.type === "conference" ? 6 : input.type === "missions_trip" ? 4 : 2;

  const baseRow = {
    ...ministryScopeColumns(ministryId),
    title: input.title,
    ministry_area: input.type,
    description: input.description,
    vision: "",
    start_date: toDateOnly(start),
    end_date: toDateOnly(end),
    start_time: toTimeOnly(start),
    end_time: toTimeOnly(end),
    location: input.location ?? null,
    owner: input.contactOwnerId ?? session.user.id,
    status: "planning",
    priority: input.priority ?? (input.type === "conference" ? "high" : "normal"),
    budget_target: input.budgetTarget ?? null,
    budget_actual: input.budgetActual ?? 0,
    volunteers_needed: input.volunteersNeeded ?? defaultVolunteers,
    communication_owner: input.contactOwnerId ?? session.user.id,
    created_by: session.user.id
  };

  let insertResult = await supabase
    .from("events")
    .insert({ ...baseRow, target_group: input.targetGroup ?? null })
    .select("*")
    .single<SupabaseEventRow>();

  // Tolerate schema drift: if target_group has not been migrated onto this DB
  // (supabase/migrations/003_target_group.sql) retry without it so creation
  // still succeeds. Apply migration 004 to restore target_group persistence.
  if (isMissingColumnError(insertResult.error)) {
    insertResult = await supabase.from("events").insert(baseRow).select("*").single<SupabaseEventRow>();
  }

  throwIfSupabaseError(insertResult.error);
  if (!insertResult.data) return undefined;

  await createActivityLog(session, insertResult.data.id, null, `Created event: ${input.title}`);
  await generateTemplateTasks(session, insertResult.data);
  await syncSavedEventToGoogleDemo(session, insertResult.data.id, input.title);
  return getEventWorkspace(session, insertResult.data.id);
}

export async function updateMinistryEvent(session: AuthSession, eventId: string, input: Partial<MinistryEvent>) {
  if (await shouldUseSessionOnlySandbox(session)) return updateGuestEvent(sessionSandboxId(session), eventId, input);
  if (shouldUseMock(session)) {
    return mockStore.updateEvent(eventId, input);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const update: Record<string, string | number | null> = {};

  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.type !== undefined) update.ministry_area = input.type;
  if (input.location !== undefined) update.location = input.location ?? null;
  if (input.targetGroup !== undefined) update.target_group = input.targetGroup ?? null;
  if (input.budgetTarget !== undefined) update.budget_target = input.budgetTarget ?? null;
  if (input.budgetActual !== undefined) update.budget_actual = input.budgetActual ?? null;
  if (input.volunteersNeeded !== undefined) update.volunteers_needed = input.volunteersNeeded ?? null;
  if (input.priority !== undefined) update.priority = input.priority ?? null;
  if (input.notes !== undefined) update.notes = input.notes ?? null;
  if (input.archivedAt !== undefined) {
    update.archived_at = input.archivedAt ?? null;
    update.archived_by_user_id = input.archivedAt ? session.user.id : null;
    update.archive_reason = input.archivedAt ? input.archiveReason ?? "Archived from events workspace." : null;
  }
  if (input.contactOwnerId !== undefined) {
    update.owner = input.contactOwnerId ?? null;
    update.communication_owner = input.contactOwnerId ?? null;
  }
  if (input.status !== undefined) update.status = input.status;

  if (input.startTime !== undefined) {
    const start = new Date(input.startTime);
    update.start_date = toDateOnly(start);
    update.start_time = toTimeOnly(start);
  }

  if (input.endTime !== undefined) {
    const end = new Date(input.endTime);
    update.end_date = toDateOnly(end);
    update.end_time = toTimeOnly(end);
  }

  let result = await supabase.from("events").update(update).eq("id", eventId).select("id,title").single<{ id: string; title: string }>();

  // Tolerate schema drift on target_group (see createMinistryEvent).
  if (isMissingColumnError(result.error) && "target_group" in update) {
    const safeUpdate = { ...update };
    delete safeUpdate.target_group;
    result = await supabase.from("events").update(safeUpdate).eq("id", eventId).select("id,title").single<{ id: string; title: string }>();
  }

  throwIfSupabaseError(result.error);
  if (!result.data) return undefined;

  await createActivityLog(
    session,
    eventId,
    null,
    input.archivedAt !== undefined
      ? input.archivedAt
        ? `Archived event: ${result.data.title}`
        : `Restored event: ${result.data.title}`
      : input.notes !== undefined
      ? `Updated event notes: ${result.data.title}`
      : `Updated event information: ${result.data.title}`
  );
  await syncEventStatusFromTasks(session, eventId);
  await syncSavedEventToGoogleDemo(session, eventId, result.data.title);
  return getEventWorkspace(session, eventId);
}

export async function addMinistryExpense(
  session: AuthSession,
  input: { eventId: string; categoryId: string; amount: number; description: string }
) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }

  if (await shouldUseSessionOnlySandbox(session)) return addGuestExpense(sessionSandboxId(session), { ...input, amount });
  if (shouldUseMock(session)) {
    return mockStore.addExpense({ ...input, amount });
  }

  const overview = await getOverview(session);
  const event = overview.events.find((item) => item.id === input.eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  const updatedActual = Number(event.budgetActual ?? 0) + amount;
  await updateMinistryEvent(session, input.eventId, { budgetActual: updatedActual });

  return {
    id: `budget_actual_${input.eventId}_${Date.now()}`,
    eventId: input.eventId,
    categoryId: input.categoryId,
    amount,
    description: input.description,
    timestamp: new Date().toISOString()
  } satisfies EventExpense;
}

export async function updateMinistryTask(session: AuthSession, taskId: string, input: Partial<ActiveTask>) {
  if (await shouldUseSessionOnlySandbox(session)) return updateGuestTask(sessionSandboxId(session), taskId, input);
  if (shouldUseMock(session)) {
    return mockStore.updateTask(taskId, input);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const currentResult = await supabase.from("tasks").select("*").eq("id", taskId).single<SupabaseTaskRow>();
  throwIfSupabaseError(currentResult.error);
  if (!currentResult.data) return undefined;

  const update: Record<string, string | boolean | null> = {};
  if (input.taskTitle !== undefined) update.title = input.taskTitle;
  if (input.dueDate !== undefined) update.due_date = toDateOnly(new Date(input.dueDate));
  if (input.status !== undefined) update.status = input.status;
  if (input.assignedUserId !== undefined) update.owner = input.assignedUserId;
  if (input.notes !== undefined) update.notes = input.notes ?? null;

  if (Object.keys(update).length === 0) {
    const overview = await getOverview(session);
    return toActiveTask(currentResult.data, overview.users);
  }

  const result = await supabase.from("tasks").update(update).eq("id", taskId).select("*").single<SupabaseTaskRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) return undefined;

  if (input.dueDate && input.dueDate !== currentResult.data.due_date) {
    await createActivityLog(session, result.data.event_id, taskId, `Changed due date for task: ${result.data.title}`);
  }

  if (input.status && input.status !== currentResult.data.status) {
    await createActivityLog(session, result.data.event_id, taskId, `Moved task to ${input.status.replace("_", " ")}: ${result.data.title}`);
  }

  if (input.assignedUserId && input.assignedUserId !== currentResult.data.owner) {
    await createActivityLog(session, result.data.event_id, taskId, `Changed owner for task: ${result.data.title}`);
  }

  if (input.taskTitle && input.taskTitle !== currentResult.data.title) {
    await createActivityLog(session, result.data.event_id, taskId, `Edited task title: ${input.taskTitle}`);
  }

  if (input.notes !== undefined && input.notes !== currentResult.data.notes) {
    await createActivityLog(session, result.data.event_id, taskId, `Updated task notes: ${result.data.title}`);
  }

  await syncEventStatusFromTasks(session, result.data.event_id);

  const overview = await getOverview(session);
  return toActiveTask(result.data, overview.users);
}

export async function createMinistryTask(
  session: AuthSession,
  input: {
    eventId: string;
    taskTitle: string;
    dueDate: string;
    assignedUserId: string;
    status?: TaskStatus;
  }
) {
  if (await shouldUseSessionOnlySandbox(session)) return createGuestTask(sessionSandboxId(session), input);
  if (shouldUseMock(session)) {
    return mockStore.createTask(input);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const ministryId = await resolveMinistryScope(session);
  const result = await supabase
    .from("tasks")
    .insert({
      ...ministryScopeColumns(ministryId),
      event_id: input.eventId,
      title: input.taskTitle,
      owner: input.assignedUserId,
      due_date: toDateOnly(new Date(input.dueDate)),
      status: input.status ?? "todo",
      priority: "normal",
      critical: false,
      file_status: "No file attached",
      created_by: session.user.id
    })
    .select("*")
    .single<SupabaseTaskRow>();

  throwIfSupabaseError(result.error);
  if (!result.data) return undefined;

  await createActivityLog(session, input.eventId, result.data.id, `Added task: ${input.taskTitle}`);
  await syncEventStatusFromTasks(session, input.eventId);
  const overview = await getOverview(session);
  return toActiveTask(result.data, overview.users);
}

export async function listMinistryTasks(session: AuthSession) {
  if (await shouldUseSessionOnlySandbox(session)) return getGuestOverview(sessionSandboxId(session)).tasks;
  if (shouldUseMock(session)) {
    return mockStore.listTasks();
  }

  const overview = await getOverview(session);
  return overview.tasks;
}

export async function listMinistryActivity(session: AuthSession) {
  if (await shouldUseSessionOnlySandbox(session)) return getGuestOverview(sessionSandboxId(session)).activity;
  if (shouldUseMock(session)) {
    return mockStore.listActivity();
  }

  const overview = await getOverview(session);
  return overview.activity;
}

export async function generateMinistryCommunicationPreviews(session: AuthSession, eventId: string) {
  if (await shouldUseSessionOnlySandbox(session)) return generateGuestCommunicationPreview(sessionSandboxId(session), eventId);
  if (shouldUseMock(session)) {
    return mockStore.generateCommunicationPreview(eventId);
  }

  const workspace = await getEventWorkspace(session, eventId);
  if (!workspace) return undefined;

  const openTasks = workspace.tasks.filter((task) => task.status !== "done");
  const missingNote = workspace.missingInformation.length
    ? `Details still being confirmed: ${workspace.missingInformation.map((item) => item.label).join(" ")}`
    : "All core event information is ready for review.";
  const createdAt = new Date().toISOString();
  const dateLine = new Date(workspace.event.startTime).toLocaleString();
  const locationLine = workspace.event.location ?? "Location is still being finalized.";
  const taskLine = `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} remain before this event is ready.`;

  const previews: CommunicationPackage[] = [
    {
      id: uid("comm"),
      eventId,
      type: "parent_email",
      payload: {
        subject: `Parent email preview: ${workspace.event.title}`,
        body: `Preview only - not sent.\n\nHi families,\n\nHere is the current preview for ${workspace.event.title}.\n\nSummary: ${workspace.event.description || "Event summary is still being finalized."}\nDate/time: ${dateLine}\nLocation: ${locationLine}\nWhat families need to know: ${missingNote}`
      },
      status: "preview",
      createdAt
    },
    {
      id: uid("comm"),
      eventId,
      type: "leader_brief",
      payload: {
        subject: `Leader announcement preview: ${workspace.event.title}`,
        body: `Preview only - not sent.\n\nLeader heads up for ${workspace.event.title}.\n\nDate/time: ${dateLine}\nLocation: ${locationLine}\nVolunteer/task awareness: ${taskLine}\nMissing info: ${missingNote}`
      },
      status: "preview",
      createdAt
    },
    {
      id: uid("comm"),
      eventId,
      type: "student_announcement",
      payload: {
        subject: `Blast text preview: ${workspace.event.title}`,
        body: `Preview only - not sent.\n\n${workspace.event.title}: ${dateLine}. ${workspace.event.location ? `Meet at ${workspace.event.location}.` : "Location is still being finalized."}`
      },
      status: "preview",
      createdAt
    }
  ];

  ephemeral.communications.unshift(...previews);
  await createActivityLog(session, eventId, null, `Generated communication previews for ${workspace.event.title}`);
  return previews;
}

export async function runMinistryIntegrationStub(
  session: AuthSession,
  eventId: string,
  type: "google_drive" | "propresenter" | "google_calendar" | "planning_center"
) {
  if (await shouldUseSessionOnlySandbox(session)) return runGuestIntegrationStub(sessionSandboxId(session), eventId, type);
  if (shouldUseMock(session)) {
    return mockStore.runIntegrationStub(eventId, type);
  }

  const workspace = await getEventWorkspace(session, eventId);
  if (!workspace) return undefined;

  const log = integrationAdapters[type].runStubAction(workspace.event);
  ephemeral.integrationLogs.unshift(log);
  await createActivityLog(session, eventId, null, `Stub Mode: ${log.details.action} for ${workspace.event.title}`);
  return log;
}

export async function deleteMinistryEvent(session: AuthSession, eventId: string) {
  if (await shouldUseSessionOnlySandbox(session)) return deleteGuestEvent(sessionSandboxId(session), eventId);
  if (session.user.role.trim().toLowerCase() !== "admin") return false;

  if (shouldUseMock(session)) {
    const event = mockStore.getEvent(eventId);
    if (!event?.archivedAt) return false;
    return mockStore.deleteEvent(eventId);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const currentResult = await supabase
    .from("events")
    .select("id,title,archived_at")
    .eq("id", eventId)
    .single<{ id: string; title: string; archived_at: string | null }>();
  throwIfSupabaseError(currentResult.error);
  if (!currentResult.data?.archived_at) return false;

  const result = await supabase.from("events").delete().eq("id", eventId);
  throwIfSupabaseError(result.error);
  return true;
}

export async function deleteMinistryTask(session: AuthSession, taskId: string) {
  if (await shouldUseSessionOnlySandbox(session)) return deleteGuestTask(sessionSandboxId(session), taskId);
  return false;
}

async function generateTemplateTasks(session: AuthSession, event: SupabaseEventRow) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const eventType = toEventType(event.ministry_area);
  const rows = defaultTemplateTasks[eventType].map((template) => {
    const dueDate = event.start_date ? addDays(`${event.start_date}T12:00:00`, template.timelineOffsetDays).slice(0, 10) : null;
    return {
      // Tasks inherit ministry scope from their parent event.
      ...ministryScopeColumns(event.ministry_id ?? undefined),
      event_id: event.id,
      title: template.taskTitle,
      owner: session.user.id,
      due_date: dueDate,
      status: "todo",
      priority: template.timelineOffsetDays <= -30 ? "high" : "normal",
      critical: template.timelineOffsetDays <= -30,
      file_status: "No file attached",
      created_by: session.user.id
    };
  });

  const result = await supabase.from("tasks").insert(rows).select("id,title").returns<Array<{ id: string; title: string }>>();
  throwIfSupabaseError(result.error);

  await Promise.all(
    (result.data ?? []).map((task) => createActivityLog(session, event.id, task.id, `Generated task: ${task.title}`))
  );
}

async function createActivityLog(session: AuthSession, eventId: string, taskId: string | null, action: string) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const ministryId = await resolveMinistryScope(session);
  const result = await supabase.from("activity_logs").insert({
    ...ministryScopeColumns(ministryId),
    event_id: eventId,
    task_id: taskId,
    action,
    actor_id: session.user.id
  });
  throwIfSupabaseError(result.error);
}

async function syncEventStatusFromTasks(session: AuthSession, eventId: string) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const taskResult = await supabase
    .from("tasks")
    .select("status")
    .eq("event_id", eventId)
    .returns<Array<{ status: string | null }>>();
  throwIfSupabaseError(taskResult.error);

  const nextStatus = deriveEventStatusFromTaskStatuses((taskResult.data ?? []).map((task) => ({ status: toTaskStatus(task.status) })));
  if (!nextStatus) return;

  const eventResult = await supabase.from("events").select("status").eq("id", eventId).single<{ status: string | null }>();
  throwIfSupabaseError(eventResult.error);
  if (eventResult.data?.status === nextStatus) return;

  const updateResult = await supabase.from("events").update({ status: nextStatus }).eq("id", eventId);
  throwIfSupabaseError(updateResult.error);
}

function toUsers(rows: SupabaseProfileRow[], session: AuthSession): User[] {
  if (!rows.length) {
    const [firstName, ...lastName] = resolvePersonName(session.user.fullName, session.user.email, "Staff Member").split(" ");
    return [
      {
        id: session.user.id,
        firstName: firstName || "Staff",
        lastName: lastName.join(" "),
        email: session.user.email,
        role: toRole(session.user.role)
      }
    ];
  }

  return rows.map((row) => {
    const [firstName, ...lastName] = resolvePersonName(row.full_name, row.email, "Staff Member").split(" ");
    return {
      id: row.id,
      ministryId: row.ministry_id ?? undefined,
      firstName,
      lastName: lastName.join(" "),
      email: row.email ?? "",
      role: toRole(row.role)
    };
  });
}

function toMinistryEvent(row: SupabaseEventRow, users: User[]): MinistryEvent {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    title: row.title,
    description: row.description ?? row.vision ?? "",
    type: toEventType(row.ministry_area),
    startTime: fromDateAndTime(row.start_date, row.start_time),
    endTime: fromDateAndTime(row.end_date ?? row.start_date, row.end_time ?? row.start_time),
    status: (row.status as import("@/lib/types").EventStatus) ?? "planning",
    location: row.location ?? undefined,
    targetGroup: row.target_group ?? undefined,
    budgetTarget: row.budget_target ?? undefined,
    budgetActual: row.budget_actual ?? 0,
    volunteersNeeded: row.volunteers_needed ?? undefined,
    priority: row.priority ?? "normal",
    contactOwnerId: toOwnerId(row.communication_owner ?? row.owner, users),
    autoGeneratedTimeline: [],
    googleCalendarEventId: row.google_calendar_event_id ?? undefined,
    googleCalendarEventUrl: row.google_calendar_event_url ?? undefined,
    googleDriveFolderId: row.google_drive_folder_id ?? undefined,
    googleDriveFolderUrl: row.google_drive_folder_url ?? undefined,
    googleImportStatus: row.google_import_status ?? undefined,
    proPresenterPlaylistId: undefined,
    notes: row.notes ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByUserId: row.archived_by_user_id ?? undefined,
    archiveReason: row.archive_reason ?? undefined,
    createdAt: row.created_at
  };
}

async function syncSavedEventToGoogleDemo(session: AuthSession, eventId: string, title: string) {
  try {
    const result = await syncPlatformEventToGoogle(session, eventId);
    if (result.synced) {
      await createActivityLog(session, eventId, null, `Synced event to Google demo calendar and Drive: ${title}`);
    }
  } catch {
    // Event persistence is the source of truth. Google sync status is visible
    // in Settings and can be retried there without rolling back the saved event.
  }
}

function toActiveTask(row: SupabaseTaskRow, users: User[]): ActiveTask {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    eventId: row.event_id,
    taskTitle: row.title,
    dueDate: row.due_date ? `${row.due_date}T12:00:00.000Z` : new Date().toISOString(),
    assignedUserId: toOwnerId(row.owner, users) ?? users[0]?.id ?? "",
    status: toTaskStatus(row.status),
    autoGenerated: true,
    timelineOffsetDays: row.critical ? -30 : 0,
    notes: row.notes ?? undefined
  };
}

function toActivityLog(row: SupabaseActivityRow): ActivityLog {
  return {
    id: row.id,
    ministryId: row.ministry_id ?? undefined,
    type: "task_edited",
    eventId: row.event_id ?? undefined,
    taskId: row.task_id ?? undefined,
    actorId: row.actor_id ?? "",
    message: row.action,
    metadata: {},
    timestamp: row.created_at
  };
}

function toEventExpenses(rows: SupabaseEventRow[]): EventExpense[] {
  return rows
    .filter((row) => Number(row.budget_actual ?? 0) > 0)
    .map((row) => ({
      id: `budget_actual_${row.id}`,
      eventId: row.id,
      categoryId: "budget_actual",
      amount: Number(row.budget_actual ?? 0),
      description: "Budget actual from Supabase event row",
      timestamp: row.updated_at
    }));
}

function toRole(value?: string | null): Role {
  return normalizePlatformRole(value);
}

function toEventType(value?: string | null): EventType {
  return normalizeEventType(value);
}

function toTaskStatus(value?: string | null): TaskStatus {
  if (value === "todo" || value === "in_progress" || value === "blocked" || value === "done") return value;
  return "todo";
}

function toOwnerId(value: string | null | undefined, users: User[]) {
  if (!value) return users[0]?.id;
  return users.find((user) => user.id === value || user.email === value || `${user.firstName} ${user.lastName}` === value)?.id ?? users[0]?.id;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeOnly(date: Date) {
  return date.toISOString().slice(11, 16);
}

function fromDateAndTime(date?: string | null, time?: string | null) {
  if (!date) return new Date().toISOString();
  return new Date(`${date}T${normalizeTime(time)}`).toISOString();
}

function normalizeTime(value?: string | null) {
  if (!value) return "12:00:00";
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

// True when a Supabase/PostgREST error means a referenced column does not
// exist on the table (e.g. the optional target_group migration has not been
// applied to this database yet). Lets writes retry without the drift column.
function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /could not find the .* column|column .* does not exist|schema cache/i.test(error.message ?? "");
}

