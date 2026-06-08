"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { eventTypeLabels } from "@/lib/templates";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import type {
  ActiveTask,
  ActivityLog,
  CommunicationPackage,
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
  activity: ActivityLog[];
};

const statuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done"
};

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

const eventTypes: EventType[] = ["retreat", "weekly", "service", "camp"];

export default function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [workspace, setWorkspace] = useState<EventWorkspace | null>(null);
  const [activeRole, setActiveRole] = useState<Role>("admin");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("Stub Mode active. No live credentials are required.");

  async function loadOverview(nextSelectedId?: string) {
    const response = await fetch("/api/events", { cache: "no-store" });
    const data = (await response.json()) as Overview;
    setOverview(data);
    const fallbackId = nextSelectedId || selectedEventId || data.events[0]?.id || "";
    setSelectedEventId(fallbackId);
    if (fallbackId) {
      await loadWorkspace(fallbackId);
    }
    setIsLoading(false);
  }

  async function loadWorkspace(eventId: string) {
    const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
    if (!response.ok) return;
    setWorkspace((await response.json()) as EventWorkspace);
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setNotice(`Created ${created.event.title} and generated baseline timeline tasks.`);
    await refresh(created.event.id);
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
      setNotice("Event update failed. Check the event details and try again.");
      return;
    }

    setNotice("Event details updated.");
    await refresh(eventId);
  }

  async function postEventAction(path: string, message: string) {
    if (!selectedEventId) return;
    await fetch(`/api/events/${selectedEventId}/${path}`, { method: "POST" });
    setNotice(message);
    await refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="toolbar" style={{ alignItems: "center", marginBottom: 28 }}>
          <div className="brand-mark" aria-hidden="true">
            EM
          </div>
          <div>
            <strong>Emerge</strong>
            <div className="muted" style={{ color: "#cbd5e1" }}>
              Ministry Work Platform
            </div>
          </div>
        </div>

        <div className="visual-strip" aria-label="Ministry operations workspace visual">
          <span>Events, tasks, communication previews, budgets, and Stub Mode integrations in one workspace.</span>
        </div>

        <div style={{ marginTop: 24 }}>
          <p className="eyebrow" style={{ color: "#93c5fd" }}>
            Active MVP Roles
          </p>
          <div className="toolbar" role="group" aria-label="Switch active role">
            {(["admin", "leader"] as Role[]).map((role) => (
              <button
                className={activeRole === role ? "button primary" : "button"}
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18, background: "#111c31", borderColor: "#263244" }}>
          <p className="eyebrow" style={{ color: "#93c5fd" }}>
            Future Roles
          </p>
          <p style={{ margin: 0, color: "#dbeafe" }}>Student and Parent roles are authorization placeholders only in MVP 1.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP 1 / Stub Mode</p>
            <h1 className="title">Event Automation Workspace</h1>
          </div>
          <span className="pill stub">Stub Mode</span>
        </header>

        <div className="panel" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>

        {isLoading || !overview ? (
          <section className="panel">Loading ministry workspace...</section>
        ) : (
          <div className="grid">
            <section className="grid grid-3" aria-label="Dashboard metrics">
              <Metric label="Events" value={overview.events.length.toString()} />
              <Metric label="Task Completion" value={`${doneTasks}/${totalTasks}`} />
              <Metric label="Blocked Tasks" value={blockedTasks.toString()} />
            </section>

            <section className="grid grid-2">
              <div className="grid">
                {activeRole === "admin" ? (
                  <EventForm users={activeUsers} onSubmit={createEvent} />
                ) : (
                  <section className="panel">
                    <p className="eyebrow">Leader View</p>
                    <h2 className="section-title">Assigned Ministry Work</h2>
                    <p className="muted" style={{ margin: 0 }}>
                      Leaders can move assigned tasks through statuses and review event workspace details. Event creation is
                      Admin-only in MVP 1.
                    </p>
                  </section>
                )}

                <section className="panel">
                  <h2 className="section-title">Kanban Dashboard</h2>
                  <div className="kanban">
                    {statuses.map((status) => (
                      <div className="kanban-column" key={status}>
                        <div className="toolbar" style={{ justifyContent: "space-between" }}>
                          <strong>{statusLabels[status]}</strong>
                          <span className={status === "done" ? "pill done" : status === "blocked" ? "pill blocked" : "pill"}>
                            {visibleTasks.filter((task) => task.status === status).length}
                          </span>
                        </div>
                        {visibleTasks
                          .filter((task) => task.status === status)
                          .map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              users={activeUsers}
                              eventTitle={overview.events.find((event) => event.id === task.eventId)?.title ?? "Event"}
                              onSelectEvent={() => {
                                setSelectedEventId(task.eventId);
                                void loadWorkspace(task.eventId);
                              }}
                              onUpdate={updateTask}
                            />
                          ))}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid">
                <section className="panel">
                  <h2 className="section-title">Events</h2>
                  <div className="grid">
                    {overview.events.map((event) => (
                      <button
                        className={event.id === selectedEventId ? "card" : "button"}
                        key={event.id}
                        type="button"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          void loadWorkspace(event.id);
                        }}
                        style={{ textAlign: "left", justifyContent: "flex-start" }}
                      >
                        <span>
                          <strong>{event.title}</strong>
                          <br />
                          <span className="muted">
                            {eventTypeLabels[event.type]} / {formatDateTime(event.startTime)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

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
              </div>
            </section>
          </div>
        )}
      </main>
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

function EventForm({ users, onSubmit }: { users: User[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="panel">
      <p className="eyebrow">Admin</p>
      <h2 className="section-title">Create Event</h2>
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
    </section>
  );
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

  useEffect(() => {
    setTitle(task.taskTitle);
    setDueDate(toDateInputValue(task.dueDate));
  }, [task.dueDate, task.taskTitle]);

  return (
    <article className="task-card">
      <div>
        <strong>{task.taskTitle}</strong>
        <div className="muted">{eventTitle}</div>
        <div className="muted">Due {formatDate(task.dueDate)}</div>
      </div>
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
      <div className="toolbar">
        <button
          className="button"
          type="button"
          onClick={() => void onUpdate(task.id, { taskTitle: title, dueDate: new Date(`${dueDate}T12:00:00`).toISOString() })}
        >
          Save
        </button>
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
    <section className="panel">
      <p className="eyebrow">Event Detail</p>
      <h2 className="section-title">{workspace.event.title}</h2>
      <p className="muted">
        {eventTypeLabels[workspace.event.type]} / {formatDateTime(workspace.event.startTime)}
      </p>

      <div className="grid">
        <EventDetailsForm key={workspace.event.id} workspace={workspace} users={users} onUpdateEvent={onUpdateEvent} />
        <MissingInformationPanel items={workspace.missingInformation} />

        <section className="card">
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

        <section className="card">
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

        <section className="card">
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
          Save event details
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
        <p className="muted">Required event details are ready for preview and Stub Mode workflows.</p>
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
          <span className="pill">Preview only</span>
          <h4>{item.payload.subject}</h4>
          <p className="muted">{item.payload.body}</p>
        </article>
      ))}
    </div>
  );
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

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
