import { describe, expect, it } from "vitest";
import { buildCampEmmaAnswer, buildMedicalCommandBlocks } from "@/lib/camp/emma";
import { campDocuments, campName, campSchedule, campStartsOn, campTeams, campVehicles } from "@/lib/camp/public-data";
import { getCampVisibleStudentsForData } from "@/lib/camp/access";
import { campStudents } from "@/lib/camp/public-data";
import { medicationSchedule } from "@/lib/camp/restricted-data";
import type { CampOverviewPayload, CampTeam } from "@/lib/camp/types";

const overview: CampOverviewPayload = {
  campName,
  campStartsOn,
  teams: campTeams,
  vehicles: campVehicles,
  schedule: campSchedule,
  documents: campDocuments,
  students: getCampVisibleStudentsForData("general_leader", {}, { students: campStudents, teams: campTeams, vehicles: campVehicles }),
  staff: []
};

describe("Camp EMMA safe answer builder", () => {
  it("answers leader Camp Finder questions with safe operational data only", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "Where is Avery?",
      mode: "finder",
      access: "leader",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer).toContain("Avery Johnson");
    expect(answer.answer).toContain("Blue");
    expect(JSON.stringify(answer)).not.toMatch(/Parent-labeled|dose|Insurance|guardian|allergyNotes|parentProvidedInstructions/i);
  });

  it("refuses restricted medical detail outside Andrew Medical Command", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "What medication dose does Avery need?",
      mode: "smart_search",
      access: "jaci",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer).toMatch(/restricted medical details are not available/i);
    expect(JSON.stringify(answer)).not.toMatch(/Parent-labeled|dose|Follow the parent label/i);
  });

  it("returns medical-aware counts only for Andrew Medical Command, with no real-time claim", () => {
    const blocks = buildMedicalCommandBlocks({
      schedule: medicationSchedule,
      intakeRecordIds: new Set(["med-1"]),
      loggedScheduleIds: new Set(),
      selectedDay: "Mon, Jun 29"
    });
    const answer = buildCampEmmaAnswer({
      overview,
      query: "What medications are due now?",
      mode: "smart_search",
      access: "andrew_medical",
      selectedDay: "Mon, Jun 29",
      medicalBlocks: blocks
    });

    expect(answer.answer.toLowerCase()).toMatch(/scheduled for the selected camp day/);
    expect(answer.answer.toLowerCase()).not.toMatch(/due now|right now|tonight|today/);
    expect(answer.details.join(" ")).toContain("Intake missing");
    expect(JSON.stringify(answer)).not.toMatch(/Parent-labeled medication|Follow signed parent instructions|dose/i);
  });

  it("returns a not-found response for an unknown camper instead of a global missing-room list", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "What room is Sophia in?",
      mode: "finder",
      access: "leader",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer).toMatch(/couldn't find|could not find|no .*match/i);
    expect(JSON.stringify(answer)).not.toMatch(/missing room assignments|All visible campers have room assignments/i);
    // Must not enumerate the whole roster as a fallback list.
    expect(answer.details.join(" ")).not.toContain("Jordan Kim");
  });

  it("gives a real leader briefing rather than the plain leader-assignment list", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "Give me a leader briefing for tonight",
      mode: "finder",
      access: "leader",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer).toMatch(/briefing/i);
    expect(answer.answer).not.toMatch(/Leader assignments by team/i);
    const details = answer.details.join(" ");
    expect(details).toMatch(/scheduled item|selected Camp day/i);
    expect(details).toMatch(/missing room|clarification|lead or co-leader/i);
  });

  it("returns only teams missing a lead or co-leader", () => {
    const teams: CampTeam[] = [
      { id: "team-blue", name: "Blue", color: "Blue", leader: "Pat Lee", coLeader: "Sam Cole", room: "Cabin 1" },
      { id: "team-red", name: "Red", color: "Red", leader: "", coLeader: "Dana Fox", room: "" },
      { id: "team-green", name: "Green", color: "Green", leader: "Jo Ray", coLeader: "", room: "" }
    ];
    const answer = buildCampEmmaAnswer({
      overview: { ...overview, teams },
      query: "Which teams are short a leader?",
      mode: "finder",
      access: "leader"
    });

    const details = answer.details.join(" ");
    expect(details).toMatch(/Red: needs lead/);
    expect(details).toMatch(/Green: needs co-leader/);
    expect(details).not.toMatch(/Blue/);
  });

  it("honestly reports that change-since-yesterday is unsupported", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "What changed since yesterday?",
      mode: "finder",
      access: "leader",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer).toMatch(/change/i);
    expect(JSON.stringify(answer)).toMatch(/not implemented|isn't available|can't compare|cannot compare/i);
    // No invented day-over-day data.
    expect(answer.details.join(" ")).not.toMatch(/added|removed|increased|decreased/i);
  });

  it("does not overclaim real-time wording for schedule answers", () => {
    const answer = buildCampEmmaAnswer({
      overview,
      query: "What is happening next?",
      mode: "finder",
      access: "leader",
      selectedDay: "Mon, Jun 29"
    });

    expect(answer.answer.toLowerCase()).not.toMatch(/\bnow\b|right now|currently|tonight|today/);
    expect(answer.answer.toLowerCase()).toMatch(/selected day|scheduled/);
  });

  it("keeps medication detail blocked for General Leader and Jaci", () => {
    for (const access of ["leader", "jaci"] as const) {
      const answer = buildCampEmmaAnswer({
        overview,
        query: "What medication does Avery take?",
        mode: access === "leader" ? "finder" : "smart_search",
        access,
        selectedDay: "Mon, Jun 29"
      });

      expect(answer.answer).toMatch(/restricted medical details are not available/i);
      expect(JSON.stringify(answer)).not.toMatch(/dose|Parent-labeled/i);
    }
  });
});
