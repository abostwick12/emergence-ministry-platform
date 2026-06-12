"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import { MinistryCalendar } from "@/components/ministry-calendar";
import { eventTypeLabels } from "@/lib/templates";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import type {
  ActiveTask,
  ActivityLog,
  EventExpense,
  MinistryEvent,
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
  const { activeRole } = useRole();
  const { openCreate, openEdit, state: cardState } = useEventCard();
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("Stub Mode active. No live credentials are required.");
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>(["evt_winter_retreat"]);

  async function loadOverview() {
    const response = await fetch("/api/events", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const data = (await response.json()) as Overview;
    setOverview(data);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cardState.savedAt > 0) void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardState.savedAt]);

  const users = useMemo(() => overview?.users ?? [], [overview?.users]);
  const activeUsers = users.filter((user) => user.role === "admin" || user.role === "leader");
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

  async function refresh() {
    await loadOverview();
  }

  function toggleEventExpansion(eventId: string) {
    setExpandedEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]
    );
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
    await refresh();
  }

  function openCommandCenter(eventId: string) {
    openEdit(eventId);
  }

  return (
    <div className="grid workspace-page">
      {view !== "dashboard" ? (
        <div className="panel" role="status">
          {notice}
        </div>
      ) : (
        <div className="sr-only" role="status">
          {notice}
        </div>
      )}

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
                  <button className="button primary" type="button" onClick={() => openCreate()}>
                    + Create New Event
                  </button>
                </div>
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
              expandedEventIds={expandedEventIds}
              onToggleEvent={toggleEventExpansion}
              onOpenEvent={openCommandCenter}
              onUpdateTask={updateTask}
              onUpdateEvent={updateEvent}
            />
          </div>
        </section>
      ) : (
        <TasksWorkspace tasks={visibleTasks} events={overview.events} users={activeUsers} onUpdate={updateTask} />
      )}
    </div>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M12 4l8.5 15H3.5L12 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M3 12h4l2-5 4 10 2-5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 11a3 3 0 100-6M17.5 19c0-2.5-1.2-4.3-3-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.8C19 15.7 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 0112 0c0 5 1.5 6.5 2 7H4c.5-.5 2-2 2-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WatercolorKpiCard({
  icon,
  visual,
  label,
  value,
  hint,
  tone,
  wide
}: {
  icon?: ReactNode;
  visual?: ReactNode;
  label: string;
  value?: string;
  hint: string;
  tone?: "warning";
  wide?: boolean;
}) {
  const className = ["kpi-card", wide ? "kpi-wide" : "", tone ? `kpi-${tone}` : ""].filter(Boolean).join(" ");
  return (
    <article className={className}>
      <div className="kpi-card-inner">
        <div className="kpi-icon" aria-hidden={visual ? undefined : true}>
          {visual ?? icon}
        </div>
        <div className="kpi-body">
          <p className="kpi-label">{label}</p>
          {value !== undefined ? <p className="kpi-value">{value}</p> : null}
          <p className="kpi-hint">{hint}</p>
        </div>
      </div>
      <span className="kpi-wash" aria-hidden="true" />
    </article>
  );
}

function TaskCompletionRing({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? done / total : 0;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="kpi-ring" viewBox="0 0 56 56" width="58" height="58" role="img" aria-label={`${done} of ${total} tasks complete`}>
      <circle className="kpi-ring-track" cx="28" cy="28" r={radius} fill="none" strokeWidth="6" />
      <circle
        className="kpi-ring-progress"
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 28 28)"
      />
      <text className="kpi-ring-text" x="28" y="32" textAnchor="middle">
        {done}/{total}
      </text>
    </svg>
  );
}

