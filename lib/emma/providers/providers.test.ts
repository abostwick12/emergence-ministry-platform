import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import {
  __resetEmmaMockStoreForTests,
  createAiRequest,
  getEmmaAuditTrail
} from "@/lib/emma/repository";
import { createAzureOpenAIEmmaProvider } from "./azure-openai-provider";
import { createGeminiProvider } from "./gemini-provider";
import { createGlooEmmaProvider } from "./gloo-provider";
import { createOpenAIEmmaProvider } from "./openai-provider";
import { createMockEmmaProvider } from "./mock-provider";
import { internalEventSummarySchema, internalEventSummarySystemPrompt } from "./internal-event-summary";
import { resolveProviderSelection } from "./registry";
import { runEmmaProviderForRequest } from "./run-provider";

type TestSession = AuthSession & { testMinistryId: string };

function session(role = "admin", ministry = "ministry-emerge", id = "usr_1"): TestSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

function clearProviderEnv() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
  delete process.env.GLOO_AI_CLIENT_ID;
  delete process.env.GLOO_AI_CLIENT_SECRET;
  delete process.env.GLOO_AI_BASE_URL;
  delete process.env.GLOO_AI_MODEL;
  delete process.env.GLOO_AI_STUDIO_API_KEY;
  delete process.env.GLOO_AI_STUDIO_API_BASE_URL;
  delete process.env.GLOO_AI_STUDIO_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  delete process.env.AZURE_OPENAI_API_VERSION;
  delete process.env.VERCEL_ENV;
}

beforeEach(() => {
  clearProviderEnv();
  __resetEmmaMockStoreForTests();
});

describe("EMMA mock provider", () => {
  it("returns deterministic structured output", async () => {
    const provider = createMockEmmaProvider();
    const result = await provider.generate({
      systemPrompt: "system",
      userPrompt: "user",
      model: "mock-emma-model"
    });

    expect(result.provider).toBe("mock");
    expect(internalEventSummarySchema.safeParse(result.output).success).toBe(true);
  });

  it("can simulate invalid structured output", async () => {
    const provider = createMockEmmaProvider({ scenario: "invalid_json" });
    const result = await provider.generate({ systemPrompt: "system", userPrompt: "user", model: "mock-emma-model" });
    expect(internalEventSummarySchema.safeParse(result.output).success).toBe(false);
  });

  it("can simulate provider failure", async () => {
    const provider = createMockEmmaProvider({ scenario: "provider_error" });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "mock-emma-model" })).rejects.toMatchObject({
      code: "provider_unavailable"
    });
  });
});

