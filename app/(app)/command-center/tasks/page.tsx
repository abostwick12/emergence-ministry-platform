"use client";

import { useEffect, useMemo, useState } from "react";
import { DOMAIN_LABELS, DOMAIN_ORDER, domainClassName } from "@/components/command-center/domain-meta";
import type { PersonalDomain, PersonalTask, PersonalTaskPriority, PersonalTaskStatus } from "@/lib/command-center/types";
import { formatDate } from "@/lib/utils";

const STATUS_COLUMNS: { status: PersonalTaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" }
];

export default function CommandCenterTasksPage() {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [domainFilter, setDomainFilter] = useState<PersonalDomain | "all">("all");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState<PersonalDomain>("military_transition");
  const [error, setError] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/tasks");
      if (!response.ok) throw new Error("Failed to load tasks");
      const data = (await response.json()) as { tasks: PersonalTask[] };
      setTasks(data.tasks);
    } catch {
      setError("Tasks could not be loaded. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const visibleTasks = useMemo(
    () => (domainFilter === "all" ? tasks : tasks.filter((task) => task.domain === domainFilter)),
    [tasks, domainFilter]
  );

  async function updateStatus(id: string, status: PersonalTaskStatus) {
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
    setError(null);
    const response = await fetch(`/api/command-center/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setTasks(previous);
      setError("Task status could not be saved.");
    }
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setError(null);
    const response = await fetch("/api/command-center/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomain, title, status: "todo", priority: "medium" as PersonalTaskPriority })
    });
    if (!response.ok) {
      setError("Task could not be created.");
      return;
    }
    const task = (await response.json()) as PersonalTask;
    setTasks((current) => [task, ...current]);
    setNewTitle("");
  }

  async function deleteTask(id: string) {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));
    setError(null);
    const response = await fetch(`/api/command-center/tasks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setTasks(previous);
      setError("Task could not be deleted.");
    }
  }

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Task Workspace</p>
        <h2 className="section-title flush">Personal Tasks</h2>

        <div className="toolbar">
          <button className={domainFilter === "all" ? "button primary" : "button"} type="button" onClick={() => setDomainFilter("all")}>
            All
          </button>
          {DOMAIN_ORDER.map((domain) => (
            <button
              className={domainFilter === domain ? "button primary" : "button"}
              key={domain}
              type="button"
              onClick={() => setDomainFilter(domain)}
            >
              {DOMAIN_LABELS[domain]}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <select value={newDomain} onChange={(event) => setNewDomain(event.target.value as PersonalDomain)}>
            {DOMAIN_ORDER.map((domain) => (
              <option key={domain} value={domain}>
                {DOMAIN_LABELS[domain]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="New task title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
            }}
          />
          <button className="button primary" type="button" onClick={addTask}>
            + Add Task
          </button>
        </div>
        {error ? (
          <p className="muted" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {loading ? (
        <p className="muted">Loading tasks...</p>
      ) : (
        <div className="kanban task-board">
          {STATUS_COLUMNS.map((column) => {
            const columnTasks = visibleTasks.filter((task) => task.status === column.status);
            return (
              <div className="kanban-column task-lane" key={column.status}>
                <div className="toolbar split">
                  <strong>{column.label}</strong>
                  <span className="pill">{columnTasks.length}</span>
                </div>
                {columnTasks.length === 0 ? <p className="kanban-empty">No tasks in this lane.</p> : null}
                {columnTasks.map((task) => (
                  <article className={`task-card command-center-task-card ${domainClassName(task.domain)}`} key={task.id}>
                    <strong className="task-card-title">{task.title}</strong>
                    <div className="task-card-event">{DOMAIN_LABELS[task.domain]}</div>
                    {task.description ? <p className="muted">{task.description}</p> : null}
                    <div className="toolbar split">
                      {task.dueDate ? <span className="task-card-date">Due {formatDate(task.dueDate)}</span> : <span />}
                      <span className={task.priority === "critical" ? "pill red" : task.priority === "high" ? "pill amber" : "pill"}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="toolbar">
                      <select value={task.status} onChange={(event) => updateStatus(task.id, event.target.value as PersonalTaskStatus)}>
                        {STATUS_COLUMNS.map((option) => (
                          <option key={option.status} value={option.status}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button className="button danger" type="button" onClick={() => deleteTask(task.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