function MinistryPulse({
  eventsThisWeek,
  volunteers,
  teams,
  connections
}: {
  eventsThisWeek: number;
  volunteers: number;
  teams: number;
  connections: number;
}) {
  const rows = [
    { key: "events", icon: <IconCalendar />, value: eventsThisWeek, label: "Events This Week", hint: "Services & Gatherings", tone: "blue" },
    { key: "volunteers", icon: <IconPeople />, value: volunteers, label: "Volunteers Serving", hint: `Across ${teams} Team${teams === 1 ? "" : "s"}`, tone: "teal" },
    { key: "connections", icon: <IconHeart />, value: connections, label: "New Connections", hint: "Students & Parents", tone: "amber" }
  ];
  return (
    <section className="panel pulse-panel" aria-label="Ministry Pulse">
      <div className="pulse-header">
        <span className="pulse-header-glyph" aria-hidden="true">
          <IconPulse />
        </span>
        <h2 className="section-title" style={{ margin: 0 }}>
          Ministry Pulse
        </h2>
      </div>
      <div className="pulse-list">
        {rows.map((row) => (
          <div className="pulse-row" key={row.key}>
            <span className={`pulse-icon pulse-${row.tone}`} aria-hidden="true">
              {row.icon}
            </span>
            <div className="pulse-text">
              <p className="pulse-label">{row.label}</p>
              <p className="pulse-hint">{row.hint}</p>
            </div>
            <span className="pulse-value">{row.value}</span>
          </div>
        ))}
      </div>
      <Link className="pulse-link" href="/people">
        View full pulse →
      </Link>
    </section>
  );
}

