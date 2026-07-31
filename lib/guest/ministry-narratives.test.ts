import { describe, expect, it } from "vitest";

import { buildLeadEmergenceDemoContext } from "@/lib/guest/lead-emergence-demo-context";
import {
  buildGuestMinistryNarrativeById,
  buildGuestMinistryNarratives,
  buildGuestNarrativeEmmaContext,
  buildGuestNarrativeEmmaResponse
} from "@/lib/guest/ministry-narratives";

describe("guest Ministry Hub narratives", () => {
  it("derives the four requested stories deterministically from canonical records", () => {
    const first = buildGuestMinistryNarratives();
    const second = buildGuestMinistryNarratives();

    expect(first).toHaveLength(4);
    expect(first.map((item) => item.id)).toEqual([
      "sunday-friday-shift",
      "staff-responsibility-concentration",
      "volunteer-serving-pattern",
      "small-group-growth"
    ]);
    expect(second).toEqual(first);
  });

  it("calculates the attendance shift and quarter overlap exactly", () => {
    const narrative = buildGuestMinistryNarrativeById("sunday-friday-shift");

    expect(narrative.evidence.map((item) => item.value)).toEqual([
      "37.5 → 31.5 per service (-16.1%)",
      "46 → 86 attendees (+87%)",
      "42 at Winter Welcome Night → 90 at Christmas Serve Celebration",
      "81 of 92 Friday participants also attended a Q4 Sunday service; 11 did not"
    ]);
    expect(narrative.evidence[0]?.sourceRecords).toHaveLength(78);
  });

  it("calculates staff, volunteer, and group comparisons exactly", () => {
    const staff = buildGuestMinistryNarrativeById("staff-responsibility-concentration");
    const volunteers = buildGuestMinistryNarrativeById("volunteer-serving-pattern");
    const group = buildGuestMinistryNarrativeById("small-group-growth");

    expect(staff.evidence.map((item) => item.value)).toEqual([
      "921 of 1116.8 hours (82.5%)",
      "921 hours versus a 119.8-hour staff median (7.7×)",
      "18 of 24 Friday event records (75%)",
      "24 of 24 parent-and-leader preview tasks assigned to Mason"
    ]);
    expect(volunteers.evidence[0]?.value).toBe("180 assignments (7.5× the volunteer median)");
    expect(volunteers.evidence[1]?.value).toBe("138 assignments (5.8× the volunteer median)");
    expect(volunteers.evidence[2]?.value).toBe("Eli appears in 104 consecutive Sunday weeks; Marcus’s longest run is 36");
    expect(volunteers.evidence[3]?.value).toContain("Clara Sage, Ruby Lane, Tessa Hale, Lydia Brook each appear on 4 assignments");
    expect(group.evidence.map((item) => item.value)).toEqual([
      "10 → 11 → 12 → 13 → 14 → 15 → 16",
      "16 attendees on 2025-05-11 against a threshold of 16",
      "19 rostered students, 2 leaders (9.5 rostered students per leader)",
      "The group later reached 19 attendees"
    ]);
  });

  it("keeps every evidence source traceable to the canonical dataset", () => {
    const context = buildLeadEmergenceDemoContext();
    const validIds = new Set([
      ...context.occurrences.map((item) => item.id),
      ...context.eventOutcomes.map((item) => item.id),
      ...context.tasks.map((item) => item.id),
      ...context.servingAssignments.map((item) => item.id),
      ...context.smallGroups.map((item) => item.id),
      ...context.volunteers.map((item) => item.id)
    ]);

    for (const narrative of buildGuestMinistryNarratives(context)) {
      expect(narrative.evidence).toHaveLength(4);
      for (const evidence of narrative.evidence) {
        expect(evidence.sourceRecords.length).toBeGreaterThan(0);
        expect(evidence.sourceRecords.every((record) => validIds.has(record.id))).toBe(true);
      }
    }
  });

  it("states limitations instead of unsupported diagnoses", () => {
    const renderedCopy = JSON.stringify(buildGuestMinistryNarratives()).toLowerCase();

    expect(renderedCopy).not.toMatch(/\bis burned out\b|\bis spiritually healthy\b|\bis unfaithful\b|\bgod is telling\b/);
    expect(renderedCopy).toContain("do not explain why");
    expect(renderedCopy).toContain("no availability");
    expect(renderedCopy).toContain("does not prove relational pressure");
    expect(renderedCopy).toContain("does not establish that concentration is increasing");
  });

  it("builds a selected-only EMMA context and deterministic read-only response", () => {
    const selected = buildGuestMinistryNarrativeById("small-group-growth");
    const context = buildGuestNarrativeEmmaContext(selected);
    const response = buildGuestNarrativeEmmaResponse(selected, "What should we discuss?");

    expect(context).toContain(selected.headline);
    expect(context).toContain("10 → 11 → 12 → 13 → 14 → 15 → 16");
    expect(context).not.toContain("Mason Bridge");
    expect(context).not.toContain("Sunday participation fell");
    expect(context.length).toBeLessThan(1800);
    expect(response.summary).toContain(selected.headline);
    expect(response.summary).toContain("not a conclusion");
    expect(response.nextActions).toContain(selected.discernmentQuestion);
  });
});
