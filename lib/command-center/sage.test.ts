import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildSageConversationInput,
  buildSageInstructions,
  callSageStructured,
  classifySageProviderError,
  collectResponseStream,
  formatSageMemoryContext,
  loadSageSkillInstructions,
  normalizeAzureResponsesBaseUrl,
  readSageProviderConfig,
  SageProviderConfigError,
  sageUnavailableMessage,
  streamSageResponse,
  SAGE_TASK_AWARE_CHAT_SKILL
} from "@/lib/command-center/sage";
import type { AiConversationMessage, PersonalTask, SageMemory } from "@/lib/command-center/types";

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
    await expect(loadSageSkillInstructions()).resolves.toContain("No external integration writes, sends, or actions");
    await expect(loadSageSkillInstructions("unknown.skill")).rejects.toThrow("Unknown SAGE skill");
  });

  it("omits live integration context when none is provided", async () => {
    const instructions = await buildSageInstructions([task]);
    expect(instructions).not.toContain("Read-only Google Calendar context");
    expect(instructions).not.toContain("Read-only Gmail triage context");
  });

  it("appends live integration context when provided, without dropping task context", async () => {
    const liveContext = "Read-only Google Calendar context (as of this turn):\n- 2026-07-10T14:00:00Z: Fellowship call";
    const instructions = await buildSageInstructions([task], liveContext);
    expect(instructions).toContain("Follow up with recruiter");
    expect(instructions).toContain("Read-only Google Calendar context");
    expect(instructions).toContain("Fellowship call");
  });

  it("still forbids calendar writes, and forbids sending an email, even when integration context is present", async () => {
    const instructions = await buildSageInstructions([task], "Read-only Gmail triage context (as of this turn):\n- test");
    expect(instructions).toContain("You cannot create, update, or delete a calendar event");
    expect(instructions).toContain("you never send an email, from this chat or anywhere else");
    expect(instructions).toContain("No sending an email under any circumstance");
  });

  it("describes create_gmail_draft as SAGE's only tool call, draft-only and Andrew-triggered", async () => {
    const instructions = await buildSageInstructions([task]);
    expect(instructions).toContain("create_gmail_draft");
    expect(instructions).toContain("This is SAGE's only tool call.");
    expect(instructions).toContain("No tool calls beyond create_gmail_draft");
  });

  it("still forbids searching, reading, or organizing Google Drive from chat even when Drive context is present", async () => {
    const instructions = await buildSageInstructions([task], "Read-only Google Drive context (as of this turn) — recently modified files:\n- test.doc");
    expect(instructions).toContain("You cannot search Google Drive, read a Drive file's content, move a file, or create a folder from this chat");
  });

  it("still forbids a new Firecrawl scrape, Monday.com item reads, and Monday.com writes even when Firecrawl/Monday.com context is present", async () => {
    const liveContext = [
      "Read-only Firecrawl daily resource feed context (as of this turn):\n- \"TAP program updates\" (DOL) — New transition dates announced.",
      "Read-only Monday.com context (as of this turn) — board names:\n- Job Search Pipeline"
    ].join("\n\n");
    const instructions = await buildSageInstructions([task], liveContext);
    expect(instructions).toContain("Firecrawl daily resource feed context");
    expect(instructions).toContain("Job Search Pipeline");
    expect(instructions).toContain("You cannot trigger a new Firecrawl scrape, read Monday.com board items, write to Monday.com, post to Slack, or take autonomous actions");
  });

  it("reports no saved memory plainly when none exist", () => {
    expect(formatSageMemoryContext([])).toBe("No saved SAGE memory entries yet.");
  });

  it("formats saved memory entries with type and domain", () => {
    const memories: SageMemory[] = [
      {
        id: "mem_1",
        memoryType: "preference",
        content: "Prefers concise, bulleted follow-up suggestions.",
        domain: "job_search",
        createdAt: "2026-07-06T00:00:00.000Z"
      }
    ];
    const formatted = formatSageMemoryContext(memories);
    expect(formatted).toContain("Prefers concise, bulleted follow-up suggestions.");
    expect(formatted).toContain("type=preference");
    expect(formatted).toContain("domain=job_search");
  });

  it("includes saved memory in the built instructions and still forbids SAGE from writing to it", async () => {
    const memories: SageMemory[] = [
      { id: "mem_1", memoryType: "fact", content: "Prior service: US Army, 12 years.", createdAt: "2026-07-06T00:00:00.000Z" }
    ];
    const instructions = await buildSageInstructions([task], undefined, memories);
    expect(instructions).toContain("Prior service: US Army, 12 years.");
    expect(instructions).toContain("You cannot create, update, or delete a SAGE memory entry from this chat");
    expect(instructions).toContain("No automatic memory saving");
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

  it("forwards tools and onToolCall through to the selected streamer", async () => {
    const receivedTools: unknown[] = [];
    let receivedOnToolCall: unknown;
    await streamSageResponse({
      instructions: "test instructions",
      input: "test input",
      signal: new AbortController().signal,
      env: { OPENAI_API_KEY: "sk-test-secret" },
      tools: [{ name: "create_gmail_draft", description: "test", parameters: {} }],
      onToolCall: async () => "tool output",
      streamers: {
        openai: async ({ config, tools, onToolCall }) => {
          receivedTools.push(...(tools ?? []));
          receivedOnToolCall = onToolCall;
          return { provider: "openai", modelLabel: config.modelLabel, content: "ok", completed: true };
        },
        azure: async () => {
          throw new Error("Azure streamer should not be called");
        }
      }
    });

    expect(receivedTools).toEqual([{ name: "create_gmail_draft", description: "test", parameters: {} }]);
    expect(receivedOnToolCall).toBeTypeOf("function");
  });
});

