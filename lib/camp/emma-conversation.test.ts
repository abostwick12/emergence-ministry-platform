import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { answerCampEmmaConversation, isCampEmmaConversationalAccess } from "@/lib/camp/emma-conversation";
import type { CampEmmaAccess } from "@/lib/camp/emma";
import type { CampOverviewPayload } from "@/lib/camp/types";

const PROVIDER_ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
  "OPENAI_API_KEY",
  "OPENAI_MODEL"
] as const;

function withAzureEnv() {
  clearProviderEnv();
  process.env.AZURE_OPENAI_ENDPOINT = "https://emerge-camp-emma.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "emma-camp-test";
  process.env.AZURE_OPENAI_API_VERSION = "2024-08-01-preview";
}

function withOpenAIEnv() {
  clearProviderEnv();
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";
}

function clearProviderEnv() {
  for (const key of PROVIDER_ENV_KEYS) delete process.env[key];
}

function overviewWithMedicalCamper(): CampOverviewPayload {
  return {
    campName: "Summer Camp 2026",
    campStartsOn: "2026-06-29",
    teams: [{ id: "t1", name: "Blue", color: "Blue", leader: "Gabe Kale", coLeader: "Casey Lee" }],
    vehicles: [{ id: "v1", name: "Van 2", driver: "Pat Lane", departureWindow: "8:00 AM", capacity: 12 }],
    schedule: [
      { id: "s1", day: "Monday", time: "6:00 PM", title: "Dinner", location: "Hall", audience: "All Camp" },
      { id: "s2", day: "Monday", time: "9:00 PM", title: "Med pass", location: "Clinic", audience: "Medical Team", visibility: "Medical Only" }
    ],
    documents: [],
    students: [
      {
        id: "c1",
        name: "Aviva Haldeman",
        photoInitials: "AH",
        vehicleId: "v1",
        vehicleName: "Van 2",
        grade: "7",
        teamId: "t1",
        teamName: "Blue",
        cabin: "Cabin 5",
        shirtSize: "Adult Small",
        limitedSafetyFlags: ["EpiPen on file"],
        hasRestrictedMedicalInfo: true,
        hasMedicationPlan: true,
        hasMedicalAlert: true,
        hasDietaryAlert: true,
        emergencyContactOnFile: true
      }
    ],
    staff: [{ id: "st1", name: "Gabe Kale", role: "leader", teamName: "Blue" }]
  };
}

