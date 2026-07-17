import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateGlooDiscussionDraft,
  generateGlooReadingPlanDraft,
  isGlooConfigured,
  resetGlooAccessTokenCacheForTests,
  runGlooDiscussionDiagnostic,
  selectGlooModelPolicy
} from "@/lib/scripture/gloo";
import type { GlooDiscussionDraftInput } from "@/lib/scripture/gloo";

const baseInput: GlooDiscussionDraftInput = {
  question: "How do we talk about prayer in small group?",
  scriptureReference: "Matthew 6:9",
  metanarrativeMovement: "Jesus / Kingdom Fulfilled"
};

const oldEnv = { ...process.env };

afterEach(() => {
  resetGlooAccessTokenCacheForTests();
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
      model: "gloo-openai-gpt-5-nano",
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
      model: "gloo-openai-gpt-5-mini",
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
      model: "gloo-google-gemini-2.5-flash-lite",
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
        GLOO_AI_CLIENT_ID: "client-id",
        GLOO_AI_BASE_URL: "https://platform.ai.gloo.com",
        GLOO_AI_MODEL: "GPT-5 Nano"
      })
    ).toBe(true);
  });

  it("exchanges Gloo client credentials and uses the official v2 chat endpoint", async () => {
    process.env.GLOO_AI_CLIENT_ID = "client-id";
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
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
      model: "gloo-openai-gpt-5-nano",
      discussionPrompt: "Ask a careful question for the group."
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://platform.ai.gloo.com/ai/v2/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token"
        })
      })
    );
  });

  it("sends internal grounding as posture-only context, not student-facing content", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        discussionPrompt: "Ask the group what the text invites them to notice.",
        safetyLabel: "safe",
        safetyNotes: "Leader can review before use.",
        confidence: 0.91,
        topicTags: ["trust"],
        escalationRecommended: false,
        escalationReason: ""
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateGlooDiscussionDraft({
      ...baseInput,
      internalGroundingContext: "Grounding signal 1:\nSynthesis: Ask abstract questions that deepen attention."
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Never quote, summarize, cite, reveal, or assign internal grounding material to students.");
    expect(body.messages[1].content).toContain("Internal grounding for posture only:");
    expect(body.messages[1].content).toContain("Ask abstract questions that deepen attention.");
    expect(body.messages[1].content).toContain("Drive toward engagement");
  });

  it("normalizes the Gloo platform origin to the official v2 chat endpoint", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://platform.ai.gloo.com/ai/v2/chat/completions");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("gloo-openai-gpt-5-nano");
  });

  it("appends chat completions to a custom compatible base URL", async () => {
    process.env.GLOO_AI_STUDIO_API_KEY = "access-token";
    process.env.GLOO_AI_BASE_URL = "https://gloo-proxy.example.test/ai/v2";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://gloo-proxy.example.test/ai/v2/chat/completions");
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
    expect(fetchMock.mock.calls[0][0]).toBe("https://platform.ai.gloo.com/ai/v2/chat/completions");
    expect(warn).toHaveBeenCalledWith(
      "[gloo] discussion draft provider failure",
      expect.objectContaining({
        status: 401,
        url: "https://platform.ai.gloo.com/ai/v2/chat/completions"
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
      model: "gloo-openai-gpt-5-mini",
      modelTier: "escalation",
      discussionPrompt: "Ask a deeper, leader-reviewed question."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("gloo-openai-gpt-5-nano");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe("gloo-openai-gpt-5-mini");
  });

  it("reports missing diagnostic configuration without calling Gloo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGlooDiscussionDiagnostic(baseInput, {});

    expect(result).toMatchObject({
      ok: false,
      configured: false,
      credentialsConfigured: false,
      baseUrlConfigured: true,
      primaryModelConfigured: false,
      attempts: []
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe diagnostic attempt against the official endpoint", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
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
      selectedModel: "gloo-openai-gpt-5-nano",
      selectedTier: "default",
      draftPreview: {
        discussionPrompt: "Ask the group how this passage invites trust.",
        safetyLabel: "safe",
        confidence: 0.87
      },
      attempts: [
        {
          url: "https://platform.ai.gloo.com/ai/v2/chat/completions",
          ok: true,
          status: 200
        }
      ]
    });
  });

  it("parses fenced JSON draft content from Gloo-compatible providers", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com/v1";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "```json\n" +
                  JSON.stringify({
                    discussionPrompt: "Ask the group where the passage invites trust.",
                    safetyLabel: "safe",
                    safetyNotes: "Leader can review before use.",
                    confidence: 0.86,
                    topicTags: ["trust"],
                    escalationRecommended: false,
                    escalationReason: ""
                  }) +
                  "\n```"
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      discussionPrompt: "Ask the group where the passage invites trust."
    });
  });

  it("parses content-part arrays from Gloo-compatible providers", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com/v1";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  {
                    text: JSON.stringify({
                      discussionPrompt: "Ask the group what prayer teaches them to notice.",
                      safetyLabel: "safe",
                      safetyNotes: "Leader can review before use.",
                      confidence: 0.9,
                      topicTags: ["prayer"],
                      escalationRecommended: false,
                      escalationReason: ""
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toMatchObject({
      ok: true,
      discussionPrompt: "Ask the group what prayer teaches them to notice."
    });
  });

  it("returns a provider error instead of throwing when the Gloo request fails", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com/v1";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network unavailable")));

    const result = await generateGlooDiscussionDraft(baseInput);

    expect(result).toEqual({
      ok: false,
      code: "provider_error",
      message: "network unavailable"
    });
    expect(warn).toHaveBeenCalledWith(
      "[gloo] discussion draft provider failure",
      expect.objectContaining({
        message: "network unavailable"
      })
    );
  });

  it("generates a reading-plan draft through the configured Gloo chat endpoint", async () => {
    process.env.GLOO_AI_CLIENT_SECRET = "secret";
    process.env.GLOO_AI_BASE_URL = "https://platform.ai.gloo.com/v1";
    process.env.GLOO_AI_MODEL = "GPT-5 Nano";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        title: "Exodus and Formation",
        audience: "High school small group",
        duration: "4 weeks",
        primaryScripture: "Exodus 1-20",
        movement: "Exodus / Deliverance",
        summary: "Trace rescue before formation.",
        contextFocus: "Read commands inside God's deliverance.",
        weeklyRhythm: ["Day 1: Exodus 1-2", "Day 2: Exodus 3-4"],
        discussionPrompts: ["Where do we see God hear his people?"],
        guardrailNotes: ["Do not separate law from rescue."],
        prayerPrompt: "Pray for trust in God's rescue.",
        safetyNotes: "Leader should review before sharing."
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGlooReadingPlanDraft({
      title: "Exodus and Formation",
      audience: "High school small group",
      duration: "4 weeks",
      primaryScripture: "Exodus 1-20",
      contextNotes: "Rescue comes before Sinai.",
      observationQuestion: "What repeats?",
      interpretationQuestion: "What does this mean in context?",
      applicationQuestion: "How should we respond?",
      discussionQuestion: "Where do students wrestle?",
      prayerPrompt: "Pray honestly.",
      guardrailNotes: "Avoid moralizing."
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "gloo",
      model: "gloo-openai-gpt-5-nano",
      title: "Exodus and Formation",
      movement: "Exodus / Deliverance",
      weeklyRhythm: ["Day 1: Exodus 1-2", "Day 2: Exodus 3-4"]
    });
    expect(fetchMock).toHaveBeenCalledWith("https://platform.ai.gloo.com/ai/v2/chat/completions", expect.any(Object));
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