async function* fakeEventStream(events: unknown[]) {
  for (const event of events) yield event;
}

describe("collectResponseStream", () => {
  it("collects text deltas into content", async () => {
    const result = await collectResponseStream({
      stream: fakeEventStream([
        { type: "response.output_text.delta", delta: "Hel" },
        { type: "response.output_text.delta", delta: "lo" }
      ]),
      provider: "openai",
      modelLabel: "gpt-4o-mini",
      signal: new AbortController().signal
    });
    expect(result).toMatchObject({ content: "Hello", completed: true, toolCall: undefined });
  });

  it("captures the response id from any event carrying one", async () => {
    const result = await collectResponseStream({
      stream: fakeEventStream([
        { type: "response.created", response: { id: "resp_123" } },
        { type: "response.output_text.delta", delta: "hi" }
      ]),
      provider: "openai",
      modelLabel: "gpt-4o-mini",
      signal: new AbortController().signal
    });
    expect(result.responseId).toBe("resp_123");
  });

  it("captures a function_call output item as a tool call", async () => {
    const result = await collectResponseStream({
      stream: fakeEventStream([
        { type: "response.created", response: { id: "resp_abc" } },
        {
          type: "response.output_item.done",
          item: { type: "function_call", name: "create_gmail_draft", call_id: "call_1", arguments: '{"to":"x@example.com"}' }
        }
      ]),
      provider: "openai",
      modelLabel: "gpt-4o-mini",
      signal: new AbortController().signal
    });
    expect(result.toolCall).toEqual({ name: "create_gmail_draft", callId: "call_1", argumentsJson: '{"to":"x@example.com"}' });
    expect(result.responseId).toBe("resp_abc");
  });

  it("ignores output items that are not function calls", async () => {
    const result = await collectResponseStream({
      stream: fakeEventStream([{ type: "response.output_item.done", item: { type: "message" } }]),
      provider: "openai",
      modelLabel: "gpt-4o-mini",
      signal: new AbortController().signal
    });
    expect(result.toolCall).toBeUndefined();
  });

  it("throws when the stream reports response.failed", async () => {
    await expect(
      collectResponseStream({
        stream: fakeEventStream([{ type: "response.failed", error: { message: "boom" } }]),
        provider: "openai",
        modelLabel: "gpt-4o-mini",
        signal: new AbortController().signal
      })
    ).rejects.toThrow("boom");
  });

  it("stops and marks incomplete when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await collectResponseStream({
      stream: fakeEventStream([{ type: "response.output_text.delta", delta: "hi" }]),
      provider: "openai",
      modelLabel: "gpt-4o-mini",
      signal: controller.signal
    });
    expect(result.completed).toBe(false);
  });
});

describe("callSageStructured", () => {
  const schema = z.object({ summary: z.string(), score: z.number() });

  it("returns unavailable instead of calling a provider when not configured", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: {},
      callers: {
        openai: async () => {
          throw new Error("should not be called");
        },
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("parses and validates a successful JSON response from the OpenAI caller", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o-mini" },
      callers: {
        openai: async ({ config }) => ({
          provider: "openai",
          modelLabel: config.modelLabel,
          text: JSON.stringify({ summary: "Concise summary.", score: 7 })
        }),
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: true, data: { summary: "Concise summary.", score: 7 }, provider: "openai" });
  });

  it("strips markdown code fences before parsing", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: { OPENAI_API_KEY: "sk-test" },
      callers: {
        openai: async () => ({ provider: "openai", modelLabel: "gpt-4o-mini", text: "```json\n{\"summary\":\"ok\",\"score\":1}\n```" }),
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: true, data: { summary: "ok", score: 1 } });
  });

  it("returns invalid_output for unparseable JSON", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: { OPENAI_API_KEY: "sk-test" },
      callers: {
        openai: async () => ({ provider: "openai", modelLabel: "gpt-4o-mini", text: "not json" }),
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("returns invalid_output when the JSON doesn't match the schema", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: { OPENAI_API_KEY: "sk-test" },
      callers: {
        openai: async () => ({ provider: "openai", modelLabel: "gpt-4o-mini", text: JSON.stringify({ wrong: "shape" }) }),
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("returns provider_error when the caller throws", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: { OPENAI_API_KEY: "sk-test" },
      callers: {
        openai: async () => {
          throw new Error("rate limited");
        },
        azure: async () => {
          throw new Error("should not be called");
        }
      }
    });
    expect(result).toMatchObject({ ok: false, reason: "provider_error", message: "rate limited" });
  });

  it("dispatches to the Azure caller when SAGE_AI_PROVIDER is azure", async () => {
    const result = await callSageStructured({
      instructions: "test",
      input: "test",
      schema,
      env: {
        SAGE_AI_PROVIDER: "azure",
        AZURE_OPENAI_API_KEY: "azure-secret",
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
        AZURE_OPENAI_DEPLOYMENT: "emma-camp-test"
      },
      callers: {
        openai: async () => {
          throw new Error("should not be called");
        },
        azure: async ({ config }) => ({
          provider: "azure",
          modelLabel: config.modelLabel,
          text: JSON.stringify({ summary: "azure summary", score: 3 })
        })
      }
    });
    expect(result).toMatchObject({ ok: true, provider: "azure", data: { summary: "azure summary", score: 3 } });
  });
});
