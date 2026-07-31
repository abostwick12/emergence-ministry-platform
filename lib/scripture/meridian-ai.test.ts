import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  generateGlooDiscussionDraftMock,
  generateGlooReadingPlanDraftMock,
  glooEmmaGenerateMock,
  geminiGenerateMock,
  isGlooConfiguredMock,
  openAiGenerateMock
} = vi.hoisted(() => ({
  generateGlooDiscussionDraftMock: vi.fn(),
  generateGlooReadingPlanDraftMock: vi.fn(),
  glooEmmaGenerateMock: vi.fn(),
  geminiGenerateMock: vi.fn(),
  isGlooConfiguredMock: vi.fn(),
  openAiGenerateMock: vi.fn()
}));

vi.mock("@/lib/scripture/gloo", () => ({
  generateGlooDiscussionDraft: generateGlooDiscussionDraftMock,
  generateGlooReadingPlanDraft: generateGlooReadingPlanDraftMock,
  isGlooConfigured: isGlooConfiguredMock
}));

vi.mock("@/lib/emma/providers/registry", () => ({
  DEFAULT_GEMINI_MODEL: "gemini-default"
}));

vi.mock("@/lib/emma/providers/gemini-provider", () => ({
  createGeminiProvider: () => ({
    id: "gemini",
    generate: geminiGenerateMock
  })
}));

vi.mock("@/lib/emma/providers/gloo-provider", () => ({
  readGlooEmmaConfig: (env: Partial<NodeJS.ProcessEnv> = process.env) =>
    env.GLOO_AI_STUDIO_API_KEY?.trim()
      ? {
          accessToken: env.GLOO_AI_STUDIO_API_KEY.trim(),
          clientId: "",
          clientSecret: "",
          apiBaseUrl: "https://gloo.test",
          model: "gloo-openai-gpt-5-nano"
        }
      : null,
  createGlooEmmaProvider: () => ({
    id: "gloo",
    generate: glooEmmaGenerateMock
  })
}));

vi.mock("@/lib/emma/providers/openai-provider", () => ({
  DEFAULT_OPENAI_EMMA_MODEL: "openai-default",
  createOpenAIEmmaProvider: () => ({
    id: "openai",
    generate: openAiGenerateMock
  })
}));

import {
  generateMeridianDiscussionDraft,
  generateMeridianReadingPlanDraft,
  generateMeridianSermonPrepResource,
  getMeridianAiReadiness
} from "@/lib/scripture/meridian-ai";

