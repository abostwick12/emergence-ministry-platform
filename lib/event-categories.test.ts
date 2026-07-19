import { describe, expect, it } from "vitest";

import { eventCategoryColors, eventTypeLabels, eventTypes, normalizeEventType } from "@/lib/event-categories";
import { defaultTemplateTasks } from "@/lib/templates";

describe("event categories", () => {
  it("defines labels and accent colors for every event type", () => {
    for (const type of eventTypes) {
      expect(eventTypeLabels[type]).toMatch(/\S/);
      expect(eventCategoryColors[type]).toMatch(/^#/);
    }
  });

  it("normalizes legacy event types into current categories", () => {
    expect(normalizeEventType("weekly")).toBe("small_group_gathering");
    expect(normalizeEventType("service")).toBe("missions_trip");
    expect(normalizeEventType("retreat")).toBe("conference");
    expect(normalizeEventType("camp")).toBe("conference");
  });

  it("maps requested event categories to the right baseline task templates", () => {
    expect(defaultTemplateTasks.sunday_morning_service[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.sunday_evening_service[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.middle_school_event[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.high_school_event[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.small_group_gathering[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.combined_event[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.other[0].id).toMatch(/^weekly-/);
    expect(defaultTemplateTasks.missions_trip[0].id).toMatch(/^service-/);
    expect(defaultTemplateTasks.conference[0].id).toMatch(/^retreat-/);
  });
});