function fakeFetchCapturing(capture: { body?: string; url?: string; calls?: number }, jsonContent: string) {
  return (async (url: string, init?: RequestInit) => {
    capture.calls = (capture.calls ?? 0) + 1;
    capture.url = url;
    capture.body = typeof init?.body === "string" ? init.body : undefined;
    const responseBody = url.includes("/responses")
      ? { output_text: jsonContent, model: "gpt-4o-mini" }
      : { choices: [{ message: { content: jsonContent } }], model: "gpt-4o" };
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as unknown as typeof fetch;
}

function aggregateOverview(): CampOverviewPayload {
  const base = overviewWithMedicalCamper();
  return {
    ...base,
    teams: [
      { id: "blue", name: "Blue", color: "Blue", leader: "Gabe Kale" },
      { id: "red", name: "Red", color: "Red", leader: "Casey Lee" },
      { id: "green", name: "Green", color: "Green", leader: "Dana Fox" }
    ],
    students: [
      { id: "s1", name: "Avery Blue", photoInitials: "AB", grade: "6", teamId: "blue", teamName: "Blue", vehicleId: "v1", vehicleName: "Van 2" },
      { id: "s2", name: "Blair Blue", photoInitials: "BB", grade: "6", teamId: "blue", teamName: "Blue", vehicleId: "v1", vehicleName: "Van 2" },
      { id: "s3", name: "Riley Red", photoInitials: "RR", grade: "6", teamId: "red", teamName: "Red", vehicleId: "v1", vehicleName: "Van 2" },
      { id: "s4", name: "Jordan Green", photoInitials: "JG", grade: "7", teamId: "green", teamName: "Green", vehicleId: "v1", vehicleName: "Van 2" }
    ]
  };
}

describe("isCampEmmaConversationalAccess", () => {
  it("is true only for Andrew and Jaci", () => {
    expect(isCampEmmaConversationalAccess("andrew_operations")).toBe(true);
    expect(isCampEmmaConversationalAccess("andrew_medical")).toBe(true);
    expect(isCampEmmaConversationalAccess("jaci")).toBe(true);
    expect(isCampEmmaConversationalAccess("leader")).toBe(false);
  });
});

describe("answerCampEmmaConversation", () => {
  beforeEach(() => withAzureEnv());
  afterEach(() => clearProviderEnv());

  it("returns null for non-conversational access without calling the model", async () => {
    const capture: { body?: string; calls?: number } = {};
    const result = await answerCampEmmaConversation({
      question: "Who is on Blue Team?",
      overview: overviewWithMedicalCamper(),
      access: "leader" as CampEmmaAccess,
      fetchImpl: fakeFetchCapturing(capture, "{}")
    });
    expect(result).toBeNull();
    expect(capture.body).toBeUndefined();
    expect(capture.calls ?? 0).toBe(0);
  });

  it("returns null (fallback) when the provider is not configured", async () => {
    clearProviderEnv();
    const result = await answerCampEmmaConversation({
      question: "How many campers are there?",
      overview: overviewWithMedicalCamper(),
      access: "andrew_operations"
    });
    expect(result).toBeNull();
  });

  it("never sends medical, safety, or restricted fields to the model", async () => {
    const capture: { body?: string } = {};
    await answerCampEmmaConversation({
      question: "Who is on Blue Team?",
      overview: overviewWithMedicalCamper(),
      access: "andrew_operations",
      fetchImpl: fakeFetchCapturing(capture, JSON.stringify({ answer: "Aviva Haldeman is on Blue." }))
    });
    const sent = capture.body ?? "";
    expect(sent).toContain("Aviva Haldeman");
    // Operational fields are allowed; protected ones must be absent.
    for (const forbidden of [
      "EpiPen",
      "hasRestrictedMedicalInfo",
      "hasMedicationPlan",
      "hasMedicalAlert",
      "hasDietaryAlert",
      "emergencyContactOnFile",
      "limitedSafetyFlags",
      "Med pass",
      "Medical Only"
    ]) {
      expect(sent).not.toContain(forbidden);
    }
  });

  it("works with a direct OpenAI key when Azure is not configured", async () => {
    withOpenAIEnv();
    const capture: { body?: string } = {};
    const result = await answerCampEmmaConversation({
      question: "How many campers are on Blue Team?",
      overview: overviewWithMedicalCamper(),
      access: "andrew_operations",
      fetchImpl: fakeFetchCapturing(capture, JSON.stringify({ answer: "Blue Team has 1 camper." }))
    });
    expect(result).not.toBeNull();
    expect(result?.answer).toContain("Blue Team");
    // Same operational-only boundary must hold on the OpenAI path.
    expect(capture.body ?? "").not.toContain("EpiPen");
  });

  it("maps a valid model response into a CampEmmaAnswer", async () => {
    const capture: { body?: string } = {};
    const result = await answerCampEmmaConversation({
      question: "Who is on Blue Team?",
      overview: overviewWithMedicalCamper(),
      access: "jaci",
      fetchImpl: fakeFetchCapturing(
        capture,
        JSON.stringify({ answer: "Blue Team has 1 camper: Aviva Haldeman.", details: ["Lead: Gabe Kale"] })
      )
    });
    expect(result).not.toBeNull();
    expect(result?.answer).toContain("Aviva Haldeman");
    expect(result?.details).toContain("Lead: Gabe Kale");
  });

  it("returns null when the model returns unusable output", async () => {
    const capture: { body?: string } = {};
    const result = await answerCampEmmaConversation({
      question: "Who is on Blue Team?",
      overview: overviewWithMedicalCamper(),
      access: "andrew_operations",
      fetchImpl: fakeFetchCapturing(capture, "not json at all")
    });
    expect(result).toBeNull();
  });

  it("uses Azure Responses API for Andrew/Jaci aggregate questions", async () => {
    for (const access of ["andrew_operations", "jaci"] as const) {
      withAzureEnv();
      const capture: { body?: string; url?: string; calls?: number } = {};
      const result = await answerCampEmmaConversation({
        question: "which team has the most 6th graders",
        overview: aggregateOverview(),
        access,
        fetchImpl: fakeFetchCapturing(
          capture,
          JSON.stringify({
            answer: "Blue Team has the most 6th graders with 2.",
            details: ["Blue: 2 sixth graders", "Red: 1 sixth grader", "Green: 0 sixth graders"]
          })
        )
      });

      expect(capture.calls).toBe(1);
      expect(capture.url).toBe("https://emerge-camp-emma.openai.azure.com/openai/v1/responses");
      expect(capture.url).not.toContain("/chat/completions");
      expect(capture.body).toContain("\"model\":\"emma-camp-test\"");
      expect(capture.body).toContain("\"type\":\"input_text\"");
      const requestBody = JSON.parse(capture.body ?? "{}") as { input?: Array<{ content?: Array<{ text?: string }> }> };
      const prompt = JSON.parse(requestBody.input?.[0]?.content?.[0]?.text ?? "{}") as {
        question?: string;
        camp?: { campers?: Array<{ grade?: string; team?: string }> };
      };
      expect(prompt.question).toBe("which team has the most 6th graders");
      expect(prompt.camp?.campers).toEqual(expect.arrayContaining([
        expect.objectContaining({ grade: "6", team: "Blue" })
      ]));
      expect(result?.answer).toContain("Blue Team");
      expect(result?.answer).not.toMatch(/couldn't find a camper/i);
      expect(result?.details.join(" ")).toContain("Blue: 2");
    }
  });

  it("does not treat aggregate team questions as camper names when the model is unavailable", async () => {
    clearProviderEnv();
    const capture: { body?: string; calls?: number } = {};
    const result = await answerCampEmmaConversation({
      question: "which team has the most 6th graders",
      overview: aggregateOverview(),
      access: "andrew_operations",
      fetchImpl: fakeFetchCapturing(capture, "{}")
    });

    expect(capture.calls ?? 0).toBe(0);
    expect(result?.answer).toBe("EMMA's conversational mode is temporarily unavailable, but I can still help search campers, teams, rooms, and schedule details.");
    expect(result?.answer).not.toMatch(/couldn't find a camper/i);
  });
});