function formatEventTimeRange(event: MinistryEvent) {
  const start = new Date(event.startTime);
  const startStr = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (event.endTime) {
    const end = new Date(event.endTime);
    return `${startStr} – ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return startStr;
}

function NextOnCalendar({ events }: { events: MinistryEvent[] }) {
  const { openEdit } = useEventCard();
  return (
    <section className="panel next-cal-panel" aria-label="Next on the Calendar">
      <div className="next-cal-header">
        <span className="next-cal-header-glyph" aria-hidden="true">
          <IconCalendar />
        </span>
        <h2 className="section-title" style={{ margin: 0 }}>
          Next on the Calendar
        </h2>
      </div>
      <div className="next-cal-list">
        {events.length ? (
          events.map((event) => {
            const start = new Date(event.startTime);
            return (
              <button className="next-cal-item" type="button" key={event.id} onClick={() => openEdit(event.id)}>
                <span className="next-cal-date" aria-hidden="true">
                  <span className="next-cal-month">{start.toLocaleDateString([], { month: "short" }).toUpperCase()}</span>
                  <span className="next-cal-day">{start.getDate()}</span>
                </span>
                <span className="next-cal-body">
                  <strong className="next-cal-title">{event.title}</strong>
                  <span className="next-cal-time">{formatEventTimeRange(event)}</span>
                  {event.location ? <span className="next-cal-loc">{event.location}</span> : null}
                </span>
              </button>
            );
          })
        ) : (
          <p className="muted">No upcoming events scheduled.</p>
        )}
      </div>
      <Link className="next-cal-link" href="/events">
        View full calendar →
      </Link>
    </section>
  );
}

function DashboardWaveFooter() {
  return (
    <footer className="dashboard-footer">
      <div className="dashboard-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dashWaveTop" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="dashWaveMid" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
          </defs>
          <path className="wave-layer wave-back" fill="url(#dashWaveMid)" d="M0,150 C240,90 480,200 720,160 C960,120 1200,70 1440,140 L1440,240 L0,240 Z" />
          <path className="wave-layer wave-front" fill="url(#dashWaveTop)" d="M0,185 C260,140 520,225 760,190 C1010,150 1230,120 1440,180 L1440,240 L0,240 Z" />
        </svg>
      </div>
    </footer>
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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + 7);

  const upcomingEvents = [...overview.events]
    .filter((event) => new Date(event.startTime) >= startOfToday)
    .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime());

  const dueThisWeek = overview.tasks.filter((task) => {
    const due = new Date(task.dueDate);
    return task.status !== "done" && due >= startOfToday && due <= endOfWeek;
  });
  const communicationPreviewsPending = overview.events.filter((event) => estimateMissingInformationCount(event) > 0);

  const nextEvents = upcomingEvents.slice(0, 3);

  return (
    <section className="grid dashboard-snapshot dashboard-watercolor">
      <header className="panel dashboard-hub-header">
        <div className="hub-connections" aria-hidden="true">
          <svg viewBox="0 0 620 150" preserveAspectRatio="none" fill="none">
            <path d="M20,116 C170,44 330,140 470,66 C530,36 575,58 612,48" stroke="#bae6fd" strokeWidth="1.2" />
            <circle cx="305" cy="92" r="3.5" fill="#7dd3fc" />
            <circle cx="470" cy="66" r="5" fill="#38bdf8" />
            <circle cx="612" cy="48" r="3.5" fill="#7dd3fc" />
          </svg>
        </div>
        <div className="dashboard-hub-heading">
          <p className="eyebrow hub-eyebrow">Emerge Ministry Hub</p>
          <h1 className="hub-title">Dashboard</h1>
          <p className="muted hub-welcome">Welcome back, Alex! Here&apos;s what&apos;s happening across Emerge.</p>
        </div>
        <div className="hub-header-right">
          <span className="pill stub">Stub Mode</span>
          <span className="hub-bell" role="img" aria-label="2 notifications">
            <IconBell />
            <span className="hub-bell-badge">2</span>
          </span>
        </div>
      </header>

      <div className="dashboard-main-grid">
        <div className="dashboard-left-col">
          <section className="kpi-grid" aria-label="Dashboard metrics">
            <WatercolorKpiCard icon={<IconCalendar />} label="Upcoming Events" value={upcomingEvents.length.toString()} hint="This Week" />
            <WatercolorKpiCard icon={<IconCheck />} label="Tasks Due Soon" value={dueThisWeek.length.toString()} hint="Due in 7 Days" />
            <WatercolorKpiCard icon={<IconAlert />} label="Stuck Tasks" value={blockedTasks.toString()} hint="Needs Attention" tone="warning" />
            <WatercolorKpiCard
              wide
              visual={<TaskCompletionRing done={doneTasks} total={totalTasks} />}
              label="Task Completion"
              hint="Tasks Completed This Week"
            />
            <WatercolorKpiCard
              wide
              icon={<IconChat />}
              label="Communication Reviews Pending"
              value={communicationPreviewsPending.length.toString()}
              hint="Awaiting Review"
            />
          </section>

          <MinistryCalendar events={overview.events} />
        </div>

        <aside className="dashboard-rail" aria-label="Ministry pulse and upcoming events">
          <MinistryPulse eventsThisWeek={5} volunteers={47} teams={8} connections={12} />
          <NextOnCalendar events={nextEvents} />
        </aside>
      </div>

      <DashboardWaveFooter />
    </section>
  );
}

function TasksWorkspace({
  tasks,
  events,
  users,
  onUpdate
}: {
  tasks: ActiveTask[];
  events: MinistryEvent[];
  users: User[];
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const filteredTasks = statusFilter === "all" ? tasks : tasks.filter((task) => task.status === statusFilter);
  const groupedFilteredTasks = groupTasksByEvent(filteredTasks, events);

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
                  <th>Notes</th>
                  <th>Priority</th>
                  <th>Critical</th>
                </tr>
              </thead>
              <tbody>
                {groupedFilteredTasks.map((group) => (
                  <Fragment key={group.eventId}>
                    <tr className="task-event-group-row">
                      <td colSpan={8}>
                        <strong>{group.eventTitle}</strong>
                        <span className="muted"> / {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}</span>
                      </td>
                    </tr>
                    {group.tasks.map((task) => (
                      <TaskTableRow key={task.id} task={task} events={events} users={users} onUpdate={onUpdate} />
                    ))}
                  </Fragment>
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
  const [dueSaveState, setDueSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const eventTitle = events.find((event) => event.id === task.eventId)?.title ?? "Event";
  const owner = users.find((user) => user.id === task.assignedUserId);
  const isCritical = task.timelineOffsetDays <= -30 || task.status === "blocked";

  useEffect(() => {
    setDueDate(toDateInputValue(task.dueDate));
    setDueSaveState("idle");
  }, [task.dueDate]);

  async function saveDueDate(nextDueDate: string) {
    setDueDate(nextDueDate);
    if (!nextDueDate) return;
    setDueSaveState("saving");
    await onUpdate(task.id, { dueDate: new Date(`${nextDueDate}T12:00:00`).toISOString() });
    setDueSaveState("saved");
  }

  return (
    <tr>
      <td>{task.taskTitle}</td>
      <td>{eventTitle}</td>
      <td>{owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned"}</td>
      <td>
        <div className="table-inline-edit">
          <input className="input" aria-label={`Due date for ${task.taskTitle}`} type="date" value={dueDate} onChange={(event) => void saveDueDate(event.target.value)} />
          <span className="inline-save-state">{dueSaveState === "saving" ? "Saving..." : dueSaveState === "saved" ? "Saved" : "Autosaves"}</span>
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
      <td>
        <NotesPanel
          id={`task-table-notes-${task.id}`}
          label={`${task.taskTitle} task`}
          value={task.notes ?? ""}
          compact
          onSave={(notes) => onUpdate(task.id, { notes })}
        />
      </td>
      <td>{isCritical ? "High" : "Normal"}</td>
      <td>{isCritical ? "Yes" : "No"}</td>
    </tr>
  );
}

function EventsWorkspace({
  events,
  tasks,
  users,
  expenses,
  expandedEventIds,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask,
  onUpdateEvent
}: {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  expandedEventIds: string[];
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
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
                    const missingCount = estimateMissingInformationCount(event);

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
                        onToggleEvent={onToggleEvent}
                        onOpenEvent={onOpenEvent}
                        onUpdateTask={onUpdateTask}
                        onUpdateEvent={onUpdateEvent}
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
  users,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask,
  onUpdateEvent
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  owner?: User;
  expenses: EventExpense[];
  completeTasks: number;
  missingCount: number;
  isExpanded: boolean;
  users: User[];
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
}) {
  return (
    <article className="event-row event-row-card" data-start-time={event.startTime}>
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
          onUpdateEvent={onUpdateEvent}
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
  const { openEdit } = useEventCard();
  return (
    <div
      className="event-identity-section event-identity-clickable"
      role="cell"
      onClick={() => openEdit(event.id)}
    >
      <div className="event-row-title">
        <button
          className="event-title-btn"
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            openEdit(event.id);
          }}
          aria-label={`Edit event: ${event.title}`}
        >
          {event.title}
        </button>
        <p className="muted">{event.description || "No event description yet."}</p>
      </div>
      <div className="event-identity-meta">
        <span className="pill">{eventTypeLabels[event.type]}</span>
        <span className={event.status === "ready" || event.status === "completed" ? "pill done" : "pill"}>{event.status}</span>
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
  onOpenEvent,
  onUpdateEvent
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
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
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
          <span className="summary-label">Edit Event</span>
          <button className="button primary" type="button" onClick={() => onOpenEvent(event.id)}>
            Open event
          </button>
        </div>
        <div className="summary-field action-field notes-summary-field">
          <span className="summary-label">Internal notes</span>
          <NotesPanel
            id={`event-row-notes-${event.id}`}
            label={`${event.title} event`}
            value={event.notes ?? ""}
            compact
            onSave={(notes) => onUpdateEvent(event.id, { notes })}
          />
        </div>
      </div>
      <span className="summary-scroll-hint">Scroll summary fields sideways for owner, budget, readiness, files, and notes.</span>
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

function NotesPanel({
  id,
  label,
  value,
  compact = false,
  onSave
}: {
  id: string;
  label: string;
  value: string;
  compact?: boolean;
  onSave: (notes: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function saveNotes() {
    setSaveState("saving");
    await onSave(draft);
    setSaveState("saved");
  }

  return (
    <div className={compact ? "notes-panel compact-notes" : "notes-panel"}>
      <button className="button compact-button" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        {value.trim() ? "Notes added" : "Notes"}
      </button>
      {isOpen ? (
        <div className="notes-editor">
          <label htmlFor={id}>Internal notes for {label}</label>
          <textarea
            className="input"
            id={id}
            rows={compact ? 3 : 4}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaveState("idle");
            }}
          />
          <div className="toolbar notes-actions">
            <button className="button compact-button" type="button" onClick={() => void saveNotes()} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving..." : "Save notes"}
            </button>
            <span className="muted">{saveState === "saved" ? "Saved internally." : "Internal only."}</span>
          </div>
        </div>
      ) : null}
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
  const [dueSaveState, setDueSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setDueDate(toDateInputValue(task.dueDate));
    setDueSaveState("idle");
  }, [task.dueDate]);

  async function saveDueDate(nextDueDate: string) {
    setDueDate(nextDueDate);
    if (!nextDueDate) return;
    setDueSaveState("saving");
    await onUpdateTask(task.id, { dueDate: new Date(`${nextDueDate}T12:00:00`).toISOString() });
    setDueSaveState("saved");
  }

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
        <input className="input" id={`event-due-${task.id}`} type="date" value={dueDate} onChange={(event) => void saveDueDate(event.target.value)} />
        <span className="inline-save-state">{dueSaveState === "saving" ? "Saving..." : dueSaveState === "saved" ? "Saved" : "Autosaves"}</span>
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
      <div className="task-tree-notes">
        <span className="summary-label">Notes</span>
        <NotesPanel
          id={`task-tree-notes-${task.id}`}
          label={`${task.taskTitle} task`}
          value={task.notes ?? ""}
          compact
          onSave={(notes) => onUpdateTask(task.id, { notes })}
        />
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

function groupTasksByEvent(tasks: ActiveTask[], events: MinistryEvent[]) {
  const eventOrder = new Map(events.map((event, index) => [event.id, index]));
  const eventTitles = new Map(events.map((event) => [event.id, event.title]));
  const groups = new Map<string, ActiveTask[]>();

  tasks.forEach((task) => {
    const group = groups.get(task.eventId) ?? [];
    group.push(task);
    groups.set(task.eventId, group);
  });

  return Array.from(groups.entries())
    .sort(([firstEventId], [secondEventId]) => (eventOrder.get(firstEventId) ?? 999) - (eventOrder.get(secondEventId) ?? 999))
    .map(([eventId, eventTasks]) => ({
      eventId,
      eventTitle: eventTitles.get(eventId) ?? "Unassigned Event",
      tasks: [...eventTasks].sort((first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime())
    }));
}

function TaskCard({
  task,
  users,
  eventTitle,
  onUpdate
}: {
  task: ActiveTask;
  users: User[];
  eventTitle: string;
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const { openEdit } = useEventCard();
  const [title, setTitle] = useState(task.taskTitle);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTitle(task.taskTitle);
    setDueDate(toDateInputValue(task.dueDate));
  }, [task.dueDate, task.taskTitle]);

  return (
    <article className={task.status === "blocked" ? "task-card attention" : "task-card"}>
      <div>
        <strong className="task-card-title">{task.taskTitle}</strong>
        <div className="task-card-event">{eventTitle}</div>
        <div className="task-summary">
          <span className="task-card-date">Due {formatDate(task.dueDate)}</span>
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

      <NotesPanel
        id={`task-card-notes-${task.id}`}
        label={`${task.taskTitle} task`}
        value={task.notes ?? ""}
        compact
        onSave={(notes) => onUpdate(task.id, { notes })}
      />

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
        <button className="button" type="button" onClick={() => openEdit(task.eventId)}>
          Open event
        </button>
      </div>
    </article>
  );
}
function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