describe("EMMA Gemini provider", () => {
  it("documents the exact internal summary JSON contract in the prompt", () => {
    expect(internalEventSummarySystemPrompt).toContain("summary (string)");
    expect(internalEventSummarySystemPrompt).toContain("keyPoints (array of strings)");
    expect(internalEventSummarySystemPrompt).toContain("Do not include event detail fields");
  });

  it("refuses to run without GEMINI_API_KEY", async () => {
    const provider = createGeminiProvider({ apiKey: "" });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" })).rejects.toMatchObject({
      code: "configuration"
    });
  });

  it("extracts valid JSON when Gemini wraps the object in a fenced block", async () => {
    const provider = createGeminiProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text:
                        '```json\n{"summary":"Gemini EMMA response","keyPoints":["safe point"],"suggestedNextQuestions":["review next step"],"confidence":0.88,"warnings":[]}\n```'
                    }
                  ]
                }
              }
            ],
            usageMetadata: { totalTokenCount: 24 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    const result = await provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" });

    expect(result).toMatchObject({
      provider: "gemini",
      model: "gemini-2.0-flash",
      output: {
        summary: "Gemini EMMA response",
        keyPoints: ["safe point"],
        suggestedNextQuestions: ["review next step"],
        confidence: 0.88,
        warnings: []
      },
      usage: { totalTokens: 24 }
    });
  });

  it("sanitizes provider errors and never serializes the key", async () => {
    const provider = createGeminiProvider({
      apiKey: "super-secret-gemini-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 401,
              status: "UNAUTHENTICATED",
              message: "super-secret-gemini-key raw upstream detail"
            }
          }),
          { status: 401 }
        )
    });

    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" })).rejects.toMatchObject({
      code: "authentication",
      message: "AI provider request failed safely."
    });
    await provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" }).catch((error) => {
      expect(JSON.stringify(error)).not.toContain("super-secret-gemini-key");
    });
  });

  it("captures sanitized Gemini error diagnostics on non-2xx responses", async () => {
    const provider = createGeminiProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              status: "INVALID_ARGUMENT",
              message: "Invalid JSON payload received. Unknown name \"response_mime_type\" at 'generation_config'.",
              details: [
                {
                  fieldViolations: [
                    {
                      field: "generation_config.response_mime_type",
                      description: "Unknown field."
                    }
                  ]
                }
              ]
            }
          }),
          { status: 400 }
        )
    });

    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.5-flash" })).rejects.toMatchObject({
      code: "bad_request",
      httpStatus: 400,
      diagnostic: {
        googleErrorCode: 400,
        googleErrorStatus: "INVALID_ARGUMENT",
        googleErrorMessage: "Invalid JSON payload received. Unknown name \"response_mime_type\" at 'generation_config'.",
        invalidFieldPaths: ["generation_config.response_mime_type"]
      }
    });
  });

  it("sends a REST-compatible generateContent payload", async () => {
    let requestBody: Record<string, unknown> | null = null;
    const provider = createGeminiProvider({
      apiKey: "test-key",
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({
              summary: "ok",
              keyPoints: ["safe"],
              suggestedNextQuestions: ["next?"],
              confidence: 0.9,
              warnings: []
            }) }] } }],
            usageMetadata: { totalTokenCount: 10 }
          }),
          { status: 200 }
        );
      }
    });

    await provider.generate({
      systemPrompt: internalEventSummarySystemPrompt,
      userPrompt: "Summarize safe context.",
      model: "gemini-2.5-flash",
      temperature: 0,
      maxOutputTokens: 400
    });

    expect(requestBody).toMatchObject({
      systemInstruction: { parts: [{ text: internalEventSummarySystemPrompt }] },
      contents: [{ role: "user", parts: [{ text: "Summarize safe context." }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 400
      }
    });
    expect(requestBody).not.toHaveProperty("store");
  });
});

describe("EMMA Gloo provider", () => {
  it("refuses to run without Gloo configuration", async () => {
    const provider = createGlooEmmaProvider({ config: null });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gloo-openai-gpt-5-nano" })).rejects.toMatchObject({
      code: "configuration"
    });
  });

  it("exchanges client credentials and parses Gloo chat-completions JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "gloo-openai-gpt-5-nano",
            choices: [
              {
                message: {
                  content: "```json\n" + JSON.stringify({
                    summary: "Gloo EMMA response",
                    points: ["safe point"],
                    nextActions: ["review next step"],
                    confidence: 0.89,
                    warnings: []
                  }) + "\n```"
                }
              }
            ],
            usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const provider = createGlooEmmaProvider({
      config: {
        accessToken: "",
        clientId: "client-id",
        clientSecret: "secret",
        apiBaseUrl: "https://platform.ai.gloo.com",
        model: "gloo-openai-gpt-5-nano"
      },
      fetchImpl: fetchMock
    });

    const result = await provider.generate({
      systemPrompt: "system",
      userPrompt: "user",
      model: "GPT-5 Nano",
      temperature: 0.2,
      maxOutputTokens: 400
    });

    expect(result).toMatchObject({
      provider: "gloo",
      model: "gloo-openai-gpt-5-nano",
      output: {
        summary: "Gloo EMMA response",
        points: ["safe point"],
        nextActions: ["review next step"],
        confidence: 0.89,
        warnings: []
      },
      usage: { promptTokens: 10, completionTokens: 12, totalTokens: 22 }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://platform.ai.gloo.com/oauth2/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("client-id:secret").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }),
        body: "grant_type=client_credentials&scope=api%2Faccess"
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://platform.ai.gloo.com/ai/v2/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" })
      })
    );
    const chatBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(chatBody).toMatchObject({
      model: "gloo-openai-gpt-5-nano",
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "user\n\nReturn only JSON." }
      ],
      max_tokens: 400
    });
    expect(JSON.stringify(chatBody)).not.toContain("secret");
  });
});

