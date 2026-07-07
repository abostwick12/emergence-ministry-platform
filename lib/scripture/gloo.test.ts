import { afterEach, describe, expect, it, vi } from "vitest";

import { generateGlooDiscussionDraft, isGlooConfigured, selectGlooModelPolicy } from "@/lib/scripture/gloo";
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
