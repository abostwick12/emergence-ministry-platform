import type { EventType, TemplateTask } from "./types";

export const eventTypeLabels: Record<EventType, string> = {
  retreat: "Retreat",
  weekly: "Weekly Gathering",
  service: "Service Project",
  camp: "Camp"
};

export const defaultTemplateTasks: Record<EventType, TemplateTask[]> = {
  retreat: [
    { id: "retreat-1", taskTitle: "Confirm venue contract and deposit", timelineOffsetDays: -45, roleAssigned: "admin" },
    { id: "retreat-2", taskTitle: "Draft parent communication preview", timelineOffsetDays: -30, roleAssigned: "leader" },
    { id: "retreat-3", taskTitle: "Assign small group cabin leaders", timelineOffsetDays: -21, roleAssigned: "leader" },
    { id: "retreat-4", taskTitle: "Prepare check-in roster and QR plan", timelineOffsetDays: -7, roleAssigned: "admin" }
  ],
  weekly: [
    { id: "weekly-1", taskTitle: "Confirm teaching plan and service flow", timelineOffsetDays: -7, roleAssigned: "leader" },
    { id: "weekly-2", taskTitle: "Prepare ProPresenter playlist stub", timelineOffsetDays: -5, roleAssigned: "leader" },
    { id: "weekly-3", taskTitle: "Send leader brief preview", timelineOffsetDays: -2, roleAssigned: "admin" }
  ],
  service: [
    { id: "service-1", taskTitle: "Confirm partner organization details", timelineOffsetDays: -21, roleAssigned: "admin" },
    { id: "service-2", taskTitle: "Collect permission and transportation needs", timelineOffsetDays: -14, roleAssigned: "leader" },
    { id: "service-3", taskTitle: "Prepare parent logistics preview", timelineOffsetDays: -7, roleAssigned: "leader" }
  ],
  camp: [
    { id: "camp-1", taskTitle: "Publish registration deadline", timelineOffsetDays: -90, roleAssigned: "admin" },
    { id: "camp-2", taskTitle: "Build packing list communication preview", timelineOffsetDays: -45, roleAssigned: "leader" },
    { id: "camp-3", taskTitle: "Finalize volunteer load and rooming", timelineOffsetDays: -21, roleAssigned: "leader" },
    { id: "camp-4", taskTitle: "Prepare check-in and payment reminder preview", timelineOffsetDays: -10, roleAssigned: "admin" }
  ]
};
