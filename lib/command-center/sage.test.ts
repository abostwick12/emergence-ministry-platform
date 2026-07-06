import { describe, expect, it } from "vitest";
import {
  buildSageConversationInput,
  buildSageInstructions,
  loadSageSkillInstructions,
  readSageProviderConfig,
  SAGE_TASK_AWARE_CHAT_SKILL
} from "@/lib/command-center/sage";
import type { AiConversationMessage, PersonalTask } from "@/lib/command-center/types";

const task: PersonalTask = {
  id: "task_1",
  domain: "job_search",
  title: "Follow up with recruiter",
  description: "Send a concise check-in note.",
  status: "todo",
  priority: "high",
  dueDate: "2026-07-07",
  tags: ["follow-up"],
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z"
};

describe("SAGE prompt assembly", () => {
  it("builds instructions without reading prompt files from disk", async () => {
    const instructions = await buildSageInstructions([task]);

    expect(instructions).toContain("You are SAGE");
    expect(instructions).toContain(SAGE_TASK_AWARE_CHAT_SKILL);
    expect(instructions).toContain("Follow up with recruiter");
    expect(instructions).toContain("Do not reference, request, infer, or use student, Camp medical");
  });

  it("returns the task-aware skill instructions by key", async () => {
    await expect(loadSageSkillInstructions()).resolves.toContain("No external integrations");
    await expect(loadSageSkillInstructions("unknown.skill")).rejects.toThrow("Unknown SAGE skill");
  });

  it("formats recent conversation turns for the Responses API input", () => {
    const messages: AiConversationMessage[] = [
      {
        id: "msg_1",
        sessionId: "sage:test",
        role: "user",
        content: "What should I focus on?",
        createdAt: "2026-07-06T00:00:00.000Z"
      }
    ];

    expect(buildSageConversationInput(messages)).toContain("Andrew: What should I focus on?");
  });
});

describe("SAGE provider config", () => {
  it("defaults to direct OpenAI provider config", () => {
    const config = readSageProviderConfig({
      OPENAI_API_KEY: "sk-test-secret",
      OPENAI_MODEL: "gpt-4o-mini"
    });

    expect(config).toEqual({
      provider: "openai",
      configured: true,
      modelLabel: "gpt-4o-mini",
      missing: []
    });
  });

  it("selects Azure when SAGE_AI_PROVIDER is azure", () => {
    const config = readSageProviderConfig({
      SAGE_AI_PROVIDER: "azure",
      AZURE_OPENAI_API_KEY: "azure-secret",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_DEPLOYMENT: "sage-gpt-4o-mini",
      AZURE_OPENAI_API_VERSION: "2024-10-21"
    });

    expect(config).toEqual({
      provider: "azure",
      configured: true,
      modelLabel: "sage-gpt-4o-mini",
      missing: []
    });
  });

  it("marks Azure config incomplete when required Azure variables are missing", () => {
    const config = readSageProviderConfig({
      SAGE_AI_PROVIDER: "azure",
      AZURE_OPENAI_API_VERSION: "2024-10-21"
    });

    expect(config.provider).toBe("azure");
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual([
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_DEPLOYMENT"
    ]);
  });

  it("does not return provider secret values", () => {
    const openAiConfig = readSageProviderConfig({
      OPENAI_API_KEY: "sk-test-secret",
      OPENAI_MODEL: "gpt-4o-mini"
    });
    const azureConfig = readSageProviderConfig({
      SAGE_AI_PROVIDER: "azure",
      AZURE_OPENAI_API_KEY: "azure-secret",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_DEPLOYMENT: "sage-gpt-4o-mini"
    });

    expect(JSON.stringify(openAiConfig)).not.toContain("sk-test-secret");
    expect(JSON.stringify(azureConfig)).not.toContain("azure-secret");
  });
});
