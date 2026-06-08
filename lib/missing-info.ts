import type { EventExpense, MinistryEvent, MissingInformationItem } from "./types";

export function getMissingInformation(event: MinistryEvent, expenses: EventExpense[]): MissingInformationItem[] {
  const items: MissingInformationItem[] = [];

  if (!event.description.trim()) {
    items.push({
      id: "communications-description",
      area: "communications",
      label: "Event description is needed before communication previews are complete.",
      severity: "required"
    });
  }

  if (!event.location) {
    items.push({
      id: "calendar-location",
      area: "calendar",
      label: "Location is needed before calendar sync can be completed.",
      severity: "required"
    });
  }

  if (!event.contactOwnerId) {
    items.push({
      id: "communications-owner",
      area: "communications",
      label: "Communication owner is needed before previews are ready for review.",
      severity: "required"
    });
  }

  if (!event.budgetTarget) {
    items.push({
      id: "budget-target",
      area: "budget",
      label: "Budget target is needed before budget health can be completed.",
      severity: "recommended"
    });
  }

  if (expenses.length === 0) {
    items.push({
      id: "budget-expenses",
      area: "budget",
      label: "No expenses have been recorded yet.",
      severity: "recommended"
    });
  }

  if (!event.googleDriveFolderId) {
    items.push({
      id: "drive-folder",
      area: "drive",
      label: "Drive folder has not been generated in Stub Mode.",
      severity: "recommended"
    });
  }

  return items;
}