describe("EMMA OpenAI provider", () => {
  it("refuses to run without OPENAI_API_KEY", async () => {
    const provider = createOpenAIEmmaProvider({ apiKey: "" });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gpt-4o-mini" })).rejects.toMatchObject({
      code: "configuration"
    });
  });

  it("sends a Responses API structured-output request and parses output text", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> | null = null;
    const provider = createOpenAIEmmaProvider({
      apiKey: "sk-test-key",
      fetchImpl: async (url, init) => {
        requestUrl = String(url);
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            output_text:
              "```json\n" +
              JSON.stringify({
                summary: "OpenAI EMMA response",
                points: ["safe point"],
                nextActions: ["review next step"],
                confidence: 0.91,
                warnings: []
              }) +
              "\n```",
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    });

    const result = await provider.generate({
      systemPrompt: "system",
      userPrompt: "user",
      model: "gpt-4o-mini",
      temperature: 0,
      maxOutputTokens: 400
    });

    expect(requestUrl).toBe("https://api.openai.com/v1/responses");
    expect(requestBody).toMatchObject({
      model: "gpt-4o-mini",
      instructions: "system",
      input: [{ role: "user", content: [{ type: "input_text", text: "user" }] }],
      temperature: 0,
      max_output_tokens: 400,
      text: { format: { type: "json_schema", name: "ministry_emma_response" } }
    });
    expect(JSON.stringify(requestBody)).not.toContain("sk-test-key");
    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-4o-mini",
      output: {
        summary: "OpenAI EMMA response",
        points: ["safe point"],
        nextActions: ["review next step"],
        confidence: 0.91,
        warnings: []
      },
      usage: { totalTokens: 30 }
    });
  });
});

