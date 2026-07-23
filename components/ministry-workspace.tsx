"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Archive, CheckSquare, Clock3, FileText, MapPin, Plus, RotateCcw, Search, Trash2, UserRound, UsersRound } from "lucide-react";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { MobileFieldDashboard } from "@/components/mobile-field-dashboard";
import { MinistryCalendar } from "@/components/ministry-calendar";
import { ActionQueue, ActionRow, EditorialSection, QuietState, StatusBadge } from "@/components/platform-ui";
import { ResourceAttachments } from "@/components/resource-attachments";
import type { DashboardAttention } from "@/lib/dashboard-attention";
import type { MinistryOverview } from "@/lib/data/ministry-repository";
import { eventTypeLabels } from "@/lib/templates";
import { eventCategoryColors } from "@/lib/event-categories";
import {
  loadCustomVolunteerLeaders,
  loadDeletedVolunteerLeaderIds,
  loadEventLeaderAssignments,
  mergeVolunteerLeaders,
  type EventLeaderAssignments,
  type VolunteerLeader
} from "@/lib/volunteer-leaders";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import type {
  ActiveTask,
  ActivityLog,
  EventExpense,
  MinistryEvent,
  TaskStatus,
  User
} from "@/lib/types";

type Overview = MinistryOverview;

const statuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const taskLaneStatuses: TaskStatus[] = ["blocked", "todo", "in_progress", "done"];

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Stuck",
  done: "Done"
};

type EventGroupKey = "thisWeek" | "thisMonth" | "longRange" | "past";
type EventTabKey = "upcoming" | EventGroupKey | "archived";

const eventGroupLabels: Record<EventGroupKey, string> = {
  thisWeek: "This Week",
  thisMonth: "This Month",
  longRange: "Long Range Planning",
  past: "Past Events"
};

const eventTabLabels: Record<EventTabKey, string> = {
  upcoming: "Upcoming",
  thisWeek: "This Week",
  thisMonth: "This Month",
  longRange: "Long Range",
  past: "Past Events",
  archived: "Archived"
};

type WorkspaceView = "dashboard" | "events" | "tasks";

function eventAccentStyle(type: MinistryEvent["type"]) {
  return { "--event-accent": eventCategoryColors[type] } as CSSProperties;
}

function usersToVolunteerLeaders(users: User[]): VolunteerLeader[] {
  return users.map((user) => ({
    id: `user-${user.id}`,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    role: user.role === "admin" ? "Admin" : "Leader",
    email: user.email
  }));
}

