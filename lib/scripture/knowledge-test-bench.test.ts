import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  formatStudentKnowledgeContextForGlooMock,
  generateGlooDiscussionDraftMock,
  getApprovedMeridianGroundingMock,
  getStudentKnowledgeMatchesMock,
  isGlooConfiguredMock
} = vi.hoisted(() => ({
  formatStudentKnowledgeContextForGlooMock: vi.fn(),
  generateGlooDiscussionDraftMock: vi.fn(),
  getApprovedMeridianGroundingMock: vi.fn(),
  getStudentKnowledgeMatchesMock: vi.fn(),
  isGlooConfiguredMock: vi.fn()
}));

vi.mock("@/lib/scripture/knowledge", () => ({
  formatStudentKnowledgeContextForGloo: formatStudentKnowledgeContextForGlooMock,
  getApprovedMeridianGrounding: getApprovedMeridianGroundingMock,
  getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock
}));

vi.mock("@/lib/scripture/gloo", () => ({
  generateGlooDiscussionDraft: generateGlooDiscussionDraftMock,
  isGlooConfigured: isGlooConfiguredMock
}));

import { KnowledgeTestBenchError, runKnowledgeTestBench } from "@/lib/scripture/knowledge-test-bench";

describe("Meridian test bench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGlooConfiguredMock.mockReturnValue(false);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("Source 1: Romans 8 and patient hope");
    getApprovedMeridianGroundingMock.mockResolvedValue({
      status: "grounded",
      decision: "generate",
      providerContext: "Approved evidence pack.",
      evidenceMap: {
        version: "1",
        mode: "shadow",
        question: "How do I trust God when suffering feels pointless?",
        intentRoute: "mixed",
        suppliedScriptureAnchors: ["Romans 8:18"],
        anchorStatus: "supported",
        supportedScriptureAnchors: ["Romans 8:18"],
        facets: [{
          id: "facet-1",
          query: "How do I trust God when suffering feels pointless?",
          route: "formation",
          required: true,
          status: "supported",
          claimIds: ["claim-1", "claim-2"],
          fragmentIds: ["fragment-1"],
          sourceIds: ["source-1"]
        }],
        relationships: [],
        requirements: { humanReview: true, pastoralCare: true, uncertainty: true },
        issueKinds: [],
        prohibitedConclusions: [],
        decision: "generate",
        decisionReasons: ["Every required facet has approved, permitted support."]
      },
      shadowTrace: {
        version: "1",
        mode: "shadow",
        intentRoute: "mixed",
        decision: "generate",
        anchorStatus: "supported",
        suppliedScriptureAnchors: ["Romans 8:18"],
        facets: [{
          id: "facet-1",
          route: "formation",
          required: true,
          status: "supported",
          approvedClaimCount: 2,
          supportingFragmentCount: 1,
          approvedSourceCount: 1
        }],
        relationshipCounts: {},
        requirements: { humanReview: true, pastoralCare: true, uncertainty: true },
        issueKinds: [],
        decisionReasons: ["Every required facet has approved, permitted support."]
      },
      approvedClaimCount: 2,
      approvedSourceCount: 1,
      supportedFacetCount: 1,
      requiredFacetCount: 1,
      missingFacets: [],
      message: "Approved evidence covers 1 of 1 required question parts."
    });
    generateGlooDiscussionDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "GPT-5 Nano",
      modelTier: "default",
      modelReason: "Default",
      escalationReason: "",
      topicTags: ["hope"],
      confidence: 0.88,
      discussionPrompt: "Where does Romans 8 make room for honest pain and hope?",
      answerDraft: {
        directAnswer: "Romans 8 does not call suffering good, but it places suffering inside Christian hope.",
        keyDistinctions: ["Hope is not denial of pain."],
        scriptureReferences: ["Romans 8:18-39"],
        uncertainty: ["The passage does not explain every specific cause of suffering."],
        pastoralCare: ["Do not rush a hurting student toward a tidy explanation."],
        questionsForLeader: ["What is the student's lived context?"],
        requiresHumanReview: true
      },
      safetyLabel: "safe",
      safetyNotes: "Leader can review before use."
    });
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "chunk-romans-hope",
        sourceChunkId: "chunk_1",
        label: "Because you asked about suffering",
        title: "Romans 8 and patient hope",
        description: "Hold suffering and hope together without rushing the conversation.",
        href: "/student/scripture/resources",
        topicTags: ["suffering", "hope"],
        scriptureReferences: ["Romans 8:18"],
        digQuestions: [
          "Where does the passage make room for honest grief?",
          "What does it reveal about God's nearness when life hurts?",
          "What response would be faithful without forcing a quick answer?"
        ]
      }
    ]);
  });

  it("previews source matches and next steps for leaders without saving a question", async () => {
    const result = await runKnowledgeTestBench(session("leader"), {
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18"
    });

    expect(getStudentKnowledgeMatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: "leader" }) }),
      expect.objectContaining({
        id: "knowledge-test-bench",
        question: "How do I trust God when suffering feels pointless?",
        scriptureReference: "Romans 8:18"
      })
    );
    expect(result.matches[0].title).toBe("Romans 8 and patient hope");
    expect(result.grounding).toMatchObject({
      status: "grounded",
      studentResourceMatchCount: 1
    });
    expect(result.grounding).not.toHaveProperty("providerContext");
    expect(result.grounding).not.toHaveProperty("evidenceMap");
    expect(result.grounding.shadowTrace).toMatchObject({ mode: "shadow", intentRoute: "mixed" });
    expect(result.nextStep.readingPlan.title).toBe("Romans 8 and patient hope");
    expect(result.aiDraft).toMatchObject({
      ok: false,
      configured: false,
      code: "not_configured"
    });
    expect(result.visibilityNote).toContain("Nothing is saved");
  });

  it("previews a Gloo draft when the provider is configured without saving a question", async () => {
    isGlooConfiguredMock.mockReturnValue(true);

    const result = await runKnowledgeTestBench(session("leader"), {
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18"
    });

    expect(formatStudentKnowledgeContextForGlooMock).toHaveBeenCalledWith(result.matches);
    expect(getApprovedMeridianGroundingMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: "leader" }) }),
      {
        id: "knowledge-test-bench",
        question: "How do I trust God when suffering feels pointless?",
        scriptureReference: "Romans 8:18"
      }
    );
    expect(generateGlooDiscussionDraftMock).toHaveBeenCalledWith({
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18",
      studentJourneyContext: "Source 1: Romans 8 and patient hope",
      approvedEvidenceContext: "Approved evidence pack.",
      groundingStatus: "grounded",
      requireStructuredAnswer: true
    });
    expect(result.aiDraft).toMatchObject({
      ok: true,
      provider: "gloo",
      model: "GPT-5 Nano",
      discussionPrompt: "Where does Romans 8 make room for honest pain and hope?",
      answerDraft: {
        directAnswer: "Romans 8 does not call suffering good, but it places suffering inside Christian hope.",
        requiresHumanReview: true
      }
    });
    expect(result.shadowEvaluation).toMatchObject({
      mode: "shadow",
      status: "pass"
    });
    expect(result.shadowEvaluation.gates).toContainEqual(expect.objectContaining({ id: "claim_attribution", status: "not_measured" }));
  });

  it("blocks student accounts from the leader preview", async () => {
    await expect(
      runKnowledgeTestBench(session("student"), {
        question: "Can I test this?"
      })
    ).rejects.toMatchObject({
      code: "forbidden",
      status: 403
    } satisfies Partial<KnowledgeTestBenchError>);
  });

  it("requires a real question", async () => {
    await expect(
      runKnowledgeTestBench(session("leader"), {
        question: "   "
      })
    ).rejects.toMatchObject({
      code: "required",
      status: 400
    } satisfies Partial<KnowledgeTestBenchError>);
  });
});

function session(role: string): AuthSession {
  return {
    isMock: false,
    accessToken: "token",
    user: {
      id: `usr_${role}`,
      email: `${role}@example.test`,
      fullName: `${role} User`,
      role
    }
  };
}
