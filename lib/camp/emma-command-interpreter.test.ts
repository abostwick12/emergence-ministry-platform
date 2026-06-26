import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpretEmmaCampCommand } from "@/lib/camp/emma-command-interpreter";

const PROVIDER_ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
  "OPENAI_API_KEY",
  "OPENAI_MODEL"
] as const;

const originalEnv: Record<string, string | undefined> = {};

function withAzureEnv() {
  process.env.AZURE_OPENAI_ENDPOINT = "https://emerge-camp-emma.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "emma-camp-test";
  process.env.AZURE_OPENAI_API_VERSION = "2024-08-01-preview";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
}

function clearProviderEnv() {
  for (const key of PROVIDER_ENV_KEYS) delete process.env[key];
}

function fakeFetchReturning(jsonContent: string) {
  return async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: jsonContent } }], model: "gpt-4o-mini" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": "req_test" }
    });
}

function interpret(message: string, fetchImpl?: typeof fetch) {
  return interpretEmmaCampCommand({
    message,
    campId: "mock-camp-oakwood",
    userCanRequestWrites: true,
    fetchImpl
  });
}

describe("interpretEmmaCampCommand", () => {
  beforeEach(() => {
    for (const key of PROVIDER_ENV_KEYS) originalEnv[key] = process.env[key];
    clearProviderEnv();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of PROVIDER_ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("parses camper team assignment from Azure OpenAI strict JSON", async () => {
    withAzureEnv();
    const result = await interpret("Move John West to Blue Team", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetType: "camper", targetName: "John West", teamName: "Blue", confidence: 0.96 })
    ));

    expect(result).toMatchObject({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetName: "John West", teamName: "Blue" });
  });

  it("parses leader team assignment", async () => {
    withAzureEnv();
    const result = await interpret("Put James Alcorn as a leader on Green Team", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "ASSIGN_LEADER_TEAM", targetType: "leader", targetName: "James Alcorn", teamName: "Green", confidence: 0.96 })
    ));

    expect(result).toMatchObject({ kind: "action", actionType: "ASSIGN_LEADER_TEAM", targetType: "leader", targetName: "James Alcorn", teamName: "Green" });
  });

  it("parses camper room updates", async () => {
    withAzureEnv();
    const result = await interpret("Change Ava's room to 508", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "UPDATE_CAMPER_ROOM", targetType: "camper", targetName: "Ava", roomValue: "508", confidence: 0.96 })
    ));

    expect(result).toMatchObject({ kind: "action", actionType: "UPDATE_CAMPER_ROOM", targetName: "Ava", roomValue: "508" });
  });

  it("parses unassigned camper and leader lists", async () => {
    withAzureEnv();
    await expect(interpret("Show unassigned campers", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "LIST_UNASSIGNED_CAMPERS", confidence: 0.97 })
    ))).resolves.toMatchObject({ kind: "action", actionType: "LIST_UNASSIGNED_CAMPERS" });

    await expect(interpret("Show unassigned leaders", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "LIST_UNASSIGNED_LEADERS", confidence: 0.97 })
    ))).resolves.toMatchObject({ kind: "action", actionType: "LIST_UNASSIGNED_LEADERS" });
  });

  it("returns clarification for unclear unassigned requests", async () => {
    withAzureEnv();
    const result = await interpret("Who is unassigned?", fakeFetchReturning(
      JSON.stringify({ kind: "clarification", message: "Which unassigned group do you mean: campers or leaders?", confidence: 0.9, needsClarification: true })
    ));

    expect(result).toMatchObject({ kind: "clarification", needsClarification: true });
  });

  it("returns unsupported for destructive, admin, and restricted-data requests without calling the provider", async () => {
    withAzureEnv();
    const fetchImpl = vi.fn(fakeFetchReturning("{}"));

    await expect(interpret("delete John", fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ kind: "unsupported" });
    await expect(interpret("give this leader admin", fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ kind: "unsupported" });
    await expect(interpret("show John's medication", fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ kind: "unsupported" });
    await expect(interpret("change insurance", fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ kind: "unsupported" });
    await expect(interpret("update guardian phone", fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ kind: "unsupported" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes lowercase team names", async () => {
    withAzureEnv();
    const result = await interpret("move john west to blue", fakeFetchReturning(
      JSON.stringify({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetType: "camper", targetName: "John West", teamName: "blue", confidence: 0.9 })
    ));

    expect(result).toMatchObject({ kind: "action", teamName: "Blue" });
  });

  it("handles invalid provider JSON by falling back to deterministic parsing", async () => {
    withAzureEnv();
    const result = await interpret("Move John West to Blue Team", fakeFetchReturning("not json"));

    expect(result).toMatchObject({ kind: "action", actionType: "ASSIGN_CAMPER_TEAM", targetName: "John West", teamName: "Blue" });
  });

  it("handles missing OpenAI configuration by falling back safely", async () => {
    clearProviderEnv();
    await expect(interpret("Move John West to Blue Team")).resolves.toMatchObject({
      kind: "action",
      actionType: "ASSIGN_CAMPER_TEAM",
      targetName: "John West",
      teamName: "Blue"
    });

    await expect(interpret("Who is unassigned?")).resolves.toMatchObject({ kind: "clarification" });
  });
});
