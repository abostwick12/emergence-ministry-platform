"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRole } from "@/components/role-context";
import { eventTypeLabels } from "@/lib/templates";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import type {
  ActiveTask,
  ActivityLog,
  CommunicationPackage,
  EventExpense,
  EventType,
  EventWorkspace,
  IntegrationSyncLog,
  MinistryEvent,
  MissingInformationItem,
  Role,
  TaskStatus,
  User
} from "@/lib/types";

type Overview = {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  activity: ActivityLog[];
};

const statuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Stuck",
  done: "Done"
};

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

const eventTypes: EventType[] = ["retreat", "weekly", "service", "camp"];

type EventGroupKey = "thisWeek" | "thisMonth" | "longRange" | "past";

const eventGroupLabels: Record<EventGroupKey, string> = {
  thisWeek: "This Week",
  thisMonth: "This Month",
  longRange: "Long Range Planning",
  past: "Past Events"
};

type WorkspaceView = "dashboard" | "events" | "tasks";

export default function MinistryWorkspace({ view }: { view: WorkspaceView }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [workspace, setWorkspace] = useState<EventWorkspace | null>(null);
  const { activeRole } = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("Stub Mode active. No live credentials are required.");
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>(["evt_winter_retreat"]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function loadOverview(nextSelectedId?: string) {
    const response = await fetch("/api/events", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const data = (await response.json()) as Overview;
    setOverview(data);
    const requestedEventId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("event") ?? "" : "";
    const fallbackId = nextSelectedId || requestedEventId || selectedEventId || data.events[0]?.id || "";
    setSelectedEventId(fallbackId);
    if (fallbackId) {
      await loadWorkspace(fallbackId);
    }
    setIsLoading(false);
  }

  async function loadWorkspace(eventId: string) {
    const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) return;
    setWorkspace((await response.json()) as EventWorkspace);
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view !== "events" || !workspace || window.location.hash !== "#event-command-center") return;
    window.requestAnimationFrame(() => {
      document.getElementById("event-command-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [view, workspace]);

  const users = useMemo(() => overview?.users ?? [], [overview?.users]);
  const activeUsers = users.filter((user) => user.role === "admin" || user.role === "leader");
  const selectedEvent = workspace?.event;
  const totalTasks = overview?.tasks.length ?? 0;
  const doneTasks = overview?.tasks.filter((task) => task.status === "done").length ?? 0;
  const blockedTasks = overview?.tasks.filter((task) => task.status === "blocked").length ?? 0;

  const visibleTasks = useMemo(() => {
    if (!overview) return [];
    if (activeRole === "leader") {
      const leader = users.find((user) => user.role === "leader");
      return overview.tasks.filter((task) => task.assignedUserId === leader?.id);
    }
    return overview.tasks;
  }, [activeRole, overview, users]);

  async function refresh(eventId = selectedEventId) {
    await loadOverview(eventId);
    if (eventId) {
      await loadWorkspace(eventId);
    }
  }

  function toggleEventExpansion(eventId: string) {
    setExpandedEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]
    );
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "");
    const type = String(form.get("type") || "retreat") as EventType;
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");

    if (!title || !startTime || !endTime) {
      setNotice("Title, start time, and end time are required.");
      return;
    }

    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        description: String(form.get("description") || ""),
        location: String(form.get("location") || ""),
        budgetTarget: Number(form.get("budgetTarget") || 0) || undefined,
        contactOwnerId: String(form.get("contactOwnerId") || "")
      })
    });

    if (!response.ok) {
      setNotice("Event creation failed. Check required fields.");
      return;
    }

    const created = (await response.json()) as EventWorkspace;
    formElement.reset();
    setIsCreateOpen(false);
    setExpandedEventIds((current) =>
      current.includes(created.event.id) ? current : [created.event.id].concat(current)
    );
    setNotice(`Created ${created.event.title} and generated baseline timeline tasks.`);
    await refresh(created.event.id);
    window.requestAnimationFrame(() => {
      document.getElementById("events-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function updateTask(taskId: string, body: Partial<ActiveTask>) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    await refresh();
  }

  async function updateEvent(eventId: string, body: Partial<MinistryEvent>) {
    const response = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      setNotice("Event update failed. Check the event information and try again.");
      return;
    }

    setNotice("Event information updated.");
    await refresh(eventId);
  }

  async function postEventAction(path: string, message: string) {
    if (!selectedEventId) return;
    await fetch(`/api/events/${selectedEventId}/${path}`, { method: "POST" });
    setNotice(message);
    await refresh();
  }

  function openCommandCenter(eventId: string) {
    if (window.location.pathname !== "/events") {
      window.location.assign(`/events?event=${eventId}#event-command-center`);
      return;
    }

    setSelectedEventId(eventId);
    if (!expandedEventIds.includes(eventId)) {
      setExpandedEventIds((current) => [...current, eventId]);
    }
    void loadWorkspace(eventId);
    window.requestAnimationFrame(() => {
      document.getElementById("event-command-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="grid workspace-page">
      <div className="panel" role="status">
        {notice}
      </div>

      {isLoading || !overview ? (
        <section className="panel">Loading ministry workspace...</section>
      ) : view === "dashboard" ? (
        <DashboardWorkspace overview={overview} totalTasks={totalTasks} doneTasks={doneTasks} blockedTasks={blockedTasks} />
      ) : view === "events" ? (
        <section className="grid workflow-stack">
          <div className="grid">
            {activeRole === "admin" ? (
              <section className="panel" id="create-event">
                <div className="toolbar" style={{ justifyContent: "space-between" }}>
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      Create Event
                    </h2>
                  </div>
                  <button className="button primary" type="button" onClick={() => setIsCreateOpen((current) => !current)}>
                    {isCreateOpen ? "Close form" : "+ Create New Event"}
                  </button>
                </div>
                {isCreateOpen ? <EventForm users={activeUsers} onSubmit={createEvent} /> : null}
              </section>
            ) : (
              <section className="panel" id="create-event">
                <p className="eyebrow">Leader View</p>
                <h2 className="section-title">Assigned Ministry Work</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Leaders can move assigned tasks through statuses and review event workspace details. Event creation is
                  Admin-only in MVP 1.
                </p>
              </section>
            )}

            <EventsWorkspace
              events={overview.events}
              tasks={overview.tasks}
              users={activeUsers}
              expenses={overview.expenses}
              selectedEventId={selectedEventId}
              expandedEventIds={expandedEventIds}
              selectedWorkspace={workspace}
              onToggleEvent={toggleEventExpansion}
              onOpenEvent={openCommandCenter}
              onUpdateTask={updateTask}
            />
          </div>

          {workspace && selectedEvent ? (
            <EventWorkspacePanel
              workspace={workspace}
              users={activeUsers}
              onGeneratePreview={() =>
                postEventAction("generate-communications", "Communication preview generated. No external message was sent.")
              }
              onDriveStub={() => postEventAction("generate-drive-folder", "Google Drive Stub Mode action recorded.")}
              onProStub={() => postEventAction("generate-propresenter", "ProPresenter Stub Mode action recorded.")}
              onCalendarStub={() => postEventAction("sync-calendar", "Google Calendar Stub Mode action recorded.")}
              onUpdateEvent={updateEvent}
            />
          ) : null}
        </section>
      ) : (
        <TasksWorkspace tasks={visibleTasks} events={overview.events} users={activeUsers} onUpdate={updateTask} onSelectEvent={openCommandCenter} />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="panel">
      <p className="eyebrow">{label}</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{value}</p>
    </section>
  );
}

function DashboardWorkspace({
  overview,
  totalTasks,
  doneTasks,
  blockedTasks
}: {
  overview: Overview;
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
}) {
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(now.getDate() + 7);
  const upcomingEvents = overview.events.filter((event) => new Date(event.startTime) >= now);
  const tasksDueSoon = overview.tasks.filter((task) => {
    const due = new Date(task.dueDate);
    return task.status !== "done" && due >= now && due <= soon;
  });
  const communicationPreviewsPending = overview.events.filter((event) => estimateMissingInformationCount(event) > 0).length;
  const recentActivity = overview.activity.slice(0, 5);

  return (
    <section className="grid">
      <section className="grid grid-3" aria-label="Dashboard metrics">
        <Metric label="Upcoming Events" value={upcomingEvents.length.toString()} />
        <Metric label="Tasks Due Soon" value={tasksDueSoon.length.toString()} />
        <Metric label="Stuck Tasks" value={blockedTasks.toString()} />
        <Metric label="Task Completion" value={`${doneTasks}/${totalTasks}`} />
        <Metric label="Communication Previews Pending" value={communicationPreviewsPending.toString()} />
      </section>

      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Operations Summary</p>
            <h2 className="section-title" style={{ margin: 0 }}>
              Recent Activity
            </h2>
          </div>
          <span className="pill stub">Stub Mode</span>
        </div>
        {recentActivity.length ? (
          <div className="grid dashboard-activity">
            {recentActivity.map((item) => (
              <article className="card" key={item.id}>
                <strong>{item.message}</strong>
                <div className="muted">{formatDateTime(item.timestamp)}</div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No recent activity yet.</p>
        )}
      </section>
    </section>
  );
}

function TasksWorkspace({
  tasks,
  events,
  users,
  onUpdate,
  onSelectEvent
}: {
  tasks: ActiveTask[];
  events: MinistryEvent[];
  users: User[];
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onSelectEvent: (eventId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const filteredTasks = statusFilter === "all" ? tasks : tasks.filter((task) => task.status === statusFilter);

  return (
    <section className="panel tasks-workspace" id="kanban-dashboard">
      <div className="toolbar tasks-header">
        <div>
          <p className="eyebrow">Task Workspace</p>
          <h2 className="section-title" style={{ margin: 0 }}>
            Tasks
          </h2>
        </div>
        <div className="segmented-control" role="group" aria-label="Task view">
          <button
            className={viewMode === "kanban" ? "button primary" : "button"}
            type="button"
            onClick={() => setViewMode("kanban")}
          >
            Kanban View
          </button>
          <button
            className={viewMode === "list" ? "button primary" : "button"}
            type="button"
            onClick={() => setViewMode("list")}
          >
            List View
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="kanban task-board">
          {statuses.map((status) => (
            <div className="kanban-column task-lane" key={status}>
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <strong className="lane-title">{statusLabels[status]}</strong>
                <span className={status === "done" ? "pill done" : status === "blocked" ? "pill blocked" : "pill"}>
                  {tasks.filter((task) => task.status === status).length}
                </span>
              </div>
              <div className="task-lane-scroll">
                {tasks.filter((task) => task.status === status).length ? (
                  tasks
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        users={users}
                        eventTitle={events.find((event) => event.id === task.eventId)?.title ?? "Event"}
                        onSelectEvent={() => onSelectEvent(task.eventId)}
                        onUpdate={onUpdate}
                      />
                    ))
                ) : (
                  <p className="kanban-empty">No tasks in this lane.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          <div className="field task-filter">
            <label htmlFor="task-status-filter">Filter by status</label>
            <select
              className="input"
              id="task-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="task-table-wrap">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Event</th>
                  <th>Owner</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Critical</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <TaskTableRow key={task.id} task={task} events={events} users={users} onUpdate={onUpdate} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function TaskTableRow({
  task,
  events,
  users,
  onUpdate
}: {
  task: ActiveTask;
  events: MinistryEvent[];
  users: User[];
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const eventTitle = events.find((event) => event.id === task.eventId)?.title ?? "Event";
  const owner = users.find((user) => user.id === task.assignedUserId);
  const isCritical = task.timelineOffsetDays <= -30 || task.status === "blocked";

  useEffect(() => {
    setDueDate(toDateInputValue(task.dueDate));
  }, [task.dueDate]);

  return (
    <tr>
      <td>{task.taskTitle}</td>
      <td>{eventTitle}</td>
      <td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned"}</td>
      <td>
        <div className="inline-edit-row table-inline-edit">
          <input className="input" aria-label={`Due date for ${task.taskTitle}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <button className="button compact-button" type="button" onClick={() => void onUpdate(task.id, { dueDate: new Date(`${dueDate}T12:00:00`).toISOString() })}>
            Save
          </button>
        </div>
      </td>
      <td>
        <select
          className="input"
          aria-label={`Status for ${task.taskTitle}`}
          value={task.status}
          onChange={(event) => void onUpdate(task.id, { status: event.target.value as TaskStatus })}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </td>
      <td>{isCritical ? "High" : "Normal"}</td>
      <td>{isCritical ? "Yes" : "No"}</td>
    </tr>
  );
}

function WorkspaceNavigator() {
  const links = [
    { label: "Create Event", shortLabel: "Create", target: "create-event" },
    { label: "Events", shortLabel: "Events", target: "events-workspace" },
    { label: "Command Center", shortLabel: "Command", target: "event-command-center" },
    { label: "Kanban", shortLabel: "Kanban", target: "kanban-dashboard" },
    { label: "Activity", shortLabel: "Activity", target: "activity-log" }
  ];

  return (
    <nav className="workspace-nav" aria-label="Workspace Navigator">
      {links.map((link) => (
        <a className="workspace-nav-link" href={`#${link.target}`} key={link.target}>
          <span className="nav-full">{link.label}</span>
          <span className="nav-short">{link.shortLabel}</span>
        </a>
      ))}
    </nav>
  );
}

function EventForm({ users, onSubmit }: { users: User[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="create-form-wrap">
      <form className="grid" onSubmit={onSubmit}>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input className="input" id="title" name="title" placeholder="Fall Kickoff Night" required />
          </div>
          <div className="field">
            <label htmlFor="type">Event type</label>
            <select className="input" id="type" name="type" defaultValue="weekly">
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {eventTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea className="input" id="description" name="description" rows={3} placeholder="What families and leaders need to know." />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="startTime">Start</label>
            <input className="input" id="startTime" name="startTime" type="datetime-local" required />
          </div>
          <div className="field">
            <label htmlFor="endTime">End</label>
            <input className="input" id="endTime" name="endTime" type="datetime-local" required />
          </div>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="location">Location</label>
            <input className="input" id="location" name="location" placeholder="Student Center" />
          </div>
          <div className="field">
            <label htmlFor="budgetTarget">Budget target</label>
            <input className="input" id="budgetTarget" name="budgetTarget" min="0" step="50" type="number" placeholder="2500" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="contactOwnerId">Communication owner</label>
          <select className="input" id="contactOwnerId" name="contactOwnerId" defaultValue={users[0]?.id}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} / {roleLabels[user.role]}
              </option>
            ))}
          </select>
        </div>
        <button className="button primary" type="submit">
          + Create event and generate tasks
        </button>
      </form>
    </div>
  );
}

function EventsWorkspace({
  events,
  tasks,
  users,
  expenses,
  selectedEventId,
  expandedEventIds,
  selectedWorkspace,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask
}: {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  selectedEventId: string;
  expandedEventIds: string[];
  selectedWorkspace: EventWorkspace | null;
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const groupedEvents = groupEventsByTimeframe(events);

  return (
    <section className="panel" id="events-workspace">
      <p className="eyebrow">Primary Workflow</p>
      <h2 className="section-title">Events Workspace</h2>
      <div className="grid">
        {(Object.keys(eventGroupLabels) as EventGroupKey[]).map((groupKey) => {
          const groupEvents = groupedEvents[groupKey];
          if (groupEvents.length === 0) return null;

          return (
            <section className={groupKey === "thisWeek" || groupKey === "thisMonth" ? "event-group priority" : "event-group"} key={groupKey}>
              <div className="event-group-header">
                <h3>{eventGroupLabels[groupKey]}</h3>
                <span className="pill">{groupEvents.length}</span>
              </div>
              <div className="event-board" role="table" aria-label={`${eventGroupLabels[groupKey]} event card-row board`}>
                <div className="event-board-header" role="row">
                  <span role="columnheader">Event Identity</span>
                  <span role="columnheader">Date / Time</span>
                  <span role="columnheader">Scrollable Summary</span>
                </div>
                <div className="event-board-rows">
                  {groupEvents.map((event) => {
                    const eventTasks = tasks.filter((task) => task.eventId === event.id);
                    const completeTasks = eventTasks.filter((task) => task.status === "done").length;
                    const owner = users.find((user) => user.id === event.contactOwnerId);
                    const eventExpenses = expenses.filter((expense) => expense.eventId === event.id);
                    const isExpanded = expandedEventIds.includes(event.id);
                    const missingCount =
                      selectedWorkspace?.event.id === event.id ? selectedWorkspace.missingInformation.length : estimateMissingInformationCount(event);

                    return (
                      <EventRowCard
                        key={event.id}
                        event={event}
                        tasks={eventTasks}
                        owner={owner}
                        expenses={eventExpenses}
                        completeTasks={completeTasks}
                        missingCount={missingCount}
                        isExpanded={isExpanded}
                        isSelected={event.id === selectedEventId}
                        onToggleEvent={onToggleEvent}
                        onOpenEvent={onOpenEvent}
                        onUpdateTask={onUpdateTask}
                        users={users}
                      />
                    );
                  })}
                 </div>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function EventRowCard({
  event,
  tasks,
  owner,
  expenses,
  completeTasks,
  missingCount,
  isExpanded,
  isSelected,
  users,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  owner?: User;
  expenses: EventExpense[];
  completeTasks: number;
  missingCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  users: User[];
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  return (
    <article className={isSelected ? "event-row event-row-card selected" : "event-row event-row-card"} data-start-time={event.startTime}>
      <div className="event-card-row" role="row">
        <EventIdentitySection event={event} tasks={tasks} completeTasks={completeTasks} />
        <EventDateBlock event={event} />
        <EventScrollableSummary
          event={event}
          owner={owner}
          expenses={expenses}
          tasks={tasks}
          completeTasks={completeTasks}
          missingCount={missingCount}
          isExpanded={isExpanded}
          onToggleEvent={onToggleEvent}
          onOpenEvent={onOpenEvent}
        />
      </div>

      {isExpanded ? (
        <EventTaskTree event={event} tasks={tasks} users={users} onUpdateTask={onUpdateTask} onOpenEvent={onOpenEvent} />
      ) : null}
    </article>
  );
}

function EventIdentitySection({
  event,
  tasks,
  completeTasks
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  completeTasks: number;
}) {
  return (
    <div className="event-identity-section" role="cell">
      <div className="event-row-title">
        <h3>{event.title}</h3>
        <p className="muted">{event.description || "No event description yet."}</p>
      </div>
      <div className="event-identity-meta">
        <span className="pill">{eventTypeLabels[event.type]}</span>
        <span className={event.status === "ready" ? "pill done" : "pill"}>{event.status}</span>
        <span className="progress-chip">{completeTasks}/{tasks.length} tasks</span>
      </div>
    </div>
  );
}

function EventDateBlock({ event }: { event: MinistryEvent }) {
  return (
    <div className="event-date-block" role="cell">
      <span className="summary-label">Date / Time</span>
      <strong>{event.startTime ? formatDate(event.startTime) : "Missing date"}</strong>
      <span className="muted">{event.startTime ? formatTime(event.startTime) : "Missing time"}</span>
      <span className="muted">Ends {event.endTime ? formatDateTime(event.endTime) : "Missing end time"}</span>
    </div>
  );
}

function EventScrollableSummary({
  event,
  owner,
  expenses,
  tasks,
  completeTasks,
  missingCount,
  isExpanded,
  onToggleEvent,
  onOpenEvent
}: {
  event: MinistryEvent;
  owner?: User;
  expenses: EventExpense[];
  tasks: ActiveTask[];
  completeTasks: number;
  missingCount: number;
  isExpanded: boolean;
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const actualBudget = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const openTasks = tasks.length - completeTasks;
  const communicationStatus = missingCount === 0 ? "Preview ready" : `${missingCount} item${missingCount === 1 ? "" : "s"} needed`;
  const driveStatus = event.googleDriveFolderId ? "Stub folder ready" : "Stub pending";
  const priority = event.type === "camp" || event.type === "retreat" ? "High" : event.type === "service" ? "Medium" : "Normal";

  return (
    <div className="event-summary-shell" role="cell">
      <button
        className="summary-toggle-button"
        type="button"
        onClick={() => onToggleEvent(event.id)}
        aria-label={isExpanded ? `Collapse task tree for ${event.title}` : `Expand task tree for ${event.title}`}
      >
        Tasks {tasks.length} {isExpanded ? "-" : "+"}
      </button>
      <div className="event-summary-scroll" aria-label={`${event.title} horizontally scrollable summary`}>
        <EventSummaryField label="Owner" value={owner ? `${owner.firstName} ${owner.lastName}` : "Missing owner"} tone={owner ? undefined : "warning"} />
        <EventSummaryField label="Location" value={event.location ?? "Missing location"} tone={event.location ? undefined : "warning"} />
        <EventSummaryField label="Budget proposed" value={event.budgetTarget ? money(event.budgetTarget) : "Missing target"} tone={event.budgetTarget ? undefined : "warning"} />
        <EventSummaryField label="Budget actual" value={actualBudget ? money(actualBudget) : "$0 recorded"} />
        <EventSummaryField label="Volunteers needed" value={estimateVolunteersNeeded(event, tasks)} />
        <EventSummaryField label="Registration status" value={event.registrationDeadline ? `Due ${formatDate(event.registrationDeadline)}` : "Not configured"} tone="warning" />
        <EventSummaryField label="Planning Center status" value="Stub Mode ready" tone="stub" />
        <EventSummaryField label="Drive folder status" value={driveStatus} tone={event.googleDriveFolderId ? "success" : "warning"} />
        <EventSummaryField label="Parent email status" value={communicationStatus} tone={missingCount ? "warning" : "success"} />
        <EventSummaryField label="GroupMe status" value="Preview only" tone="stub" />
        <EventSummaryField label="Text status" value="Preview only" tone="stub" />
        <EventSummaryField label="Files status" value={event.googleDriveFolderId ? "Folder linked" : "No folder yet"} tone={event.googleDriveFolderId ? "success" : "warning"} />
        <EventSummaryField label="Checklist progress" value={`${completeTasks}/${tasks.length} complete`} tone={openTasks ? undefined : "success"} />
        <EventSummaryField label="Missing info count" value={`${missingCount} open`} tone={missingCount ? "warning" : "success"} />
        <EventSummaryField label="Priority" value={priority} tone={priority === "High" ? "warning" : undefined} />
        <EventSummaryField label="Last updated" value={formatDate(event.createdAt)} />
        <div className="summary-field action-field">
          <span className="summary-label">Command Center</span>
          <button className="button primary" type="button" onClick={() => onOpenEvent(event.id)}>
            Open Command Center
          </button>
        </div>
      </div>
    </div>
  );
}

function EventSummaryField({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "stub";
}) {
  return (
    <div className={tone ? `summary-field ${tone}` : "summary-field"}>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventTaskTree({
  event,
  tasks,
  users,
  onUpdateTask,
  onOpenEvent
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  users: User[];
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <div className="event-task-tree-wrap">
      <span className="muted subtask-scroll-label">Compact task tree. Scroll inside this task list when it grows.</span>
      <div className="event-task-tree" aria-label={`${event.title} subtasks`}>
        {tasks.map((task) => (
          <EventTaskTreeItem key={task.id} task={task} users={users} onUpdateTask={onUpdateTask} onOpenEvent={onOpenEvent} />
        ))}
      </div>
    </div>
  );
}

function EventTaskTreeItem({
  task,
  users,
  onUpdateTask,
  onOpenEvent
}: {
  task: ActiveTask;
  users: User[];
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onOpenEvent: (eventId: string) => void;
}) {
  const owner = users.find((user) => user.id === task.assignedUserId);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));

  useEffect(() => {
    setDueDate(toDateInputValue(task.dueDate));
  }, [task.dueDate]);

  return (
    <div className={task.status === "done" ? "event-task-tree-item completed" : "event-task-tree-item"}>
      <span className="tree-branch" aria-hidden="true" />
      <div className="task-tree-title">
        <strong>{task.taskTitle}</strong>
        {task.timelineOffsetDays <= -30 || task.status === "blocked" ? <span className="pill blocked">Critical</span> : null}
      </div>
      <div className="task-tree-owner">
        <span className="summary-label">Owner</span>
        <span>{owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned"}</span>
      </div>
      <div className="field compact-field task-tree-date">
        <label htmlFor={`event-due-${task.id}`}>Due date</label>
        <div className="inline-edit-row">
          <input className="input" id={`event-due-${task.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <button
            className="button"
            type="button"
            onClick={() => void onUpdateTask(task.id, { dueDate: new Date(`${dueDate}T12:00:00`).toISOString() })}
          >
            Save due date
          </button>
        </div>
      </div>
      <div className="task-tree-status">
        <span className={task.status === "done" ? "pill done" : task.status === "blocked" ? "pill blocked" : "pill"}>
          {statusLabels[task.status]}
        </span>
      </div>
      <div className="field compact-field task-tree-quick-status">
        <label htmlFor={`event-status-${task.id}`}>Quick status</label>
        <select
          className="input"
          id={`event-status-${task.id}`}
          value={task.status}
          onChange={(event) => void onUpdateTask(task.id, { status: event.target.value as TaskStatus })}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="task-tree-files">
        <span className="summary-label">Files</span>
        <span>No file attached</span>
      </div>
      <button className="button compact-button" type="button" onClick={() => onOpenEvent(task.eventId)}>
        Open
      </button>
    </div>
  );
}

function estimateMissingInformationCount(event: MinistryEvent) {
  return [
    !event.description.trim(),
    !event.location,
    !event.contactOwnerId,
    !event.budgetTarget,
    !event.googleDriveFolderId
  ].filter(Boolean).length;
}

function estimateVolunteersNeeded(event: MinistryEvent, tasks: ActiveTask[]) {
  const leaderAssignedOpenTasks = tasks.filter((task) => task.assignedUserId === "usr_leader" && task.status !== "done").length;
  const baseline = event.type === "retreat" || event.type === "camp" ? 6 : event.type === "service" ? 4 : 2;
  return `${Math.max(baseline, leaderAssignedOpenTasks)} needed`;
}

function groupEventsByTimeframe(events: MinistryEvent[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + 7);
  const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 1);

  const groups: Record<EventGroupKey, MinistryEvent[]> = {
    thisWeek: [],
    thisMonth: [],
    longRange: [],
    past: []
  };

  [...events]
    .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime())
    .forEach((event) => {
      const start = new Date(event.startTime);
      if (start < startOfToday) {
        groups.past.push(event);
      } else if (start < endOfWeek) {
        groups.thisWeek.push(event);
      } else if (start < endOfMonth) {
        groups.thisMonth.push(event);
      } else {
        groups.longRange.push(event);
      }
    });

  return groups;
}

function TaskCard({
  task,
  users,
  eventTitle,
  onSelectEvent,
  onUpdate
}: {
  task: ActiveTask;
  users: User[];
  eventTitle: string;
  onSelectEvent: () => void;
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.taskTitle);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTitle(task.taskTitle);
    setDueDate(toDateInputValue(task.dueDate));
  }, [task.dueDate, task.taskTitle]);

  return (
    <article className="task-card">
      <div>
        <strong>{task.taskTitle}</strong>
        <div className="muted">{eventTitle}</div>
        <div className="task-summary">
          <span className="muted">Due {formatDate(task.dueDate)}</span>
          <span className={task.status === "done" ? "pill done" : task.status === "blocked" ? "pill blocked" : "pill"}>
            {statusLabels[task.status]}
          </span>
          <span className="muted">
            {users.find((user) => user.id === task.assignedUserId)?.firstName ?? "Unassigned"}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="task-edit-panel">
          <div className="field">
            <label htmlFor={`status-${task.id}`}>Status</label>
            <select
              className="input"
              id={`status-${task.id}`}
              value={task.status}
              onChange={(event) => void onUpdate(task.id, { status: event.target.value as TaskStatus })}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`owner-${task.id}`}>Owner</label>
            <select
              className="input"
              id={`owner-${task.id}`}
              value={task.assignedUserId}
              onChange={(event) => void onUpdate(task.id, { assignedUserId: event.target.value })}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`title-${task.id}`}>Edit task title</label>
            <input className="input" id={`title-${task.id}`} value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`due-${task.id}`}>Due date</label>
            <input className="input" id={`due-${task.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        {isEditing ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              setIsEditing(false);
              void onUpdate(task.id, { taskTitle: title, dueDate: new Date(`${dueDate}T12:00:00`).toISOString() });
            }}
          >
            Save
          </button>
        ) : (
          <button className="button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        )}
        <button className="button" type="button" onClick={onSelectEvent}>
          Open event
        </button>
      </div>
    </article>
  );
}

function EventWorkspacePanel({
  workspace,
  users,
  onGeneratePreview,
  onDriveStub,
  onProStub,
  onCalendarStub,
  onUpdateEvent
}: {
  workspace: EventWorkspace;
  users: User[];
  onGeneratePreview: () => void;
  onDriveStub: () => void;
  onProStub: () => void;
  onCalendarStub: () => void;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
}) {
  const spent = workspace.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const target = workspace.event.budgetTarget ?? 0;

  return (
    <section className="panel command-center-panel" id="event-command-center">
      <h2 className="section-title">Command Center: {workspace.event.title}</h2>
      <p className="muted">
        {eventTypeLabels[workspace.event.type]} / {formatDateTime(workspace.event.startTime)}
      </p>

      <div className="command-center-grid">
        <EventDetailsForm key={workspace.event.id} workspace={workspace} users={users} onUpdateEvent={onUpdateEvent} />
        <MissingInformationPanel items={workspace.missingInformation} />

        <section className="card" id="timeline-tasks">
          <h3 className="section-title">Timeline Tasks</h3>
          <div className="grid">
            {workspace.tasks.map((task) => (
              <div className="card" key={task.id}>
                <strong>{task.taskTitle}</strong>
                <div className="muted">
                  Due {formatDate(task.dueDate)} / {statusLabels[task.status]} / Owner{" "}
                  {users.find((user) => user.id === task.assignedUserId)?.firstName ?? "Unassigned"}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" id="communication-previews">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Communication Previews
            </h3>
            <button className="button" type="button" onClick={onGeneratePreview}>
              Generate preview
            </button>
          </div>
          <p className="muted">No external communication is sent in MVP 1.</p>
          <PreviewList communications={workspace.communications} />
        </section>

        <section className="card">
          <h3 className="section-title">Budget Shell</h3>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {money(spent)} spent {target ? `of ${money(target)}` : "without target"}
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Expense entry exists as an API boundary; detailed budget editing is beyond the clickable MVP screen.
          </p>
        </section>

        <section className="card">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Integration Activity
            </h3>
            <span className="pill stub">Stub Mode</span>
          </div>
          <div className="toolbar" style={{ margin: "10px 0" }}>
            <button className="button" type="button" onClick={onDriveStub}>
              Create Drive folder stub
            </button>
            <button className="button" type="button" onClick={onProStub}>
              Create ProPresenter stub
            </button>
            <button className="button" type="button" onClick={onCalendarStub}>
              Sync calendar stub
            </button>
          </div>
          <IntegrationList logs={workspace.integrationLogs} />
        </section>

        <section className="card" id="activity-log">
          <h3 className="section-title">Activity Log</h3>
          <ActivityList items={workspace.activity} />
        </section>
      </div>
    </section>
  );
}

function EventDetailsForm({
  workspace,
  users,
  onUpdateEvent
}: {
  workspace: EventWorkspace;
  users: User[];
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");

    void onUpdateEvent(workspace.event.id, {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      location: String(form.get("location") || "") || undefined,
      budgetTarget: Number(form.get("budgetTarget") || 0) || undefined,
      contactOwnerId: String(form.get("contactOwnerId") || "") || undefined
    });
  }

  return (
    <section className="card">
      <h3 className="section-title">Event Information</h3>
      <form className="grid" onSubmit={submit}>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor={`event-title-${workspace.event.id}`}>Title</label>
            <input className="input" id={`event-title-${workspace.event.id}`} name="title" defaultValue={workspace.event.title} required />
          </div>
          <div className="field">
            <label htmlFor={`event-owner-${workspace.event.id}`}>Communication owner</label>
            <select
              className="input"
              id={`event-owner-${workspace.event.id}`}
              name="contactOwnerId"
              defaultValue={workspace.event.contactOwnerId ?? users[0]?.id}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} / {roleLabels[user.role]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`event-description-${workspace.event.id}`}>Description</label>
          <textarea
            className="input"
            id={`event-description-${workspace.event.id}`}
            name="description"
            rows={3}
            defaultValue={workspace.event.description}
          />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor={`event-start-${workspace.event.id}`}>Start</label>
            <input
              className="input"
              id={`event-start-${workspace.event.id}`}
              name="startTime"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(workspace.event.startTime)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`event-end-${workspace.event.id}`}>End</label>
            <input
              className="input"
              id={`event-end-${workspace.event.id}`}
              name="endTime"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(workspace.event.endTime)}
              required
            />
          </div>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor={`event-location-${workspace.event.id}`}>Location</label>
            <input className="input" id={`event-location-${workspace.event.id}`} name="location" defaultValue={workspace.event.location ?? ""} />
          </div>
          <div className="field">
            <label htmlFor={`event-budget-${workspace.event.id}`}>Budget target</label>
            <input
              className="input"
              id={`event-budget-${workspace.event.id}`}
              name="budgetTarget"
              min="0"
              step="50"
              type="number"
              defaultValue={workspace.event.budgetTarget ?? ""}
            />
          </div>
        </div>
        <button className="button" type="submit">
          Save event information
        </button>
      </form>
    </section>
  );
}

function MissingInformationPanel({ items }: { items: MissingInformationItem[] }) {
  return (
    <section className="card">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Missing Information
        </h3>
        <span className={items.length ? "pill blocked" : "pill done"}>{items.length ? `${items.length} open` : "Complete"}</span>
      </div>
      {items.length ? (
        <div className="grid" style={{ marginTop: 10 }}>
          {items.map((item) => (
            <div className="card" key={item.id}>
              <strong>{item.area}</strong>
              <div className="muted">{item.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Required event information is ready for preview and Stub Mode workflows.</p>
      )}
    </section>
  );
}

function PreviewList({ communications }: { communications: CommunicationPackage[] }) {
  if (!communications.length) {
    return <p className="muted">No previews generated yet.</p>;
  }

  return (
    <div className="grid">
      {communications.map((item) => (
        <article className="card" key={item.id}>
          <span className="pill">Preview only — not sent</span>
          <p className="eyebrow">{communicationTypeLabel(item.type)}</p>
          <h4>{item.payload.subject}</h4>
          <p className="muted preview-body">{item.payload.body}</p>
        </article>
      ))}
    </div>
  );
}

function communicationTypeLabel(type: CommunicationPackage["type"]) {
  if (type === "parent_email") return "Parent Email";
  if (type === "leader_brief") return "Leader Announcement";
  return "Blast Text Summary";
}

function IntegrationList({ logs }: { logs: IntegrationSyncLog[] }) {
  if (!logs.length) {
    return <p className="muted">No Stub Mode integration actions recorded yet.</p>;
  }

  return (
    <div className="grid">
      {logs.map((log) => (
        <article className="card" key={log.id}>
          <span className="pill stub">Stub Mode</span>
          <strong style={{ display: "block", marginTop: 8 }}>{log.integrationType.replace("_", " ")}</strong>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {log.details.message}
          </p>
        </article>
      ))}
    </div>
  );
}

function ActivityList({ items }: { items: ActivityLog[] }) {
  if (!items.length) {
    return <p className="muted">No activity yet.</p>;
  }

  return (
    <div className="grid">
      {items.map((item) => (
        <article className="card" key={item.id}>
          <strong>{item.message}</strong>
          <div className="muted">{formatDateTime(item.timestamp)}</div>
        </article>
      ))}
    </div>
  );
}

function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
