import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { interpretCampEmmaCommand, matchStudentsByName } from "@/lib/camp/emma-command";
import type { CampVisibleStudent } from "@/lib/camp/types";

const students: CampVisibleStudent[] = [
  { id: "stu-avery", name: "Avery Johnson", photoInitials: "AJ", vehicleId: "van-1", vehicleName: "Van 1", cabin: "Cabin A" },
  { id: "stu-west-1", name: "John West", photoInitials: "JW", vehicleId: "van-2", vehicleName: "Van 2", cabin: "Cabin B" },
  { id: "stu-west-2", name: "John West", photoInitials: "JW", vehicleId: "van-3", vehicleName: "Van 3", cabin: "Cabin C" }
];

const AZURE_ENV_KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION"] as const;

function withAzureEnv() {
  process.env.AZURE_OPENAI_ENDPOINT = "https://emerge-camp-emma.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "emma-camp-test";
  process.env.AZURE_OPENAI_API_VERSION = "2024-08-01-preview";
}

function clearAzureEnv() {
  for (const key of AZURE_ENV_KEYS) delete process.env[key];
}

function fakeFetchReturning(jsonContent: string, capture?: { url?: string }) {
  return async (input: RequestInfo | URL) => {
    if (capture) capture.url = String(input);
    return new Response(JSON.stringify({ output_text: jsonContent, model: "gpt-4o-mini" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
}

describe("interpretCampEmmaCommand", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of AZURE_ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of AZURE_ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("returns a confirmable proposal for an authorized, unambiguous room-change request", async () => {
    withAzureEnv();
    const capture: { url?: string } = {};
    const fetchImpl = fakeFetchReturning(
      JSON.stringify({ intent: "update_room", studentNameQuery: "Avery Johnson", proposedRoom: "Cabin Z" }),
      capture
    );

    const { result, log } = await interpretCampEmmaCommand({
      rawText: "Change Avery Johnson to Cabin Z",
      students,
      fetchImpl
    });

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") throw new Error("expected proposal");
    expect(result.studentId).toBe("stu-avery");
    expect(result.currentRoom).toBe("Cabin A");
    expect(result.proposedRoom).toBe("Cabin Z");
    expect(log.success).toBe(true);
    expect(log.outcomeKind).toBe("proposal");
    expect(capture.url).toBe("https://emerge-camp-emma.openai.azure.com/openai/v1/responses");
  });

  it("asks for clarification when a name matches more than one active student", async () => {
    withAzureEnv();
    const fetchImpl = fakeFetchReturning(
      JSON.stringify({ intent: "update_room", studentNameQuery: "John West", proposedRoom: "Room 508" })
    );

    const { result } = await interpretCampEmmaCommand({ rawText: "Change John West to room 508", students, fetchImpl });

    expect(result.kind).toBe("clarification");
    if (result.kind !== "clarification") throw new Error("expected clarification");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.studentId).sort()).toEqual(["stu-west-1", "stu-west-2"]);
    expect(result.message).toMatch(/two|2/i);
  });

  it("blocks medical/medication-adjacent commands before ever calling the model", async () => {
    withAzureEnv();
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      return fakeFetchReturning("{}")("");
    };

    const { result } = await interpretCampEmmaCommand({
      rawText: "Update Avery Johnson's medication dose",
      students,
      fetchImpl
    });

    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") throw new Error("expected blocked");
    expect(result.reason).toBe("restricted_topic");
    expect(fetchCalled).toBe(false);
  });

  it("reports EMMA as unavailable, not an error, when Azure env vars are missing", async () => {
    clearAzureEnv();

    const { result, log } = await interpretCampEmmaCommand({ rawText: "Change Avery Johnson to Cabin Z", students });

    expect(result.kind).toBe("unavailable");
    expect(log.success).toBe(false);
  });
});

describe("matchStudentsByName", () => {
  it("prefers an exact case-insensitive name match and surfaces duplicates", () => {
    const matches = matchStudentsByName(students, "john west");
    expect(matches).toHaveLength(2);
  });

  it("returns a single partial match when the name is unambiguous", () => {
    const matches = matchStudentsByName(students, "Avery");
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("stu-avery");
  });

  it("returns no matches for an unknown name", () => {
    expect(matchStudentsByName(students, "Nobody Here")).toHaveLength(0);
  });
});
