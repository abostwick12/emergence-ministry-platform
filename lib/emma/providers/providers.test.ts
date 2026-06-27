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
import { createGeminiProvider } from "./gemini-provider";
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

  it("does not allow launch runtime to select the mock EMMA provider", async () => {
    process.env.VERCEL_ENV = "preview";

    await expect(resolveProviderSelection(session(), { provider: "mock" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: "EMMA launch mode requires a real provider configuration."
    });
  });
});
