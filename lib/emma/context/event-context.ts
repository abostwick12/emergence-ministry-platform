import { buildContextManifest, containsForbiddenKeys } from "@/lib/emma/context";
import { emmaErrors } from "@/lib/emma/errors";
import type { ContextManifest, SafeEventPlanningContext } from "@/lib/emma/types";
import type { EventStatus, EventWorkspace, MinistryEvent } from "@/lib/types";

export interface EmmaEventSafeContext {
  contextManifest: ContextManifest;
  safeEventContext: SafeEventPlanningContext;
}

export function buildSafeEventEmmaContext(workspace: EventWorkspace): EmmaEventSafeContext {
  const safeEventContext = toSafeEventPlanningContext(workspace.event, workspace.missingInformation.map((item) => item.label));
  const contextManifest: ContextManifest = {
    ...buildContextManifest([
      {
        recordId: workspace.event.id,
        recordType: "event",
        category: "event",
        sourceTable: "events"
      },
      ...workspace.tasks.map((task) => ({
        recordId: task.id,
        recordType: "task",
        category: "task",
        sourceTable: "tasks"
      })),
      ...workspace.activity.slice(0, 10).map((item) => ({
        recordId: item.id,
        recordType: "activity_log",
        category: "activity_log",
        sourceTable: "activity_logs"
      })),
      ...workspace.expenses.map((expense) => ({
        recordId: expense.id,
        recordType: "budget_item",
        category: "budget",
        sourceTable: "events"
      }))
    ]),
    safeEventContext
  };

  if (containsForbiddenKeys(contextManifest)) {
    throw emmaErrors.restrictedContext();
  }

  return { contextManifest, safeEventContext };
}

function toSafeEventPlanningContext(event: MinistryEvent, missingInformation: string[]): SafeEventPlanningContext {
  return {
    eventId: event.id,
    title: event.title,
    eventType: event.type,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? null,
    targetGroup: event.targetGroup ?? null,
    ownerId: event.contactOwnerId ?? null,
    status: toSafeEventStatus(event.status),
    priority: event.priority ?? null,
    volunteersNeeded: event.volunteersNeeded ?? null,
    description: event.description || null,
    missingInformation
  };
}

function toSafeEventStatus(status: string): EventStatus {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "draft":
    case "planning":
    case "ready":
    case "not_started":
    case "in_progress":
    case "working_on_it":
    case "stuck":
    case "completed":
      return normalized;
    case "notstart":
    case "notstarted":
      return "not_started";
    case "inprogress":
      return "in_progress";
    case "working":
    case "working_on":
      return "working_on_it";
    case "complete":
    case "done":
      return "completed";
    default:
      return "planning";
  }
}
