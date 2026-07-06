import { describe, expect, it } from "vitest";
import {
  buildSageConversationInput,
  buildSageInstructions,
  classifySageProviderError,
  loadSageSkillInstructions,
  normalizeAzureResponsesBaseUrl,
  readSageProviderConfig,
  SageProviderConfigError,
  sageUnavailableMessage,
  streamSageResponse,
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

  it("returns Azure unavailable copy for incomplete Azure config", () => {
    const config = readSageProviderConfig({ SAGE_AI_PROVIDER: "azure" });

    expect(config.configured).toBe(false);
    expect(sageUnavailableMessage(config)).toContain("Azure OpenAI is not configured yet");
  });

  it("normalizes Azure endpoints to the Responses API v1 base URL", () => {
    expect(normalizeAzureResponsesBaseUrl("https://example.openai.azure.com"))
      .toBe("https://example.openai.azure.com/openai/v1/");
    expect(normalizeAzureResponsesBaseUrl("https://example.openai.azure.com/"))
      .toBe("https://example.openai.azure.com/openai/v1/");
    expect(normalizeAzureResponsesBaseUrl("https://example.openai.azure.com/openai"))
      .toBe("https://example.openai.azure.com/openai/v1/");
    expect(normalizeAzureResponsesBaseUrl("https://example.openai.azure.com/openai/v1/"))
      .toBe("https://example.openai.azure.com/openai/v1/");
  });
});

describe("SAGE provider streaming selection", () => {
  it("uses the direct OpenAI streamer by default", async () => {
    const calls: string[] = [];
    const result = await streamSageResponse({
      instructions: "test instructions",
      input: "test input",
      signal: new AbortController().signal,
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        OPENAI_MODEL: "gpt-4o-mini"
      },
      streamers: {
        openai: async ({ config, onDelta }) => {
          calls.push(config.provider);
          onDelta?.("OpenAI response");
          return { provider: "openai", modelLabel: config.modelLabel, content: "OpenAI response", completed: true };
        },
        azure: async () => {
          throw new Error("Azure streamer should not be called");
        }
      }
    });

    expect(calls).toEqual(["openai"]);
    expect(result).toMatchObject({ provider: "openai", content: "OpenAI response", completed: true });
  });

  it("uses the Azure streamer when SAGE_AI_PROVIDER is azure", async () => {
    const calls: string[] = [];
    const result = await streamSageResponse({
      instructions: "test instructions",
      input: "test input",
      signal: new AbortController().signal,
      env: {
        SAGE_AI_PROVIDER: "azure",
        AZURE_OPENAI_API_KEY: "azure-secret",
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
        AZURE_OPENAI_DEPLOYMENT: "emma-camp-test",
        AZURE_OPENAI_API_VERSION: "2024-10-21"
      },
      streamers: {
        openai: async () => {
          throw new Error("OpenAI streamer should not be called");
        },
        azure: async ({ config, onDelta }) => {
          calls.push(`${config.provider}:${config.deployment}`);
          onDelta?.("Azure response");
          return { provider: "azure", modelLabel: config.modelLabel, content: "Azure response", completed: true };
        }
      }
    });

    expect(calls).toEqual(["azure:emma-camp-test"]);
    expect(result).toMatchObject({ provider: "azure", modelLabel: "emma-camp-test", completed: true });
  });

  it("throws a typed config error instead of calling a provider when config is missing", async () => {
    await expect(streamSageResponse({
      instructions: "test instructions",
      input: "test input",
      signal: new AbortController().signal,
      env: { SAGE_AI_PROVIDER: "azure", AZURE_OPENAI_API_KEY: "azure-secret" },
      streamers: {
        openai: async () => {
          throw new Error("OpenAI streamer should not be called");
        },
        azure: async () => {
          throw new Error("Azure streamer should not be called");
        }
      }
    })).rejects.toMatchObject({
      provider: "azure",
      missing: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"]
    });

    try {
      await streamSageResponse({
        instructions: "test instructions",
        input: "test input",
        signal: new AbortController().signal,
        env: { SAGE_AI_PROVIDER: "azure", AZURE_OPENAI_API_KEY: "azure-secret" }
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SageProviderConfigError);
      expect(JSON.stringify(error)).not.toContain("azure-secret");
    }
  });

  it("classifies Azure provider errors into sanitized categories", () => {
    expect(classifySageProviderError(Object.assign(new Error("quota exceeded"), { code: "insufficient_quota" }), "azure"))
      .toBe("azure_quota");
    expect(classifySageProviderError(Object.assign(new Error("deployment not found"), { status: 404 }), "azure"))
      .toBe("azure_model_or_deployment");
  });
});