describe("EMMA Azure OpenAI provider", () => {
  it("refuses to run without Azure OpenAI configuration", async () => {
    const provider = createAzureOpenAIEmmaProvider({ config: null });
    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "deployment" })).rejects.toMatchObject({
      code: "configuration"
    });
  });

  it("parses JSON from Azure Responses output text", async () => {
    const provider = createAzureOpenAIEmmaProvider({
      config: {
        endpoint: "https://example-resource.openai.azure.com",
        apiKey: "test-key",
        deployment: "emma-test",
        apiVersion: "2024-10-21"
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "emma-test",
            output_text:
              '```json\n{"summary":"Azure EMMA response","keyPoints":["safe point"],"suggestedNextQuestions":["review next step"],"confidence":0.9,"warnings":[]}\n```',
            usage: { input_tokens: 10, output_tokens: 12, total_tokens: 22 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    const result = await provider.generate({ systemPrompt: "system", userPrompt: "user", model: "emma-test" });

    expect(result).toMatchObject({
      provider: "azure",
      model: "emma-test",
      output: {
        summary: "Azure EMMA response",
        keyPoints: ["safe point"],
        suggestedNextQuestions: ["review next step"],
        confidence: 0.9,
        warnings: []
      },
      usage: { promptTokens: 10, completionTokens: 12, totalTokens: 22 }
    });
  });
});

describe("audited provider execution", () => {
  it("creates request, run, provider attempt, and completed run in mock mode", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await runEmmaProviderForRequest(admin, {
      requestId: request.id,
      skillKey: "internal_event_summary",
      systemPrompt: internalEventSummarySystemPrompt,
      userPrompt: "Summarize this safe internal event context.",
      outputSchema: internalEventSummarySchema,
      provider: "mock"
    });

    expect(result.ok).toBe(true);
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.status).toBe("completed");
    expect(trail.runs).toHaveLength(1);
    expect(trail.runs[0].status).toBe("succeeded");
    expect(trail.providerAttempts).toHaveLength(1);
    expect(trail.providerAttempts[0].status).toBe("success");
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("logs provider failure and marks the run failed", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await runEmmaProviderForRequest(admin, {
      requestId: request.id,
      skillKey: "internal_event_summary",
      systemPrompt: internalEventSummarySystemPrompt,
      userPrompt: "Summarize this safe internal event context.",
      outputSchema: internalEventSummarySchema,
      provider: "mock",
      model: "mock-error"
    });

    expect(result.ok).toBe(false);
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.status).toBe("failed");
    expect(trail.runs[0].status).toBe("failed");
    expect(trail.providerAttempts[0].status).toBe("failure");
    expect(trail.providerAttempts[0].errorCode).toBe("provider_unavailable");
    expect(trail.runs[0].warnings).toContain("Provider error category: provider_unavailable");
  });

  it("logs invalid provider response as a failed attempt and failed run", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await runEmmaProviderForRequest(admin, {
      requestId: request.id,
      skillKey: "internal_event_summary",
      systemPrompt: internalEventSummarySystemPrompt,
      userPrompt: "Summarize this safe internal event context.",
      outputSchema: internalEventSummarySchema,
      provider: "mock",
      model: "mock-invalid"
    });

    expect(result.ok).toBe(false);
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.status).toBe("failed");
    expect(trail.runs[0].status).toBe("failed");
    expect(trail.providerAttempts[0].status).toBe("failure");
    expect(trail.providerAttempts[0].errorCode).toBe("invalid_output");
    expect(trail.runs[0].warnings).toContain("Provider output failed schema validation.");
    expect(trail.runs[0].warnings).toContain("Zod issue: path=summary code=invalid_type expected=string received=undefined");
    expect(trail.runs[0].warnings).toContain("Zod issue: path=keyPoints code=invalid_type expected=array received=undefined");
    expect(trail.runs[0].warnings).toContain("Zod issue: path=(root) code=unrecognized_keys keys=invalid");
  });

  it("mock mode does not require provider keys", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });
    const result = await runEmmaProviderForRequest(admin, {
      requestId: request.id,
      skillKey: "internal_event_summary",
      systemPrompt: internalEventSummarySystemPrompt,
      userPrompt: "No key required.",
      outputSchema: internalEventSummarySchema
    });
    expect(result.ok).toBe(true);
  });

  it("selects the live Gemini default when a key is configured without a separate mode flag", async () => {
    process.env.GEMINI_API_KEY = "configured-key";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "gemini",
      model: "gemini-2.5-flash-lite"
    });
  });

  it("selects Gloo first when Gloo is configured without a separate mode flag", async () => {
    process.env.GLOO_AI_CLIENT_ID = "client-id";
    process.env.GLOO_AI_CLIENT_SECRET = "configured-gloo-secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";
    process.env.AZURE_OPENAI_ENDPOINT = "https://example-resource.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "configured-azure-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "emma-azure-test";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "gloo",
      model: "gloo-openai-gpt-5-nano"
    });
  });

  it("honors explicit Gloo provider mode when Gloo is configured", async () => {
    process.env.EMMA_PROVIDER_MODE = "gloo";
    process.env.GLOO_AI_CLIENT_ID = "client-id";
    process.env.GLOO_AI_CLIENT_SECRET = "configured-gloo-secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "gloo",
      model: "gloo-openai-gpt-5-nano"
    });
  });

  it("maps stale Gemini model aliases to the current supported default", async () => {
    process.env.GEMINI_API_KEY = "configured-key";
    process.env.EMMA_DEFAULT_MODEL = "gemini-3.5-flash";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "gemini",
      model: "gemini-2.5-flash-lite"
    });
  });

  it("selects OpenAI when OPENAI_API_KEY is configured without Gemini", async () => {
    process.env.OPENAI_API_KEY = "configured-openai-key";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "openai",
      model: "gpt-4o-mini"
    });
  });

  it("does not let an unconfigured default provider override an available OpenAI provider", async () => {
    process.env.OPENAI_API_KEY = "configured-openai-key";
    process.env.EMMA_DEFAULT_PROVIDER = "gemini";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "openai",
      model: "gpt-4o-mini"
    });
  });

  it("selects Azure OpenAI when Azure config is available without Gemini", async () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://example-resource.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "configured-azure-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "emma-azure-test";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "azure",
      model: "emma-azure-test"
    });
  });

  it("honors explicit OpenAI provider mode and OPENAI_MODEL", async () => {
    process.env.EMMA_PROVIDER_MODE = "openai";
    process.env.OPENAI_API_KEY = "configured-openai-key";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";

    await expect(resolveProviderSelection(session())).resolves.toMatchObject({
      providerId: "openai",
      model: "gpt-4.1-mini"
    });
  });

  it("does not allow launch runtime to select the mock EMMA provider", async () => {
    process.env.VERCEL_ENV = "preview";

    await expect(resolveProviderSelection(session(), { provider: "mock" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: "EMMA launch mode requires a real provider configuration."
    });
  });
});
