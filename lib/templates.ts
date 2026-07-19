import type { EventType, TemplateTask } from "./types";
export { eventTypeLabels, eventTypes } from "./event-categories";

const retreatTemplateTasks: TemplateTask[] = [
    { id: "retreat-1", taskTitle: "Confirm venue contract and deposit", timelineOffsetDays: -45, roleAssigned: "admin" },
    { id: "retreat-2", taskTitle: "Draft parent communication preview", timelineOffsetDays: -30, roleAssigned: "leader" },
    { id: "retreat-3", taskTitle: "Assign small group cabin leaders", timelineOffsetDays: -21, roleAssigned: "leader" },
    { id: "retreat-4", taskTitle: "Prepare check-in roster and QR plan", timelineOffsetDays: -7, roleAssigned: "admin" }
  ];

const weeklyTemplateTasks: TemplateTask[] = [
    { id: "weekly-1", taskTitle: "Confirm teaching plan and service flow", timelineOffsetDays: -7, roleAssigned: "leader" },
    { id: "weekly-2", taskTitle: "Prepare ProPresenter playlist stub", timelineOffsetDays: -5, roleAssigned: "leader" },
    { id: "weekly-3", taskTitle: "Send leader brief preview", timelineOffsetDays: -2, roleAssigned: "admin" }
  ];

const serviceTemplateTasks: TemplateTask[] = [
    { id: "service-1", taskTitle: "Confirm partner organization details", timelineOffsetDays: -21, roleAssigned: "admin" },
    { id: "service-2", taskTitle: "Collect permission and transportation needs", timelineOffsetDays: -14, roleAssigned: "leader" },
    { id: "service-3", taskTitle: "Prepare parent logistics preview", timelineOffsetDays: -7, roleAssigned: "leader" }
  ];

export const defaultTemplateTasks: Record<EventType, TemplateTask[]> = {
  sunday_morning_service: weeklyTemplateTasks,
  sunday_evening_service: weeklyTemplateTasks,
  middle_school_event: weeklyTemplateTasks,
  high_school_event: weeklyTemplateTasks,
  small_group_gathering: weeklyTemplateTasks,
  missions_trip: serviceTemplateTasks,
  conference: retreatTemplateTasks,
  combined_event: weeklyTemplateTasks,
  other: weeklyTemplateTasks
};