describe("Meridian AI provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGlooConfiguredMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports Gloo as the primary provider when Gloo and OpenAI are both configured", () => {
    isGlooConfiguredMock.mockReturnValue(true);
    vi.stubEnv("OPENAI_API_KEY", "configured-openai-key");

    expect(getMeridianAiReadiness()).toMatchObject({
      configured: true,
      gloo: true,
      openai: true,
      primaryProvider: "gloo",
      fallbackProviders: ["openai"]
    });
  });

  it("returns the Gloo discussion draft before calling fallback providers", async () => {
    isGlooConfiguredMock.mockReturnValue(true);
    vi.stubEnv("OPENAI_API_KEY", "configured-openai-key");
    generateGlooDiscussionDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "GPT-5 Nano",
      modelTier: "default",
      modelReason: "Default Gloo model.",
      escalationReason: "",
      topicTags: ["trust"],
      confidence: 0.9,
      discussionPrompt: "Where does the text invite trust?",
      safetyLabel: "safe",
      safetyNotes: "Leader can review before use."
    });

    const result = await generateMeridianDiscussionDraft({
      question: "Why trust God?",
      scriptureReference: "Genesis 3"
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "gloo",
      discussionPrompt: "Where does the text invite trust?"
    });
    expect(openAiGenerateMock).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI for discussion drafts when Gloo fails", async () => {
    isGlooConfiguredMock.mockReturnValue(true);
    vi.stubEnv("OPENAI_API_KEY", "configured-openai-key");
    generateGlooDiscussionDraftMock.mockResolvedValue({
      ok: false,
      code: "provider_error",
      message: "Gloo AI Studio is temporarily unavailable."
    });
    openAiGenerateMock.mockResolvedValue({
      provider: "openai",
      model: "gpt-4o-mini",
      output: {
        discussionPrompt: "Where does Genesis 3 help us talk about trust before blame?",
        safetyLabel: "safe",
        safetyNotes: "Leader can review before use.",
        confidence: 0.84,
        topicTags: ["creation", "trust"],
        escalationReason: ""
      }
    });

    const result = await generateMeridianDiscussionDraft({
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3"
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "openai",
      model: "gpt-4o-mini",
      discussionPrompt: "Where does Genesis 3 help us talk about trust before blame?"
    });
  });

  it("uses Gemini fallback for reading-plan drafts when Gloo is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "configured-gemini-key");
    geminiGenerateMock.mockResolvedValue({
      provider: "gemini",
      model: "gemini-default",
      output: {
        title: "Exodus and Formation",
        audience: "High school small group",
        duration: "4 weeks",
        primaryScripture: "Exodus 1-20",
        movement: "Exodus / Deliverance",
        summary: "Trace rescue before formation.",
        contextFocus: "Read commands inside God's deliverance.",
        weeklyRhythm: ["Day 1: Exodus 1-2"],
        discussionPrompts: ["Where does God hear his people?"],
        guardrailNotes: ["Do not separate law from rescue."],
        prayerPrompt: "Pray for trust in God's rescue.",
        safetyNotes: "Leader can review before sharing."
      }
    });

    const result = await generateMeridianReadingPlanDraft({
      title: "Exodus and Formation",
      audience: "High school small group",
      duration: "4 weeks",
      primaryScripture: "Exodus 1-20",
      contextNotes: "Rescue before formation.",
      observationQuestion: "",
      interpretationQuestion: "",
      applicationQuestion: "",
      discussionQuestion: "",
      prayerPrompt: "",
      guardrailNotes: ""
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "gemini",
      title: "Exodus and Formation",
      weeklyRhythm: ["Day 1: Exodus 1-2"]
    });
    expect(generateGlooReadingPlanDraftMock).not.toHaveBeenCalled();
  });

  it("builds a Meridian-shaped deterministic leader guide with provenance when providers are offline", async () => {
    const result = await generateMeridianSermonPrepResource({
      kind: "leader_guide",
      title: "When the King Kneels",
      passage: "John 13:1-17",
      bigIdea: "Real authority stoops. If Jesus is Lord, love looks like a towel, not a title.",
      body: "Jesus knows where he comes from and where he is going, so he kneels to wash feet before the cross."
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "deterministic",
      provenance: expect.objectContaining({
        meridianRan: true,
        fallbackUsed: true,
        validationResult: "validated",
        selectedSourceTypes: expect.arrayContaining(["current_sermon_draft", "lesson_big_idea"])
      })
    });
    expect(result.contentMarkdown).toContain("## Lesson Summary");
    expect(result.contentMarkdown).toContain("## Likely Student Misunderstandings");
    expect(result.contentMarkdown).toContain("## Pastoral Considerations");
    expect(result.contentMarkdown).not.toMatch(/citation|footnote|internal document/i);
  });

  it("builds student-ready small group questions through Notice, Interpret, Wrestle, Practice, and Community", async () => {
    const result = await generateMeridianSermonPrepResource({
      kind: "small_group_questions",
      title: "When the King Kneels",
      passage: "John 13:1-17",
      bigIdea: "Real authority stoops. If Jesus is Lord, love looks like a towel, not a title.",
      body: "Jesus washes feet and teaches his disciples the shape of kingdom love."
    });

    expect(result.contentMarkdown).toEqual(expect.stringContaining("Notice:"));
    expect(result.contentMarkdown).toEqual(expect.stringContaining("Interpret:"));
    expect(result.contentMarkdown).toEqual(expect.stringContaining("Wrestle:"));
    expect(result.contentMarkdown).toEqual(expect.stringContaining("Practice:"));
    expect(result.contentMarkdown).toEqual(expect.stringContaining("Community:"));
    expect(result.provenance).toMatchObject({
      meridianRan: true,
      fallbackUsed: true,
      validationResult: "validated"
    });
  });

  it("does not call configured live providers when sermon prep generation disables them", async () => {
    vi.stubEnv("GEMINI_API_KEY", "configured-gemini-key");

    const result = await generateMeridianSermonPrepResource({
      kind: "leader_guide",
      title: "When the King Kneels",
      passage: "John 13:1-17",
      bigIdea: "Real authority stoops.",
      body: "Jesus kneels.",
      allowLiveProviders: false
    });

    expect(result.provider).toBe("deterministic");
    expect(geminiGenerateMock).not.toHaveBeenCalled();
    expect(glooEmmaGenerateMock).not.toHaveBeenCalled();
  });

  it("does not replace successful AI sermon prep output with deterministic fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "configured-gemini-key");
    const contentMarkdown = [
      "# When the King Kneels - Small Group Questions",
      "",
      "1. Notice: What does Jesus know before He kneels to wash feet?",
      "2. Interpret: What does the towel show about kingdom authority?",
      "3. Wrestle: Why might receiving grace feel harder than serving?",
      "4. Practice: What is one quiet act of love you can do this week?",
      "5. Community: Who can help you serve from security instead of applause?"
    ].join("\n");
    geminiGenerateMock.mockResolvedValue({
      provider: "gemini",
      model: "gemini-default",
      output: {
        title: "When the King Kneels - Small Group Questions",
        summary: "Student-ready questions shaped by John 13 and humble love.",
        contentMarkdown,
        estimatedMinutes: 8,
        sources: ["Current sermon draft", "Meridian synthesis brief"],
        warnings: []
      }
    });

    const result = await generateMeridianSermonPrepResource({
      kind: "small_group_questions",
      title: "When the King Kneels",
      passage: "John 13:1-17",
      bigIdea: "Real authority stoops. If Jesus is Lord, love looks like a towel, not a title.",
      body: "Jesus washes feet and teaches his disciples the shape of kingdom love.",
      knowledgeMatches: [
        {
          id: "knowledge-john-13",
          sourceChunkId: "chunk_john_13",
          label: "Because this lesson echoes prior teaching",
          title: "Receive before you serve",
          description: "Prior teaching emphasizes that students practice service as a response to received grace, not as performance.",
          href: "/student/scripture/resources",
          digQuestions: ["Where does Jesus serve before asking disciples to imitate him?"],
          topicTags: ["grace", "service", "discipleship"],
          scriptureReferences: ["John 13:1-17"]
        }
      ]
    });

    expect(result).toMatchObject({
      provider: "gemini",
      contentMarkdown,
      provenance: expect.objectContaining({
        fallbackUsed: false,
        validationResult: "validated",
        selectedSourceIds: expect.arrayContaining(["chunk:chunk_john_13"]),
        selectedSourceTypes: expect.arrayContaining(["meridian_knowledge"])
      })
    });
    expect(geminiGenerateMock).toHaveBeenCalledWith(expect.objectContaining({
      userPrompt: expect.stringContaining("Receive before you serve")
    }));
  });

  it("uses only one sermon-prep repair attempt across configured providers", async () => {
    vi.stubEnv("GLOO_AI_STUDIO_API_KEY", "configured-gloo-key");
    vi.stubEnv("GEMINI_API_KEY", "configured-gemini-key");
    glooEmmaGenerateMock.mockResolvedValue({
      provider: "gloo",
      model: "gloo-openai-gpt-5-nano",
      output: {
        title: "Broken Guide",
        summary: "Too thin.",
        contentMarkdown: "Missing required shape.",
        estimatedMinutes: 2,
        sources: [],
        warnings: []
      }
    });
    geminiGenerateMock.mockResolvedValue({
      provider: "gemini",
      model: "gemini-default",
      output: {
        title: "When the King Kneels - Leader Guide",
        summary: "A volunteer guide shaped around receiving grace before serving.",
        contentMarkdown: [
          "# When the King Kneels - Leader Guide",
          "",
          "## Lesson Summary",
          "This lesson moves students from observing Jesus' secure identity to practicing humble love from received grace rather than performance. Leaders should keep the passage anchored in John 13 and the cross-shaped kingdom.",
          "",
          "## Likely Student Misunderstandings",
          "- Students may hear service as earning approval instead of responding to Jesus.",
          "- Students may miss that Peter needs to receive before he can imitate.",
          "",
          "## Leader Guidance",
          "Read slowly, name what Jesus knows, and keep the group from rushing into generic kindness advice.",
          "",
          "## Discussion Strategy",
          "Move from Notice to Interpret to Wrestle to Practice to Community with concise questions.",
          "",
          "## Pastoral Considerations",
          "Watch for shame, pressure to prove usefulness, or care concerns that need trusted follow-up.",
          "",
          "## Practical Application",
          "Ask each student to name one ordinary act of love and one way to receive Jesus' grace this week."
        ].join("\n"),
        estimatedMinutes: 10,
        sources: ["Current sermon draft", "Meridian synthesis brief"],
        warnings: []
      }
    });

    const result = await generateMeridianSermonPrepResource({
      kind: "leader_guide",
      title: "When the King Kneels",
      passage: "John 13:1-17",
      bigIdea: "Real authority stoops. If Jesus is Lord, love looks like a towel, not a title.",
      body: "Jesus knows where he comes from and where he is going, so he kneels to wash feet before the cross."
    });

    expect(result.provider).toBe("gemini");
    expect(glooEmmaGenerateMock).toHaveBeenCalledTimes(2);
    expect(geminiGenerateMock).toHaveBeenCalledTimes(1);
  });
});
