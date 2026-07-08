import { afterEach, describe, expect, it, vi } from "vitest";

import { generateGlooDiscussionDraft, isGlooConfigured, runGlooDiscussionDiagnostic, selectGlooModelPolicy } from "@/lib/scripture/gloo";
import type { GlooDiscussionDraftInput } from "@/lib/scripture/gloo";

const baseInput: GlooDiscussionDraftInput = {
  question: "How do we talk about prayer in small group?",
  scriptureReference: "Matthew 6:9",
  metanarrativeMovement: "Jesus / Kingdom Fulfilled"
};

const oldEnv = { ...process.env };

afterEach(() => {
  process.env = { ...oldEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gloo model policy", () => {
  it("uses the primary model for ordinary student questions", () => {
    const selection = selectGlooModelPolicy(baseInput, {
      GLOO_AI_MODEL: "GPT-5 Nano",
      GLOO_AI_ESCALATION_MODEL: "GPT-5 Mini",
      GLOO_AI_LONG_CONTEXT_MODEL: "Gemini 2.5 Flash Lite"
    });

    expect(selection).toMatchObject({
      model: "GPT-5 Nano",
      tier: "default"
    });
  });

  it("uses the escalation model for sensitive or complex topics", () => {
    const selection = selectGlooModelPolicy(
      {
        ...baseInput,
        question: "How should we respond when someone is grieving trauma and doubting God?"
      },
      {
        GLOO_AI_MODEL: "GPT-5 Nano",
        GLOO_AI_ESCALATION_MODEL: "GPT-5 Mini",
        GLOO_AI_LONG_CONTEXT_MODEL: "Gemini 2.5 Flash Lite"
      }
    );

    expect(selection).toMatchObject({
      model: "GPT-5 Mini",
      tier: "escalation"
    });
    expect(selection?.topicFlags).toEqual(expect.arrayContaining(["suffering", "doubt_deconstruction"]));
  });

  it("uses the long-context model when retrieved context is very large", () => {
    const selection = selectGlooModelPolicy(
      {
        ...baseInput,
        retrievedContext: "context ".repeat(2000)
      },
      {
        GLOO_AI_MODEL: "GPT-5 Nano",
        GLOO_AI_ESCALATION_MODEL: "GPT-5 Mini",
        GLOO_AI_LONG_CONTEXT_MODEL: "Gemini 2.5 Flash Lite"
      }
    );

    expect(selection).toMatchObject({
      model: "Gemini 2.5 Flash Lite",
      tier: "long_context"
    });
  });

  it("treats the new primary model variable as configured", () => {
    expect(
      isGlooConfigured({
        GLOO_AI_STUDIO_API_KEY: "key",
        GLOO_AI_STUDIO_API_BASE_URL: "https://example.test",
        GLOO_AI_MODEL: "GPT-5 Nano"
      })
    ).toBe(true);
  });

  it("treats Gloo AI client credentials as configured", () => {
    expect(
      isGlooConfigured({
        GLOO_AI_CLIENT_SECRET: "secret",
        GLOO_AI_BASE_URL: "https://platform.ai.gloo.com",
        GLOO_AI_MODEL: "GPT-5 Nano"
      })
    ).toBe(true);
  });

  it("uses the Gloo AI client secret and base URL aliases for draft generation", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        discussionPrompt: "Ask a careful question for the group.",
        safetyLabel: "safe",
        safetyNotes: "Leader can review before use.",
        confidence: 0.88,
        topicTags: ["prayer"],
        escalationRecommended: false,
        escalationReason: ""
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      model: "GPT-5 Nano",
      discussionPrompt: "Ask a careful question for the group."
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://platform.ai.gloo.com/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret"
        })
      })
    );
  });

  it("falls back to the v1 chat-completions endpoint when the base route is not found", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(
        jsonResponse({
          discussionPrompt: "Ask the group what this reveals about trust.",
          safetyLabel: "safe",
          safetyNotes: "Leader can review before use.",
          confidence: 0.9,
          topicTags: ["creation"],
          escalationRecommended: false,
          escalationReason: ""
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      discussionPrompt: "Ask the group what this reveals about trust."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://platform.ai.gloo.com/chat/completions");
    expect(fetchMock.mock.calls[1][0]).toBe("https://platform.ai.gloo.com/v1/chat/completions");
  });

  it("tries the Gloo API host when the platform host does not expose chat completions", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(
        jsonResponse({
          discussionPrompt: "Ask how the garden story frames trust in God.",
          safetyLabel: "safe",
          safetyNotes: "Leader can review before use.",
          confidence: 0.89,
          topicTags: ["creation", "trust"],
          escalationRecommended: false,
          escalationReason: ""
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      discussionPrompt: "Ask how the garden story frames trust in God."
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4][0]).toBe("https://api.ai.gloo.com/v1/chat/completions");
  });

  it("returns a safe credential diagnostic when Gloo rejects auth", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com/v1";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("unauthorized", { status: 401, statusText: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toEqual({
      ok: false,
      code: "provider_error",
      message: "Gloo AI Studio rejected the configured credentials."
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://platform.ai.gloo.com/v1/chat/completions");
    expect(warn).toHaveBeenCalledWith(
      "[gloo] discussion draft provider failure",
      expect.objectContaining({
        status: 401,
        url: "https://platform.ai.gloo.com/v1/chat/completions"
      })
    );
  });

  it("reruns on the escalation model when the default pass is low confidence", async () => {
    process.env.GLOO_AI_STUDIO_API_KEY = "key";
    process.env.GLOO_AI_STUDIO_API_BASE_URL = "https://example.test";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";
    process.env.GLOO_AI_ESCALATION_MODEL = "GPT-5 Mini";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          discussionPrompt: "Ask a first-pass question.",
          safetyLabel: "safe",
          safetyNotes: "Needs more theological depth.",
          confidence: 0.55,
          topicTags: ["doubt"],
          escalationRecommended: true,
          escalationReason: "default draft was shallow"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          discussionPrompt: "Ask a deeper, leader-reviewed question.",
          safetyLabel: "needs_leader_care",
          safetyNotes: "Leader should frame doubt with care.",
          confidence: 0.91,
          topicTags: ["doubt"],
          escalationRecommended: false,
          escalationReason: ""
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      model: "GPT-5 Mini",
      modelTier: "escalation",
      discussionPrompt: "Ask a deeper, leader-reviewed question."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("GPT-5 Nano");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe("GPT-5 Mini");
  });

  it("reports missing diagnostic configuration without calling Gloo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGlooDiscussionDiagnostic(baseInput, {});

    expect(result).toMatchObject({
      ok: false,
      configured: false,
      credentialsConfigured: false,
      baseUrlConfigured: false,
      primaryModelConfigured: false,
      attempts: []
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns safe diagnostic attempts when endpoint fallback succeeds", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }))
      .mockResolvedValueOnce(
        jsonResponse({
          discussionPrompt: "Ask the group how this passage invites trust.",
          safetyLabel: "safe",
          safetyNotes: "Leader can review before use.",
          confidence: 0.87,
          topicTags: ["trust"],
          escalationRecommended: false,
          escalationReason: ""
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGlooDiscussionDiagnostic(baseInput);

    expect(result).toMatchObject({
      ok: true,
      configured: true,
      selectedModel: "GPT-5 Nano",
      selectedTier: "default",
      draftPreview: {
        discussionPrompt: "Ask the group how this passage invites trust.",
        safetyLabel: "safe",
        confidence: 0.87
      },
      attempts: [
        {
          url: "https://platform.ai.gloo.com/chat/completions",
          ok: false,
          status: 404
        },
        {
          url: "https://platform.ai.gloo.com/v1/chat/completions",
          ok: true,
          status: 200
        }
      ]
    });
  });
});

function jsonResponse(content: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(content)
          }
        }
      ]
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
