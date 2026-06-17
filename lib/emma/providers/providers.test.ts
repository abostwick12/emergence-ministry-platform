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
        new Response(JSON.stringify({ error: { message: "super-secret-gemini-key raw upstream detail" } }), { status: 401 })
    });

    await expect(provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" })).rejects.toMatchObject({
      code: "authentication",
      message: "AI provider request failed safely."
    });
    await provider.generate({ systemPrompt: "system", userPrompt: "user", model: "gemini-2.0-flash" }).catch((error) => {
      expect(JSON.stringify(error)).not.toContain("super-secret-gemini-key");
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
});