export default function MinistryWorkspace({
  view,
  initialOverview = null,
  initialAttention = null,
  initialLoadError = "",
  canSaveChanges = true
}: {
  view: WorkspaceView;
  initialOverview?: Overview | null;
  initialAttention?: DashboardAttention | null;
  initialLoadError?: string;
  canSaveChanges?: boolean;
}) {
  const [overview, setOverview] = useState<Overview | null>(initialOverview);
  const [dashboardAttention, setDashboardAttention] = useState<DashboardAttention | null>(initialAttention);
  const [loadError, setLoadError] = useState(initialLoadError);
  const { activeRole } = useRole();
  const { openCreate, openEdit, state: cardState } = useEventCard();
  const [isLoading, setIsLoading] = useState(!initialOverview && !initialLoadError);
  const [notice, setNotice] = useState("Preview adapters active. Live provider credentials are not required.");
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [eventLeaderAssignments, setEventLeaderAssignments] = useState<EventLeaderAssignments>({});
  const [customVolunteerLeaders, setCustomVolunteerLeaders] = useState<VolunteerLeader[]>([]);
  const [deletedVolunteerLeaderIds, setDeletedVolunteerLeaderIds] = useState<string[]>([]);
  const initialLoadStartedRef = useRef(Boolean(initialOverview || initialLoadError));
  const locallyDeletedEventIdsRef = useRef(new Set<string>());

  async function loadOverview() {
    setLoadError("");
    const response = await fetch(view === "dashboard" ? "/api/dashboard" : "/api/events", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const data = (await response.json().catch(() => ({}))) as (Partial<Overview> & { error?: string }) | { overview?: Partial<Overview>; attention?: DashboardAttention; error?: string };
    const isDashboardResponse = view === "dashboard" && "overview" in data;
    const nextOverview: Partial<Overview> | undefined = isDashboardResponse
      ? data.overview
      : data as Partial<Overview>;
    if (!response.ok || !nextOverview || !isOverview(nextOverview)) {
      setOverview(null);
      setLoadError(data.error ?? "Ministry workspace access could not be verified.");
      setIsLoading(false);
      return;
    }
    setOverview(filterLocallyDeletedEvents(nextOverview));
    if (isDashboardResponse) setDashboardAttention(data.attention ?? null);
    setIsLoading(false);
  }

  function filterLocallyDeletedEvents(nextOverview: Overview) {
    const deletedEventIds = locallyDeletedEventIdsRef.current;
    if (deletedEventIds.size === 0) return nextOverview;
    return {
      ...nextOverview,
      events: nextOverview.events.filter((event) => !deletedEventIds.has(event.id)),
      tasks: nextOverview.tasks.filter((task) => !deletedEventIds.has(task.eventId)),
      expenses: nextOverview.expenses.filter((expense) => !deletedEventIds.has(expense.eventId))
    };
  }

  function removeEventLocally(eventId: string) {
    locallyDeletedEventIdsRef.current.add(eventId);
    setOverview((current) =>
      current
        ? {
            ...current,
            events: current.events.filter((event) => event.id !== eventId),
            tasks: current.tasks.filter((task) => task.eventId !== eventId),
            expenses: current.expenses.filter((expense) => expense.eventId !== eventId)
          }
        : current
    );
    setExpandedEventIds((current) => current.filter((id) => id !== eventId));
  }

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cardState.savedAt > 0) void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardState.savedAt]);

  useEffect(() => {
    setEventLeaderAssignments(loadEventLeaderAssignments());
    setCustomVolunteerLeaders(loadCustomVolunteerLeaders());
    setDeletedVolunteerLeaderIds(loadDeletedVolunteerLeaderIds());
  }, [cardState.savedAt]);

  useEffect(() => {
    let active = true;
    fetch("/api/volunteer-hub/leaders", { cache: "no-store" })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const payload = (await response.json()) as {
          dataSource?: string;
          readOnlyReason?: string;
          leaders?: VolunteerLeader[];
          eventLeaderAssignments?: EventLeaderAssignments;
        };
        if (payload.dataSource === "live" && !payload.readOnlyReason) {
          setCustomVolunteerLeaders(payload.leaders ?? []);
          setDeletedVolunteerLeaderIds(usersToVolunteerLeaders((overview?.users ?? []).filter((user) => user.role === "admin" || user.role === "leader")).map((leader) => leader.id));
          setEventLeaderAssignments(payload.eventLeaderAssignments ?? {});
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cardState.savedAt, overview?.users]);

  const users = useMemo(() => overview?.users ?? [], [overview?.users]);
  const activeUsers = users.filter((user) => user.role === "admin" || user.role === "leader");
  const volunteerLeaders = useMemo(
    () => mergeVolunteerLeaders(usersToVolunteerLeaders(activeUsers), customVolunteerLeaders, deletedVolunteerLeaderIds),
    [activeUsers, customVolunteerLeaders, deletedVolunteerLeaderIds]
  );
  const activeEvents = useMemo(() => overview?.events.filter((event) => !event.archivedAt) ?? [], [overview?.events]);
  const activeEventIds = useMemo(() => new Set(activeEvents.map((event) => event.id)), [activeEvents]);
  const activeTasks = useMemo(() => overview?.tasks.filter((task) => activeEventIds.has(task.eventId)) ?? [], [overview?.tasks, activeEventIds]);
  const activeExpenses = useMemo(() => overview?.expenses.filter((expense) => activeEventIds.has(expense.eventId)) ?? [], [overview?.expenses, activeEventIds]);
  const activeOverview = useMemo<Overview | null>(() => {
    if (!overview) return null;
    return {
      ...overview,
      events: activeEvents,
      tasks: activeTasks,
      expenses: activeExpenses
    };
  }, [activeEvents, activeExpenses, activeTasks, overview]);
  const totalTasks = activeTasks.length;
  const doneTasks = activeTasks.filter((task) => task.status === "done").length;
  const blockedTasks = activeTasks.filter((task) => task.status === "blocked").length;

  const visibleTasks = useMemo(() => {
    if (!overview) return [];
    if (activeRole === "leader") {
      const leader = users.find((user) => user.role === "leader");
      return activeTasks.filter((task) => task.assignedUserId === leader?.id);
    }
    return activeTasks;
  }, [activeRole, activeTasks, overview, users]);

  async function refresh() {
    await loadOverview();
  }

  function toggleEventExpansion(eventId: string) {
    setExpandedEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]
    );
  }

  async function updateTask(taskId: string, body: Partial<ActiveTask>) {
    if (!canSaveChanges) {
      setNotice("Read-only access is active. Changes are disabled for this account.");
      return;
    }
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setNotice("Task update failed. Refresh and try again.");
      return;
    }
    setNotice("Task updated.");
    await refresh();
  }

  async function updateEvent(eventId: string, body: Partial<MinistryEvent>) {
    if (!canSaveChanges) {
      setNotice("Read-only access is active. Changes are disabled for this account.");
      return;
    }
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

  async function archiveEvent(eventId: string) {
    await updateEvent(eventId, {
      archivedAt: new Date().toISOString(),
      archiveReason: "Archived from events workspace."
    });
  }

  async function restoreEvent(eventId: string) {
    await updateEvent(eventId, {
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null
    });
  }

  async function deleteGuestEvent(eventId: string) {
    const canRemoveOptimistically = eventId.startsWith("guest_evt");
    if (canRemoveOptimistically) removeEventLocally(eventId);
    const response = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!response.ok) {
      if (canRemoveOptimistically) {
        locallyDeletedEventIdsRef.current.delete(eventId);
        await refresh();
      }
      setNotice("Event delete failed. Administrators can delete archived events.");
      return;
    }
    if (!canRemoveOptimistically) removeEventLocally(eventId);
    setNotice("Event deleted.");
    await refresh();
  }

  async function deleteGuestTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("Guest task delete failed. Only sandbox tasks can be deleted.");
      return;
    }
    setNotice("Guest task deleted. Nothing was saved outside this session.");
    await refresh();
  }

  function openCommandCenter(eventId: string) {
    openEdit(eventId);
  }

  return (
    <div className="grid workspace-page">
      <div className="sr-only" role="status">
        {notice}
      </div>
      {loadError ? (
        <section className="panel liquid-panel">
          <p className="eyebrow">Access Readiness</p>
          <h2 className="section-title flush">
            Ministry workspace unavailable
          </h2>
          <p className="muted">{loadError}</p>
          <div className="toolbar">
            <Link className="button primary" href="/camp">
              Open Camp
            </Link>
            <a className="button" href="/api/auth/logout">
              Log out
            </a>
          </div>
        </section>
      ) : isLoading || !overview ? (
        <section className="panel liquid-panel workspace-loading">Loading ministry workspace...</section>
      ) : view === "dashboard" ? (
        <DashboardWorkspace overview={activeOverview ?? overview} attention={dashboardAttention} totalTasks={totalTasks} doneTasks={doneTasks} blockedTasks={blockedTasks} />
      ) : view === "events" ? (
        <section className="grid workflow-stack">
          <MinistryEmmaPanel page="events" overview={overview} />

          <EventsWorkspace
            events={overview.events}
            tasks={overview.tasks}
            users={activeUsers}
            expenses={overview.expenses}
            canCreateEvent={canSaveChanges}
            canSaveChanges={canSaveChanges}
            expandedEventIds={expandedEventIds}
            onCreateEvent={openCreate}
            onToggleEvent={toggleEventExpansion}
            onOpenEvent={openCommandCenter}
            onUpdateTask={updateTask}
            onUpdateEvent={updateEvent}
            onArchiveEvent={archiveEvent}
            onRestoreEvent={restoreEvent}
            onDeleteEvent={deleteGuestEvent}
            eventLeaderAssignments={eventLeaderAssignments}
            volunteerLeaders={volunteerLeaders}
            onRefresh={refresh}
          />
        </section>
      ) : (
        <section className="grid workflow-stack tasks-page-stack">
          <TasksWorkspace tasks={visibleTasks} events={activeEvents} users={activeUsers} canSaveChanges={canSaveChanges} onUpdate={updateTask} onDelete={deleteGuestTask} />
          <details className="task-emma-disclosure">
            <summary>Ask EMMA about priorities, people, or decisions</summary>
            <MinistryEmmaPanel page="tasks" overview={{ ...(activeOverview ?? overview), tasks: visibleTasks }} />
          </details>
        </section>
      )}
    </div>
  );
}

function isOverview(value: Partial<Overview>): value is Overview {
  return (
    Array.isArray(value.events)
    && Array.isArray(value.tasks)
    && Array.isArray(value.users)
    && Array.isArray(value.expenses)
    && Array.isArray(value.activity)
  );
}

