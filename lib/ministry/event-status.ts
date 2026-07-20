import type { ActiveTask, EventStatus, MinistryEvent, TaskStatus } from "@/lib/types";

export function deriveEventStatusFromTasks(tasks: ActiveTask[]): EventStatus | null {
  return deriveEventStatusFromTaskStatuses(tasks);
}

export function deriveEventStatusFromTaskStatuses(tasks: Array<{ status: TaskStatus }>): EventStatus | null {
  if (!tasks.length) return null;
  if (tasks.some((task) => task.status === "blocked")) return "stuck";
  if (tasks.every((task) => task.status === "done")) return "ready";
  if (tasks.some((task) => task.status === "in_progress" || task.status === "done")) return "working_on_it";
  return "planning";
}

export function applyTaskDerivedEventStatuses(events: MinistryEvent[], tasks: ActiveTask[]): MinistryEvent[] {
  const tasksByEventId = new Map<string, ActiveTask[]>();
  tasks.forEach((task) => {
    const eventTasks = tasksByEventId.get(task.eventId) ?? [];
    eventTasks.push(task);
    tasksByEventId.set(task.eventId, eventTasks);
  });

  return events.map((event) => {
    const derivedStatus = deriveEventStatusFromTasks(tasksByEventId.get(event.id) ?? []);
    return derivedStatus && derivedStatus !== event.status ? { ...event, status: derivedStatus } : event;
  });
}