function sortTasksByUrgency(tasks: ActiveTask[]) {
  const rank: Record<TaskStatus, number> = { blocked: 0, todo: 1, in_progress: 2, done: 3 };
  return [...tasks].sort((first, second) => {
    const statusDifference = rank[first.status] - rank[second.status];
    if (statusDifference) return statusDifference;
    return new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime();
  });
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
        <h2 className="section-title flush">
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
        <h2 className="section-title flush">
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
  attention,
  totalTasks,
  doneTasks,
  blockedTasks
}: {
  overview: Overview;
  attention: DashboardAttention | null;
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
    <>
      <MobileFieldDashboard attention={attention} overview={overview} />
      <section className="grid dashboard-snapshot dashboard-watercolor editorial-dashboard desktop-dashboard-workspace">
      <EditorialSection
        eyebrow="Decide and unblock"
        title="Needs Your Attention"
        description="Blocked, overdue, and near-term work from the production task plan."
        accent="cyan"
      >
        {attention?.decisions.length ? (
          <ActionQueue label="Decisions needing attention">
            {attention.decisions.map((item) => (
              <ActionRow
                key={item.id}
                title={item.title}
                summary={item.summary}
                meta={item.meta}
                tone={item.tone}
                action={<Link className="button compact-button" href={item.href}>Review</Link>}
              />
            ))}
          </ActionQueue>
        ) : (
          <QuietState title="No urgent decisions">Blocked, overdue, and near-term work will appear here when production data supports it.</QuietState>
        )}
      </EditorialSection>

      <div className="dashboard-main-grid">
        <div className="dashboard-left-col">
          <EditorialSection
            eyebrow="Care"
            title="People to Follow Up With"
            description="Permission-safe student-care signals; question content stays inside the review workspace."
            accent="gold"
          >
            {attention?.people.length ? (
              <ActionQueue label="People needing follow-up">
                {attention.people.map((item) => (
                  <ActionRow
                    key={item.id}
                    title={item.title}
                    summary={item.summary}
                    meta={item.meta}
                    tone={item.tone}
                    action={<Link className="button compact-button" href={item.href}>Open care queue</Link>}
                  />
                ))}
              </ActionQueue>
            ) : (
              <QuietState title={attention?.studentCare.available ? "No care signals waiting" : "Care signals unavailable"}>
                {attention?.studentCare.message ?? "Student-care availability could not be confirmed. Ministry operations remain available."}
              </QuietState>
            )}
          </EditorialSection>

          <EditorialSection
            eyebrow="Prepare"
            title="Upcoming Event Readiness"
            description="Readiness is interpreted from tracked tasks and supported event details."
          >
            {attention?.eventReadiness.length ? (
              <ActionQueue label="Upcoming event readiness">
                {attention.eventReadiness.map((item) => (
                  <ActionRow
                    key={item.id}
                    title={item.title}
                    summary={item.summary}
                    meta={item.meta}
                    tone={item.tone}
                    action={<Link className="button compact-button" href={item.href}>Open event</Link>}
                  />
                ))}
              </ActionQueue>
            ) : (
              <QuietState title="No upcoming events">Upcoming production events will appear here.</QuietState>
            )}
          </EditorialSection>

          <EditorialSection
            eyebrow="Interpret and prepare"
            title="EMMA Can Handle"
            description="EMMA can summarize and recommend; people still approve every write, send, and integration action."
          >
            {attention?.emma.length ? (
              <div className="dashboard-emma-capabilities" aria-label="EMMA capabilities">
                {attention.emma.map((item) => <StatusBadge key={item.id} tone={item.tone}>{item.title}</StatusBadge>)}
              </div>
            ) : null}
            <MinistryEmmaPanel page="dashboard" overview={overview} />
          </EditorialSection>

          <EditorialSection eyebrow="Calendar" title="Calendar and schedule" description="The existing event calendar remains the supporting operational overview.">
            <MinistryCalendar events={overview.events} />
          </EditorialSection>
        </div>

        <aside className="dashboard-rail" aria-label="Supporting ministry overview">
          <section className="panel pulse-panel dashboard-supported-summary" aria-label="Tracked ministry summary">
            <p className="eyebrow">Tracked now</p>
            <h2 className="section-title flush">Supporting overview</h2>
            <div className="dashboard-supported-stats">
              <span><strong>{upcomingEvents.length}</strong> upcoming events</span>
              <span><strong>{dueThisWeek.length}</strong> tasks due in seven days</span>
              <span><strong>{blockedTasks}</strong> blocked tasks</span>
              <span><strong>{doneTasks}/{totalTasks}</strong> tracked tasks complete</span>
              <span><strong>{communicationPreviewsPending.length}</strong> event previews need planning details</span>
            </div>
          </section>
          <NextOnCalendar events={nextEvents} />
        </aside>
      </div>
      </section>
    </>
  );
}

function TasksWorkspace({
  tasks,
  events,
  users,
  canSaveChanges,
  onUpdate,
  onDelete
}: {
  tasks: ActiveTask[];
  events: MinistryEvent[];
  users: User[];
  canSaveChanges: boolean;
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchedTasks = normalizedQuery
    ? tasks.filter((task) => task.taskTitle.toLowerCase().includes(normalizedQuery) || events.find((event) => event.id === task.eventId)?.title.toLowerCase().includes(normalizedQuery))
    : tasks;
  const filteredTasks = sortTasksByUrgency(statusFilter === "all" ? searchedTasks : searchedTasks.filter((task) => task.status === statusFilter));
  const groupedFilteredTasks = groupTasksByEvent(filteredTasks, events);
  const openTasks = searchedTasks.filter((task) => task.status !== "done");
  const blockedTasks = searchedTasks.filter((task) => task.status === "blocked");
  const completedTasks = searchedTasks.filter((task) => task.status === "done");
  const nextTask = sortTasksByUrgency(openTasks)[0] ?? searchedTasks[0];
  const nextTaskEvent = nextTask ? events.find((event) => event.id === nextTask.eventId) : undefined;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    if (mediaQuery.matches) setViewMode("list");

    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) setViewMode("list");
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <section className="tasks-workspace tasks-lovable-workspace" id="kanban-dashboard">
      <section className="ministry-mobile-command-strip task-mobile-command-strip" aria-label="Task priority">
        <div>
          <p className="eyebrow">Start here</p>
          <strong>{nextTask ? nextTask.taskTitle : "No tasks waiting"}</strong>
          <span>{nextTask ? `${nextTaskEvent?.title ?? "Event"} - due ${formatDate(nextTask.dueDate)}` : "Create an event to generate the next checklist."}</span>
        </div>
        <nav aria-label="Task quick actions">
          <a href="#task-mobile-list">Task cards</a>
          <a href="#task-filters">Filters</a>
        </nav>
      </section>
      <div className="toolbar tasks-header tasks-lovable-toolbar">
        <div className="segmented-control" role="group" aria-label="Task view">
          <button
            className={viewMode === "kanban" ? "button primary" : "button"}
            type="button"
            onClick={() => setViewMode("kanban")}
          >
            Kanban
          </button>
          <button
            className={viewMode === "list" ? "button primary" : "button"}
            type="button"
            onClick={() => setViewMode("list")}
          >
            List
          </button>
        </div>
        <label className="tasks-search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Search tasks</span>
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search tasks..." type="search" />
        </label>
      </div>
      <div className="mobile-task-summary" aria-label="Task summary">
        <span><strong>{blockedTasks.length}</strong> stuck</span>
        <span><strong>{openTasks.length}</strong> open</span>
        <span><strong>{completedTasks.length}</strong> done</span>
      </div>
      {viewMode === "kanban" ? (
        <div className="kanban task-board">
          {taskLaneStatuses.map((status) => (
            <div
              className={dragOverStatus === status ? "kanban-column task-lane drag-over" : "kanban-column task-lane"}
              key={status}
              onDragOver={(event) => {
                if (!canSaveChanges) return;
                event.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((current) => current === status ? null : current)}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                setDragOverStatus(null);
                setDraggedTaskId(null);
                if (taskId && canSaveChanges) void onUpdate(taskId, { status });
              }}
            >
              <div className="toolbar split">
                <strong className="lane-title">{statusLabels[status]}</strong>
                <span className={status === "done" ? "pill done" : status === "blocked" ? "pill blocked" : "pill"}>
                  {searchedTasks.filter((task) => task.status === status).length}
                </span>
              </div>
              <div className="task-lane-scroll">
                {searchedTasks.filter((task) => task.status === status).length ? (
                  sortTasksByUrgency(searchedTasks.filter((task) => task.status === status))
                    .map((task) => {
                      const event = events.find((item) => item.id === task.eventId);
                      return (
                      <div
                        className={draggedTaskId === task.id ? "task-drag-shell dragging" : "task-drag-shell"}
                        draggable={canSaveChanges}
                        key={task.id}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", task.id);
                          setDraggedTaskId(task.id);
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverStatus(null);
                        }}
                      >
                        <TaskCard
                          task={task}
                          users={users}
                          event={event}
                          canSaveChanges={canSaveChanges}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                        />
                      </div>
                      );
                    })
                ) : (
                  <p className="kanban-empty">No tasks in this lane.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          <div className="field task-filter" id="task-filters">
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
                      <TaskTableRow key={task.id} task={task} events={events} users={users} canSaveChanges={canSaveChanges} onUpdate={onUpdate} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-task-action-list" id="task-mobile-list" aria-label="Mobile task action list">
            {groupedFilteredTasks.length ? (
              groupedFilteredTasks.map((group) => (
                <section className="mobile-task-group" key={group.eventId} aria-labelledby={`mobile-task-group-${group.eventId}`}>
                  <header className="mobile-task-group-header">
                    <h2 id={`mobile-task-group-${group.eventId}`}>{group.eventTitle}</h2>
                    <span>{group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}</span>
                  </header>
                  {group.tasks.map((task) => (
                    <MobileTaskActionCard key={task.id} task={task} eventTitle={group.eventTitle} users={users} canSaveChanges={canSaveChanges} onUpdate={onUpdate} />
                  ))}
                </section>
              ))
            ) : (
              <QuietState title="No tasks found">Try another search or status filter.</QuietState>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MobileTaskActionCard({
  task,
  eventTitle,
  users,
  canSaveChanges,
  onUpdate
}: {
  task: ActiveTask;
  eventTitle: string;
  users: User[];
  canSaveChanges: boolean;
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [dueSaveState, setDueSaveState] = useState<"idle" | "saving" | "saved">("idle");
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
    <article className={isCritical ? "mobile-task-action-card critical" : "mobile-task-action-card"}>
      <div className="mobile-task-action-copy">
        <span className={task.status === "done" ? "pill done" : task.status === "blocked" ? "pill blocked" : "pill"}>{statusLabels[task.status]}</span>
        <h3>{task.taskTitle}</h3>
        <p>{eventTitle}</p>
        <small>{owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned"}</small>
      </div>
      <div className="mobile-task-action-controls">
        <label>
          <span>Due</span>
          <input className="input" aria-label={`Due date for ${task.taskTitle}`} type="date" value={dueDate} disabled={!canSaveChanges} onChange={(event) => void saveDueDate(event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select
            className="input"
            aria-label={`Status for ${task.taskTitle}`}
            value={task.status}
            disabled={!canSaveChanges}
            onChange={(event) => void onUpdate(task.id, { status: event.target.value as TaskStatus })}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-save-state">{!canSaveChanges ? "Read only" : dueSaveState === "saving" ? "Saving..." : dueSaveState === "saved" ? "Saved" : "Autosaves"}</span>
      </div>
    </article>
  );
}

function TaskTableRow({
  task,
  events,
  users,
  canSaveChanges,
  onUpdate
}: {
  task: ActiveTask;
  events: MinistryEvent[];
  users: User[];
  canSaveChanges: boolean;
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
          <input className="input" aria-label={`Due date for ${task.taskTitle}`} type="date" value={dueDate} disabled={!canSaveChanges} onChange={(event) => void saveDueDate(event.target.value)} />
          <span className="inline-save-state">{!canSaveChanges ? "Read only" : dueSaveState === "saving" ? "Saving..." : dueSaveState === "saved" ? "Saved" : "Autosaves"}</span>
        </div>
      </td>
      <td>
        <select
          className="input"
          aria-label={`Status for ${task.taskTitle}`}
          value={task.status}
          disabled={!canSaveChanges}
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
          readOnly={!canSaveChanges}
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
  canCreateEvent,
  canSaveChanges,
  expandedEventIds,
  onCreateEvent,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask,
  onUpdateEvent,
  onArchiveEvent,
  onRestoreEvent,
  onDeleteEvent,
  eventLeaderAssignments,
  volunteerLeaders,
  onRefresh
}: {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  canCreateEvent: boolean;
  canSaveChanges: boolean;
  expandedEventIds: string[];
  onCreateEvent: () => void;
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
  onArchiveEvent: (eventId: string) => Promise<void>;
  onRestoreEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  eventLeaderAssignments: EventLeaderAssignments;
  volunteerLeaders: VolunteerLeader[];
  onRefresh: () => Promise<void>;
}) {
  const { activeRole } = useRole();
  const [activeTab, setActiveTab] = useState<EventTabKey>("upcoming");
  const groupedEvents = groupEventsByTimeframe(events);
  const archivedEvents = getArchivedEvents(events);
  const visibleEvents = activeTab === "archived" ? archivedEvents : getEventsForTab(activeTab, groupedEvents);
  const upcomingEventsList = getEventsForTab("upcoming", groupedEvents);
  const nextEvent = upcomingEventsList[0];
  const needsAttentionCount = upcomingEventsList.filter((event) => {
    const eventTasks = tasks.filter((task) => task.eventId === event.id);
    const owner = users.find((user) => user.id === event.contactOwnerId);
    const assignedLeaders = eventLeaderAssignments[event.id] ?? [];
    return event.status === "stuck"
      || estimateMissingInformationCount(event) > 0
      || !owner
      || assignedLeaders.length === 0
      || eventTasks.some((task) => task.status === "blocked");
  }).length;

  return (
    <section className="events-workspace-panel events-lovable-workspace" id="events-workspace">
      <section className="ministry-mobile-command-strip event-mobile-command-strip" aria-label="Event priority">
        <div>
          <p className="eyebrow">Start here</p>
          <strong>{needsAttentionCount ? `${needsAttentionCount} event${needsAttentionCount === 1 ? "" : "s"} need attention` : "Upcoming events are ready"}</strong>
          <span>{nextEvent ? `${nextEvent.title} - ${formatDate(nextEvent.startTime)}` : "Create the next ministry event when you are ready."}</span>
        </div>
        <nav aria-label="Event quick actions">
          <a href="#event-list">Event cards</a>
          {canCreateEvent ? <button type="button" onClick={onCreateEvent}>New event</button> : null}
        </nav>
      </section>
      <div className="events-lovable-toolbar" aria-label="Event filters">
        <label className="mobile-event-filter-field">
          <span>Show events</span>
          <select className="input" value={activeTab} onChange={(event) => setActiveTab(event.target.value as EventTabKey)}>
            {(Object.keys(eventTabLabels) as EventTabKey[]).map((tabKey) => (
              <option key={tabKey} value={tabKey}>
                {eventTabLabels[tabKey]}
              </option>
            ))}
          </select>
        </label>
        <div className="events-lovable-tabs" role="tablist" aria-label="Event timeframe">
          {(Object.keys(eventTabLabels) as EventTabKey[]).map((tabKey) => (
            <button
              className={tabKey === activeTab ? "event-filter-tab active" : "event-filter-tab"}
              key={tabKey}
              type="button"
              role="tab"
              aria-selected={tabKey === activeTab}
              onClick={() => setActiveTab(tabKey)}
            >
              {eventTabLabels[tabKey]}
            </button>
          ))}
        </div>
        {canCreateEvent ? (
          <button className="button primary events-create-button" type="button" onClick={onCreateEvent}>
            <Plus aria-hidden="true" />
            Create New Event
          </button>
        ) : null}
      </div>

      <div className="event-lovable-list" id="event-list" aria-label={`${eventTabLabels[activeTab]} events`}>
        {visibleEvents.length ? (
          visibleEvents.map((event) => {
            const eventTasks = tasks.filter((task) => task.eventId === event.id);
            const completeTasks = eventTasks.filter((task) => task.status === "done").length;
            const owner = users.find((user) => user.id === event.contactOwnerId);
            const eventExpenses = expenses.filter((expense) => expense.eventId === event.id);
            const isExpanded = expandedEventIds.includes(event.id);
            const missingCount = estimateMissingInformationCount(event);
            const assignedLeaders = (eventLeaderAssignments[event.id] ?? [])
              .map((leaderId) => volunteerLeaders.find((leader) => leader.id === leaderId))
              .filter((leader): leader is VolunteerLeader => Boolean(leader));

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
                assignedLeaders={assignedLeaders}
                onToggleEvent={onToggleEvent}
                onOpenEvent={onOpenEvent}
                onUpdateTask={onUpdateTask}
                onUpdateEvent={onUpdateEvent}
                onArchiveEvent={onArchiveEvent}
                onRestoreEvent={onRestoreEvent}
                onDeleteEvent={onDeleteEvent}
                canSaveChanges={canSaveChanges}
                canDeleteArchivedEvent={canSaveChanges && activeRole === "admin"}
                users={users}
                onRefresh={onRefresh}
              />
            );
          })
        ) : (
          <div className="event-lovable-empty">
            <p className="muted">No events in this view yet.</p>
          </div>
        )}
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
  assignedLeaders,
  users,
  onToggleEvent,
  onOpenEvent,
  onUpdateTask,
  onUpdateEvent,
  onArchiveEvent,
  onRestoreEvent,
  onDeleteEvent,
  canSaveChanges,
  canDeleteArchivedEvent,
  onRefresh
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  owner?: User;
  expenses: EventExpense[];
  completeTasks: number;
  missingCount: number;
  isExpanded: boolean;
  assignedLeaders: VolunteerLeader[];
  users: User[];
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
  onArchiveEvent: (eventId: string) => Promise<void>;
  onRestoreEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  canSaveChanges: boolean;
  canDeleteArchivedEvent: boolean;
  onRefresh: () => Promise<void>;
}) {
  const rowTone = getEventRowTone(event);
  const actualBudget = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const readiness = getEventReadiness({
    event,
    tasks,
    completeTasks,
    missingCount,
    owner,
    assignedLeaders
  });

  return (
    <article className={`event-row event-row-card event-accent-card ${rowTone}`} data-start-time={event.startTime} style={eventAccentStyle(event.type)}>
      <div className="event-card-row event-lovable-card-row event-action-card-row" role="row">
        <EventIdentitySection event={event} tasks={tasks} completeTasks={completeTasks} owner={owner} assignedLeaders={assignedLeaders} />
        <EventReadinessPanel
          event={event}
          readiness={readiness}
          isExpanded={isExpanded}
          onToggleEvent={onToggleEvent}
          onOpenEvent={onOpenEvent}
        />
      </div>
      <EventDetailStrip
        event={event}
        tasks={tasks}
        completeTasks={completeTasks}
        actualBudget={actualBudget}
        missingCount={missingCount}
        isExpanded={isExpanded}
        onToggleEvent={onToggleEvent}
        onOpenEvent={onOpenEvent}
      />

      {isExpanded ? (
        <div className="event-expanded-resources">
          <EventPlanningDetails
            event={event}
            actualBudget={actualBudget}
            tasks={tasks}
            completeTasks={completeTasks}
            missingCount={missingCount}
            onOpenEvent={onOpenEvent}
            onUpdateEvent={onUpdateEvent}
            onArchiveEvent={onArchiveEvent}
            onRestoreEvent={onRestoreEvent}
            onDeleteEvent={onDeleteEvent}
            canSaveChanges={canSaveChanges}
            canDeleteArchivedEvent={canDeleteArchivedEvent}
          />
          <EventFilesPanel event={event} onRefresh={onRefresh} />
          <EventTaskTree event={event} tasks={tasks} users={users} canSaveChanges={canSaveChanges} onUpdateTask={onUpdateTask} onOpenEvent={onOpenEvent} />
        </div>
      ) : null}
    </article>
  );
}

type EventReadiness = {
  label: string;
  detail: string;
  nextAction: string;
  tone: "ready" | "warning" | "attention";
};

function getEventReadiness({
  event,
  tasks,
  completeTasks,
  missingCount,
  owner,
  assignedLeaders
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  completeTasks: number;
  missingCount: number;
  owner?: User;
  assignedLeaders: VolunteerLeader[];
}): EventReadiness {
  const openTasks = tasks.length - completeTasks;
  const missingDetails = [
    !event.targetGroup ? "audience" : "",
    !event.location ? "location" : "",
    !owner ? "owner" : "",
    !event.description.trim() ? "vision" : "",
    !assignedLeaders.length ? "leaders" : ""
  ].filter(Boolean);
  const firstMissing = missingDetails[0];

  if (event.archivedAt) {
    return {
      label: "Archived",
      detail: `Archived ${formatDate(event.archivedAt)}.`,
      nextAction: "Restore this event before making changes.",
      tone: "attention"
    };
  }

  if (firstMissing === "audience") {
    return {
      label: "Needs audience",
      detail: "Communication drafts need a clear target group.",
      nextAction: "Add audience before communication draft.",
      tone: "warning"
    };
  }

  if (firstMissing === "location") {
    return {
      label: "Needs location",
      detail: "Families and leaders still need to know where to go.",
      nextAction: "Add location before communication draft.",
      tone: "warning"
    };
  }

  if (firstMissing === "owner") {
    return {
      label: "Needs owner",
      detail: "No one owns the communication follow-through yet.",
      nextAction: "Assign an owner before this moves forward.",
      tone: "warning"
    };
  }

  if (firstMissing === "vision") {
    return {
      label: "Needs vision",
      detail: "The event purpose is still blank.",
      nextAction: "Add the short ministry purpose.",
      tone: "warning"
    };
  }

  if (firstMissing === "leaders") {
    return {
      label: "Needs leaders",
      detail: "No leaders are assigned to this event yet.",
      nextAction: "Assign leaders so the team knows who is serving.",
      tone: "warning"
    };
  }

  if (event.status === "stuck") {
    return {
      label: "Needs help",
      detail: "This event is marked stuck.",
      nextAction: "Review the blocker and choose the next owner.",
      tone: "attention"
    };
  }

  if (missingCount > 0) {
    return {
      label: "Needs details",
      detail: `${missingCount} planning detail${missingCount === 1 ? "" : "s"} still need review.`,
      nextAction: "Finish the missing planning details.",
      tone: "warning"
    };
  }

  return {
    label: openTasks ? "Ready for review" : "Ready",
    detail: openTasks ? `${openTasks} task${openTasks === 1 ? "" : "s"} still need follow-up.` : "All key info is complete.",
    nextAction: openTasks ? "Review tasks and assign owners." : "Keep this event ready.",
    tone: "ready"
  };
}

function getEventRowTone(event: MinistryEvent) {
  if (event.status === "stuck") return "event-date-stuck";
  if (event.status === "ready" || event.status === "completed") return "event-date-ready";

  const now = new Date();
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : start;
  const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (end < now) return "event-date-past";
  if (start <= now && end >= now) return "event-date-live";
  if (daysUntilStart <= 7) return "event-date-week";
  if (daysUntilStart <= 30) return "event-date-month";
  return "event-date-later";
}

function EventFilesPanel({ event, onRefresh }: { event: MinistryEvent; onRefresh: () => Promise<void> }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function refreshFiles() {
    setStatus("syncing");
    setMessage("Refreshing files from Google Drive...");
    const response = await fetch(`/api/events/${event.id}/google-drive-files/refresh`, { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { imported?: number; error?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Google Drive files could not be refreshed.");
      return;
    }
    setStatus("success");
    setMessage(payload.imported ? `${payload.imported} file${payload.imported === 1 ? "" : "s"} imported from Drive.` : "Drive files are current.");
    setRefreshKey((current) => current + 1);
    await onRefresh();
  }

  return (
    <div className="event-files-panel">
      <div className="event-files-toolbar">
        <div>
          <p className="eyebrow">Google Drive</p>
          <h3 className="section-title flush">Event Files</h3>
        </div>
        <div className="toolbar">
          {event.googleDriveFolderUrl ? (
            <a className="button compact-button" href={event.googleDriveFolderUrl} target="_blank" rel="noreferrer">
              Open Drive Folder
            </a>
          ) : null}
          <button className="button compact-button" type="button" disabled={status === "syncing"} onClick={() => void refreshFiles()}>
            <RotateCcw aria-hidden="true" />
            {status === "syncing" ? "Refreshing..." : "Refresh files"}
          </button>
        </div>
      </div>
      {message ? (
        <p className={status === "error" ? "resource-attachments-message error" : "resource-attachments-message"} role={status === "error" ? "alert" : undefined}>
          {message}
        </p>
      ) : null}
      <ResourceAttachments key={`${event.id}-${refreshKey}`} compact parentType="event" parentId={event.id} title="Event Files" />
    </div>
  );
}

function EventIdentitySection({
  event,
  tasks,
  completeTasks,
  owner,
  assignedLeaders
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  completeTasks: number;
  owner?: User;
  assignedLeaders: VolunteerLeader[];
}) {
  const { openEdit } = useEventCard();
  const startDate = event.startTime ? formatDate(event.startTime) : "Missing date";
  const timeRange = event.startTime ? formatEventTimeRange(event) : "Missing time";
  const volunteersNeeded = formatVolunteersNeeded(event);
  return (
    <div
      className="event-identity-section event-identity-clickable"
      role="cell"
      onClick={() => openEdit(event.id)}
    >
      <div className="event-status-line">
        <span className="event-type-tag">{eventTypeLabels[event.type]}</span>
        <span className="event-state-label">{humanizeStatus(event.status)}</span>
      </div>
      <div className="event-row-title">
        <button
          className="button ghost"
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            openEdit(event.id);
          }}
          aria-label={`Edit event: ${event.title}`}
        >
          {event.title}
        </button>
      </div>
      <div className="event-identity-meta lovable-event-meta">
        <span>
          <Clock3 aria-hidden="true" />
          {startDate} · {timeRange}
        </span>
        <span>
          <MapPin aria-hidden="true" />
          {event.location || "Location needed"}
        </span>
        <span>
          <UserRound aria-hidden="true" />
          {owner ? `${owner.firstName} ${owner.lastName}` : "Owner unassigned"}
          <span aria-hidden="true"> · </span>
          {volunteersNeeded}
        </span>
        <span>
          <UsersRound aria-hidden="true" />
          {assignedLeaders.length ? assignedLeaders.map((leader) => leader.name).join(", ") : "No leaders assigned"}
        </span>
        <span className="sr-only">
          {completeTasks} of {tasks.length} checklist tasks complete
        </span>
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

function EventReadinessPanel({
  event,
  readiness,
  isExpanded,
  onToggleEvent,
  onOpenEvent
}: {
  event: MinistryEvent;
  readiness: EventReadiness;
  isExpanded: boolean;
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <section className={`event-readiness-panel event-readiness-${readiness.tone}`} role="cell" aria-label={`${event.title} readiness`}>
      <div className="event-readiness-copy">
        <span className="summary-label">Readiness</span>
        <strong>{readiness.label}</strong>
        <p>{readiness.detail}</p>
      </div>
      <div className="event-next-action">
        <span>Next</span>
        <p>{readiness.nextAction}</p>
      </div>
      <div className="event-card-actions">
        <button className="button primary" type="button" onClick={() => onOpenEvent(event.id)}>
          {readiness.tone === "ready" ? "Open event" : "Fix missing info"}
        </button>
        <button
          className="button compact-button"
          type="button"
          onClick={() => onToggleEvent(event.id)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Hide details" : "View tasks"}
        </button>
      </div>
    </section>
  );
}

function EventDetailStrip({
  event,
  tasks,
  completeTasks,
  actualBudget,
  missingCount,
  isExpanded,
  onToggleEvent,
  onOpenEvent
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  completeTasks: number;
  actualBudget: number;
  missingCount: number;
  isExpanded: boolean;
  onToggleEvent: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const filesCount = Math.max(1, Math.ceil(tasks.length / 2));
  const communicationCount = missingCount ? `${missingCount} missing` : "ready";
  const budgetLabel = actualBudget ? money(actualBudget) : event.budgetTarget ? money(event.budgetTarget) : "missing";
  const details = [
    { label: "Tasks", value: `${completeTasks}/${tasks.length}`, action: "toggle" },
    { label: "Comms", value: communicationCount, action: "open" },
    { label: "Budget", value: budgetLabel, action: "open" },
    { label: "Files", value: `${filesCount}`, action: "toggle" },
    { label: "History", value: "log", action: "open" }
  ] as const;

  return (
    <div className="event-detail-strip" aria-label={`${event.title} detail sections`}>
      {details.map((detail) => (
        <button
          className="event-detail-button"
          key={detail.label}
          type="button"
          aria-expanded={detail.action === "toggle" ? isExpanded : undefined}
          onClick={() => detail.action === "toggle" ? onToggleEvent(event.id) : onOpenEvent(event.id)}
        >
          <span>{detail.label}</span>
          <strong>{detail.value}</strong>
        </button>
      ))}
    </div>
  );
}

function EventPlanningDetails({
  event,
  actualBudget,
  tasks,
  completeTasks,
  missingCount,
  onOpenEvent,
  onUpdateEvent,
  onArchiveEvent,
  onRestoreEvent,
  onDeleteEvent,
  canSaveChanges,
  canDeleteArchivedEvent
}: {
  event: MinistryEvent;
  actualBudget: number;
  tasks: ActiveTask[];
  completeTasks: number;
  missingCount: number;
  onOpenEvent: (eventId: string) => void;
  onUpdateEvent: (eventId: string, body: Partial<MinistryEvent>) => Promise<void>;
  onArchiveEvent: (eventId: string) => Promise<void>;
  onRestoreEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  canSaveChanges: boolean;
  canDeleteArchivedEvent: boolean;
}) {
  const openTasks = tasks.length - completeTasks;
  const communicationStatus = missingCount === 0 ? "Preview ready" : `${missingCount} item${missingCount === 1 ? "" : "s"} needed`;
  const driveStatus = event.googleDriveFolderId ? "Google Drive folder ready" : "No folder yet";
  const priority = event.type === "conference" ? "High" : event.type === "missions_trip" ? "Medium" : "Normal";

  return (
    <section className="event-summary-shell event-planning-details" aria-label={`${event.title} planning details`}>
      <div className="event-summary-heading">
        <h3>Planning details</h3>
      </div>
      <div className="event-summary-scroll" aria-label={`${event.title} planning details`}>
        {event.googleImportStatus === "planning_details_incomplete" ? (
          <div className="summary-field warning google-import-summary">
            <span className="summary-label">Google import</span>
            <strong>Imported from Google Calendar</strong>
            <span>Planning details incomplete</span>
          </div>
        ) : null}
        <div className="summary-field action-field notes-summary-field">
          <span className="summary-label">Internal notes</span>
          <NotesPanel
            id={`event-row-notes-${event.id}`}
            label={`${event.title} event`}
            value={event.notes ?? ""}
            compact
            readOnly={!canSaveChanges}
            onSave={(notes) => onUpdateEvent(event.id, { notes })}
          />
        </div>
        <EventSummaryField label="Budget proposed" value={event.budgetTarget ? money(event.budgetTarget) : "Missing target"} tone={event.budgetTarget ? undefined : "warning"} />
        <EventSummaryField label="Budget actual" value={actualBudget ? money(actualBudget) : "$0 recorded"} />
        <EventSummaryField label="Registration status" value={event.registrationDeadline ? `Due ${formatDate(event.registrationDeadline)}` : "Not configured"} tone="warning" />
        <EventSummaryField label="Planning Center status" value="Adapter ready" tone="stub" />
        <EventSummaryField label="Drive folder status" value={driveStatus} tone={event.googleDriveFolderId ? "success" : "warning"} />
        <EventSummaryField label="Calendar sync" value={event.googleCalendarEventId ? "Synced to Emerge" : "Not synced yet"} tone={event.googleCalendarEventId ? "success" : "warning"} />
        <EventSummaryField label="Parent email status" value={communicationStatus} tone={missingCount ? "warning" : "success"} />
        <EventSummaryField label="GroupMe status" value="Preview only" tone="stub" />
        <EventSummaryField label="Text status" value="Preview only" tone="stub" />
        <EventSummaryField label="Files status" value={event.googleDriveFolderId ? "Folder linked" : "No folder yet"} tone={event.googleDriveFolderId ? "success" : "warning"} />
        <EventSummaryField label="Checklist progress" value={`${completeTasks}/${tasks.length} complete`} tone={openTasks ? undefined : "success"} />
        <EventSummaryField label="Missing info count" value={`${missingCount} open`} tone={missingCount ? "warning" : "success"} />
        <EventSummaryField label="Priority" value={priority} tone={priority === "High" ? "warning" : undefined} />
        {event.archivedAt ? <EventSummaryField label="Archived" value={formatDate(event.archivedAt)} tone="warning" /> : null}
        <EventSummaryField label="Last updated" value={formatDate(event.createdAt)} />
        <div className="summary-field action-field">
          <span className="summary-label">Edit Event</span>
          <button className="button primary" type="button" onClick={() => onOpenEvent(event.id)}>
            Open event
          </button>
          {event.googleCalendarEventUrl ? (
            <a className="button compact-button" href={event.googleCalendarEventUrl} target="_blank" rel="noreferrer">
              Open in Google Calendar
            </a>
          ) : null}
          {event.googleDriveFolderUrl ? (
            <a className="button compact-button" href={event.googleDriveFolderUrl} target="_blank" rel="noreferrer">
              Open Drive Folder
            </a>
          ) : null}
          {event.archivedAt ? (
            <>
              <button className="button compact-button" type="button" disabled={!canSaveChanges} onClick={() => void onRestoreEvent(event.id)}>
                <RotateCcw aria-hidden="true" />
                Restore event
              </button>
              {canDeleteArchivedEvent ? (
                <button className="button compact-button danger" type="button" disabled={!canSaveChanges} onClick={() => void onDeleteEvent(event.id)}>
                  <Trash2 aria-hidden="true" />
                  Delete archived event
                </button>
              ) : null}
            </>
          ) : (
            <button className="button compact-button" type="button" disabled={!canSaveChanges} onClick={() => void onArchiveEvent(event.id)}>
              <Archive aria-hidden="true" />
              Archive event
            </button>
          )}
          {event.id.startsWith("guest_evt") && !event.archivedAt ? (
            <button className="button compact-button" type="button" disabled={!canSaveChanges} onClick={() => void onDeleteEvent(event.id)}>
              Delete fake event
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EventOperationsRail({
  event,
  tasks,
  completeTasks,
  missingCount
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  completeTasks: number;
  missingCount: number;
}) {
  const totalTasks = Math.max(tasks.length, 1);
  const progress = Math.round((completeTasks / totalTasks) * 100);
  const volunteersNeeded = estimateVolunteersNeeded(event, tasks);
  const filesCount = Math.max(1, Math.ceil(tasks.length / 2));
  const parentStatus = missingCount === 0 ? "P:Sent" : "P:Draft";
  const leaderStatus = event.status === "ready" || event.status === "completed" ? "L:Ready" : "L:Draft";

  return (
    <aside className="event-operations-rail" role="cell" aria-label={`${event.title} operations snapshot`}>
      <div className="event-rail-metric">
        <div>
          <span>
            <CheckSquare aria-hidden="true" />
            Checklist
          </span>
          <strong>{completeTasks}/{tasks.length}</strong>
        </div>
        <div className="event-rail-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="event-rail-metric">
        <span>
          <UsersRound aria-hidden="true" />
          Volunteers
        </span>
        <strong className={volunteersNeeded.includes("needed") ? "event-rail-warning" : "event-rail-ready"}>
          {volunteersNeeded}
        </strong>
      </div>

      <div className="event-rail-footer">
        <span>
          <FileText aria-hidden="true" />
          {filesCount} files
        </span>
        <span>{parentStatus} · {leaderStatus}</span>
      </div>
    </aside>
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
  readOnly = false,
  onSave
}: {
  id: string;
  label: string;
  value: string;
  compact?: boolean;
  readOnly?: boolean;
  onSave: (notes: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function saveNotes() {
    if (readOnly) return;
    setSaveState("saving");
    await onSave(draft);
    setSaveState("saved");
  }

  return (
    <div className={compact ? "notes-panel compact-notes" : "notes-panel"}>
      <button className="button compact-button" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        {readOnly ? (value.trim() ? "View notes" : "No notes") : value.trim() ? "Notes added" : "Notes"}
      </button>
      {isOpen ? (
        <div className="notes-editor">
          <label htmlFor={id}>Internal notes for {label}</label>
          <textarea
            className="input"
            id={id}
            rows={compact ? 3 : 4}
            value={draft}
            readOnly={readOnly}
            onChange={(event) => {
              if (readOnly) return;
              setDraft(event.target.value);
              setSaveState("idle");
            }}
          />
          <div className="toolbar notes-actions">
            {!readOnly ? <button className="button compact-button" type="button" onClick={() => void saveNotes()} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving..." : "Save notes"}
            </button> : null}
            <span className="muted">{readOnly ? "Read only." : saveState === "saved" ? "Saved internally." : "Internal only."}</span>
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
  canSaveChanges,
  onUpdateTask,
  onOpenEvent
}: {
  event: MinistryEvent;
  tasks: ActiveTask[];
  users: User[];
  canSaveChanges: boolean;
  onUpdateTask: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <div className="event-task-tree-wrap">
      <div className="event-task-tree" aria-label={`${event.title} subtasks`}>
        {tasks.map((task) => (
          <EventTaskTreeItem key={task.id} task={task} users={users} canSaveChanges={canSaveChanges} onUpdateTask={onUpdateTask} onOpenEvent={onOpenEvent} />
        ))}
      </div>
    </div>
  );
}

function EventTaskTreeItem({
  task,
  users,
  canSaveChanges,
  onUpdateTask,
  onOpenEvent
}: {
  task: ActiveTask;
  users: User[];
  canSaveChanges: boolean;
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
        <input
          className="input"
          id={`event-due-${task.id}`}
          type="date"
          value={dueDate}
          disabled={!canSaveChanges}
          aria-label={`Due date for ${task.taskTitle}`}
          onChange={(event) => void saveDueDate(event.target.value)}
        />
        <span className="inline-save-state">{!canSaveChanges ? "Read only" : dueSaveState === "saving" ? "Saving..." : dueSaveState === "saved" ? "Saved" : "Autosaves"}</span>
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
          disabled={!canSaveChanges}
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
        <span>Task resources below</span>
      </div>
      <div className="task-tree-notes">
        <span className="summary-label">Notes</span>
        <NotesPanel
          id={`task-tree-notes-${task.id}`}
          label={`${task.taskTitle} task`}
          value={task.notes ?? ""}
          compact
          readOnly={!canSaveChanges}
          onSave={(notes) => onUpdateTask(task.id, { notes })}
        />
      </div>
      <button className="button compact-button" type="button" onClick={() => onOpenEvent(task.eventId)}>
        Open
      </button>
      <div className="task-tree-resource-panel">
        <ResourceAttachments compact parentType="event_task" parentId={task.id} title="Task Resources" />
      </div>
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
  if (event.volunteersNeeded !== undefined) return formatVolunteersNeeded(event);
  const leaderAssignedOpenTasks = tasks.filter((task) => task.assignedUserId === "usr_leader" && task.status !== "done").length;
  const baseline = event.type === "conference" ? 6 : event.type === "missions_trip" ? 4 : 2;
  return `${Math.max(baseline, leaderAssignedOpenTasks)} needed`;
}

function formatVolunteersNeeded(event: MinistryEvent) {
  const count = event.volunteersNeeded;
  if (typeof count === "number" && Number.isFinite(count)) {
    return `${count} volunteer${count === 1 ? "" : "s"} needed`;
  }
  return "Volunteers needed";
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

  events
    .filter((event) => !event.archivedAt)
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

function getEventsForTab(activeTab: EventTabKey, groupedEvents: Record<EventGroupKey, MinistryEvent[]>) {
  if (activeTab === "archived") return [];
  if (activeTab === "upcoming") {
    return [...groupedEvents.thisWeek, ...groupedEvents.thisMonth, ...groupedEvents.longRange];
  }
  return groupedEvents[activeTab];
}

function getArchivedEvents(events: MinistryEvent[]) {
  return events
    .filter((event) => event.archivedAt)
    .sort((first, second) => new Date(second.archivedAt ?? 0).getTime() - new Date(first.archivedAt ?? 0).getTime());
}

function humanizeStatus(status: MinistryEvent["status"]) {
  return status.replace(/_/g, " ").toUpperCase();
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
  event,
  canSaveChanges,
  onUpdate,
  onDelete
}: {
  task: ActiveTask;
  users: User[];
  event?: MinistryEvent;
  canSaveChanges: boolean;
  onUpdate: (taskId: string, body: Partial<ActiveTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
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
    <article className={task.status === "blocked" ? "task-card task-event-accent attention" : "task-card task-event-accent"} style={event ? eventAccentStyle(event.type) : undefined}>
      <div>
        <strong className="task-card-title">{task.taskTitle}</strong>
        <div className="task-card-event">{event?.title ?? "Event"}</div>
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

      <details className="task-card-management">
        <summary>Manage task</summary>
      {isEditing ? (
        <div className="task-edit-panel">
          <div className="field">
            <label htmlFor={`status-${task.id}`}>Status</label>
            <select
              className="input"
              id={`status-${task.id}`}
              value={task.status}
              disabled={!canSaveChanges}
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
              disabled={!canSaveChanges}
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
            <input className="input" id={`title-${task.id}`} value={title} disabled={!canSaveChanges} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`due-${task.id}`}>Due date</label>
            <input className="input" id={`due-${task.id}`} type="date" value={dueDate} disabled={!canSaveChanges} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>
      ) : null}

      <NotesPanel
        id={`task-card-notes-${task.id}`}
        label={`${task.taskTitle} task`}
        value={task.notes ?? ""}
        compact
        readOnly={!canSaveChanges}
        onSave={(notes) => onUpdate(task.id, { notes })}
      />

      <div className="toolbar">
        {isEditing ? (
          <button
            className="button"
            type="button"
            disabled={!canSaveChanges}
            onClick={() => {
              setIsEditing(false);
              void onUpdate(task.id, { taskTitle: title, dueDate: new Date(`${dueDate}T12:00:00`).toISOString() });
            }}
          >
            Save
          </button>
        ) : (
          <button className="button" type="button" disabled={!canSaveChanges} onClick={() => setIsEditing(true)}>
            Edit
          </button>
        )}
        <button className="button" type="button" onClick={() => openEdit(task.eventId)}>
          Open event
        </button>
        {task.id.startsWith("guest_task") ? (
          <button className="button compact-button" type="button" disabled={!canSaveChanges} onClick={() => void onDelete(task.id)}>
            Delete fake task
          </button>
        ) : null}
      </div>
      </details>
    </article>
  );
}
function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
