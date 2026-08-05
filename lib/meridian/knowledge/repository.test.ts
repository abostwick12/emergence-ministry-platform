import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getSupabaseAuthClientMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getSupabaseAuthClientMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/server", () => ({ getSupabaseAuthClient: getSupabaseAuthClientMock }));
vi.mock("@/lib/ministry/scope", () => ({ resolveMinistryScope: resolveMinistryScopeMock }));

import { MeridianKnowledgeRepositoryError, SupabaseMeridianKnowledgeRepository } from "@/lib/meridian/knowledge/repository";

describe("Supabase Meridian repository boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMinistryScopeMock.mockResolvedValue("ministry-a");
  });

  it("rejects cross-tenant evidence requests before a database query", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    await expect(repository.loadApprovedEvidence(session("leader"), task("ministry-b"))).rejects.toMatchObject({ code: "tenant_scope", status: 403 });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("rejects student and guest roles from approved-generation retrieval", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    await expect(repository.loadApprovedEvidence(session("student"), task("ministry-a"))).rejects.toBeInstanceOf(MeridianKnowledgeRepositoryError);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("retrieves task-specific approved claims through the bounded search RPC", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    getSupabaseAuthClientMock.mockReturnValue({ rpc });
    const repository = new SupabaseMeridianKnowledgeRepository();

    await expect(repository.loadApprovedEvidence(session("leader"), {
      ...task("ministry-a"),
      query: "grace faith works",
      scriptureReferences: ["Ephesians 2:8-10"]
    })).resolves.toMatchObject({
      questionPlan: { question: "grace faith works", scriptureReferences: ["Ephesians 2:8-10"], ambiguous: false },
      facetCoverage: [{ facetId: "facet-1", claimIds: [] }],
      claims: [],
      fragments: [],
      relationships: [],
      sources: []
    });
    expect(rpc).toHaveBeenCalledWith("search_meridian_approved_claims", expect.objectContaining({
      p_ministry_id: "ministry-a",
      p_query_text: "grace faith works Ephesians 2:8-10",
      p_match_count: 32
    }));
  });

  it("retrieves each explicit question facet independently", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    getSupabaseAuthClientMock.mockReturnValue({ rpc });
    const repository = new SupabaseMeridianKnowledgeRepository();

    const result = await repository.loadApprovedEvidence(session("leader"), {
      ...task("ministry-a"),
      query: "How are we saved by grace, and how should we understand faith and works?"
    });

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenNthCalledWith(1, "search_meridian_question_maps", expect.objectContaining({
      p_query_text: "How are we saved by grace, and how should we understand faith and works?",
      p_match_count: 8
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, "search_meridian_approved_claims", expect.objectContaining({
      p_query_text: "How are we saved by grace",
      p_match_count: 16
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, "search_meridian_approved_claims", expect.objectContaining({
      p_query_text: "how should we understand faith and works?",
      p_match_count: 16
    }));
    expect(result.facetCoverage).toHaveLength(2);
  });

  it("retrieves approved claims through strongly matched reviewed question facets", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "search_meridian_question_maps") return { data: [questionMapRow()], error: null };
      if (name === "search_meridian_approved_claims") return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });
    getSupabaseAuthClientMock.mockReturnValue({ rpc });

    const result = await new SupabaseMeridianKnowledgeRepository().loadApprovedEvidence(session("leader"), {
      ...task("ministry-a"),
      query: "If God is three persons, why isn't that basically three gods?"
    });

    expect(result.questionPlan.matchedQuestionMap).toEqual({ id: "map-trinity", title: "Trinity and monotheism" });
    expect(result.questionPlan.facets.map((facet) => facet.query)).toEqual([
      "one divine being",
      "real personal distinction",
      "why this is not tritheism"
    ]);
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(rpc).toHaveBeenNthCalledWith(2, "search_meridian_approved_claims", expect.objectContaining({
      p_query_text: "one divine being",
      p_match_count: 10
    }));
  });

  it("does not execute a broad claim search when the question is missing", async () => {
    const rpc = vi.fn();
    getSupabaseAuthClientMock.mockReturnValue({ rpc });
    const repository = new SupabaseMeridianKnowledgeRepository();

    const result = await repository.loadApprovedEvidence(session("leader"), task("ministry-a"));

    expect(rpc).not.toHaveBeenCalled();
    expect(result.questionPlan).toMatchObject({ ambiguous: true, ambiguityReason: "missing_question" });
  });

  it("hydrates only relationships and sources connected to retrieved claims", async () => {
    const supportQuery = queryBuilder([{ claim_id: "claim-1", fragment_id: "fragment-1" }]);
    const relationshipQuery = queryBuilder([]);
    const sourceQuery = queryBuilder([sourceRow()]);
    const from = vi.fn((table: string) => {
      if (table === "meridian_claim_fragments") return supportQuery;
      if (table === "meridian_relationships") return relationshipQuery;
      if (table === "meridian_sources") return sourceQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "search_meridian_question_maps") return { data: [], error: null };
      if (name === "search_meridian_approved_claims") return { data: [claimRow()], error: null };
      if (name === "fetch_meridian_generation_fragments") return { data: [fragmentRow()], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });
    getSupabaseAuthClientMock.mockReturnValue({ rpc, from });

    const result = await new SupabaseMeridianKnowledgeRepository().loadApprovedEvidence(session("leader"), {
      ...task("ministry-a"),
      query: "How does grace save people?"
    });

    expect(result.claims).toHaveLength(1);
    expect(relationshipQuery.in).toHaveBeenCalledWith("from_object_id", ["claim-1"]);
    expect(relationshipQuery.in).toHaveBeenCalledWith("to_object_id", ["claim-1"]);
    expect(sourceQuery.in).toHaveBeenCalledWith("id", ["source-1"]);
  });

  it("requires admin role and non-none authority for promotion", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    const input = promotionInput();
    await expect(repository.promoteCandidate(session("leader"), input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      repository.promoteCandidate(session("admin"), { ...input, claim: { ...input.claim, authorityClass: "none" } })
    ).rejects.toMatchObject({ code: "invalid_authority" });
    await expect(
      repository.promoteCandidate(session("admin"), { ...input, claim: { ...input.claim, authorityClass: "canonical_scripture" } })
    ).rejects.toMatchObject({ code: "invalid_scripture_source" });
    await expect(
      repository.promoteCandidate(session("admin"), { ...input, fragment: { ...input.fragment, canUseFinalAnswer: false } })
    ).rejects.toMatchObject({ code: "missing_final_answer_permission" });
    await expect(
      repository.promoteCandidate(session("admin"), { ...input, claim: { ...input.claim, authorityClass: "approved_teaching" } })
    ).rejects.toMatchObject({ code: "authority_mismatch" });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("lists admin candidates with their immutable review history", async () => {
    const candidateQuery = listQueryBuilder([candidateRow()]);
    const eventQuery = listQueryBuilder([reviewEventRow()]);
    getSupabaseAuthClientMock.mockReturnValue({
      from(table: string) {
        if (table === "meridian_candidates") return candidateQuery;
        if (table === "meridian_review_events") return eventQuery;
        throw new Error(`Unexpected table ${table}`);
      }
    });

    const result = await new SupabaseMeridianKnowledgeRepository().listCandidates(session("admin"));

    expect(result).toEqual([
      expect.objectContaining({
        id: "candidate-1",
        objectType: "doctrine",
        claimProposals: ["God is one."],
        reviewEvents: [expect.objectContaining({ decision: "started_review" })]
      })
    ]);
    expect(candidateQuery.eq).toHaveBeenCalledWith("ministry_id", "ministry-a");
    expect(eventQuery.in).toHaveBeenCalledWith("candidate_id", ["candidate-1"]);
  });

  it("records candidate review transitions through one transactional RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        candidateId: "candidate-1",
        approvalStatus: "in_review",
        eventId: "event-1",
        eventCreatedAt: "2026-08-05T00:00:00.000Z"
      },
      error: null
    }));
    getSupabaseAuthClientMock.mockReturnValue({ rpc });

    await expect(new SupabaseMeridianKnowledgeRepository().reviewCandidate(session("admin"), {
      candidateId: "candidate-1",
      decision: "started_review",
      rationale: "Compare the source carefully."
    })).resolves.toEqual({
      candidateId: "candidate-1",
      approvalStatus: "in_review",
      event: {
        id: "event-1",
        decision: "started_review",
        rationale: "Compare the source carefully.",
        createdAt: "2026-08-05T00:00:00.000Z"
      }
    });
    expect(rpc).toHaveBeenCalledWith("review_meridian_candidate", {
      p_candidate_id: "candidate-1",
      p_decision: "started_review",
      p_rationale: "Compare the source carefully."
    });
  });

  it("requires a rejection rationale and blocks non-admin candidate review", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    await expect(repository.reviewCandidate(session("leader"), {
      candidateId: "candidate-1",
      decision: "started_review",
      rationale: ""
    })).rejects.toMatchObject({ code: "forbidden" });
    await expect(repository.reviewCandidate(session("admin"), {
      candidateId: "candidate-1",
      decision: "rejected",
      rationale: ""
    })).rejects.toMatchObject({ code: "missing_rationale" });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("delegates a valid promotion to the single transactional RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { sourceId: "source-1", fragmentId: "fragment-1", claimId: "claim-1" }, error: null }));
    const promotionQuery = singleQueryBuilder({ metadata: { objectType: "doctrine" }, approval_status: "in_review" });
    getSupabaseAuthClientMock.mockReturnValue({
      rpc,
      from(table: string) {
        if (table === "meridian_candidates") return promotionQuery;
        throw new Error(`Unexpected table ${table}`);
      }
    });
    const repository = new SupabaseMeridianKnowledgeRepository();

    await expect(repository.promoteCandidate(session("admin"), promotionInput())).resolves.toEqual({
      sourceId: "source-1",
      fragmentId: "fragment-1",
      claimId: "claim-1"
    });
    expect(rpc).toHaveBeenCalledWith("promote_meridian_candidate", expect.objectContaining({ p_candidate_id: "candidate-1" }));
  });

  it("promotes a reviewed question candidate into a planning-only map", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        candidateId: "candidate-1",
        questionMapId: "map-trinity",
        eventId: "event-2",
        eventCreatedAt: "2026-08-05T12:00:00.000Z"
      },
      error: null
    }));
    getSupabaseAuthClientMock.mockReturnValue({
      rpc,
      from: () => singleQueryBuilder({ metadata: { objectType: "question" }, approval_status: "in_review" })
    });

    await expect(new SupabaseMeridianKnowledgeRepository().promoteQuestionMap(session("admin"), questionMapPromotionInput())).resolves.toEqual({
      candidateId: "candidate-1",
      questionMapId: "map-trinity",
      event: {
        id: "event-2",
        decision: "promoted",
        rationale: "These facets preserve the actual objection without embedding an answer.",
        createdAt: "2026-08-05T12:00:00.000Z"
      }
    });
    expect(rpc).toHaveBeenCalledWith("promote_meridian_question_map", {
      p_candidate_id: "candidate-1",
      p_aliases: ["If God is three persons, isn't that three gods?"],
      p_facets: ["one divine being", "real personal distinction", "why this is not tritheism"],
      p_topics: ["trinity", "monotheism"],
      p_rationale: "These facets preserve the actual objection without embedding an answer."
    });
  });

  it("requires a reviewed question candidate and bounded map fields", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    await expect(repository.promoteQuestionMap(session("leader"), questionMapPromotionInput())).rejects.toMatchObject({ code: "forbidden" });
    await expect(repository.promoteQuestionMap(session("admin"), {
      ...questionMapPromotionInput(),
      facets: [],
      rationale: ""
    })).rejects.toMatchObject({ code: "invalid_question_map" });
    await expect(repository.promoteQuestionMap(session("admin"), {
      ...questionMapPromotionInput(),
      aliases: ["x".repeat(501)]
    })).rejects.toMatchObject({ code: "invalid_question_map" });

    getSupabaseAuthClientMock.mockReturnValueOnce({
      rpc: vi.fn(),
      from: () => singleQueryBuilder({ metadata: { objectType: "question" }, approval_status: "unreviewed" })
    });
    await expect(repository.promoteQuestionMap(session("admin"), questionMapPromotionInput())).rejects.toMatchObject({ code: "review_required" });

    getSupabaseAuthClientMock.mockReturnValueOnce({
      rpc: vi.fn(),
      from: () => singleQueryBuilder({ metadata: { objectType: "doctrine" }, approval_status: "in_review" })
    });
    await expect(repository.promoteQuestionMap(session("admin"), questionMapPromotionInput())).rejects.toMatchObject({ code: "unsupported_candidate_type" });
  });

  it("requires started review and a claim-compatible candidate type before promotion", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    const rpc = vi.fn();
    getSupabaseAuthClientMock.mockReturnValueOnce({
      rpc,
      from: () => singleQueryBuilder({ metadata: { objectType: "doctrine" }, approval_status: "unreviewed" })
    });
    await expect(repository.promoteCandidate(session("admin"), promotionInput())).rejects.toMatchObject({ code: "review_required" });

    getSupabaseAuthClientMock.mockReturnValueOnce({
      rpc,
      from: () => singleQueryBuilder({ metadata: { objectType: "guardrail_proposal" }, approval_status: "in_review" })
    });
    await expect(repository.promoteCandidate(session("admin"), promotionInput())).rejects.toMatchObject({ code: "unsupported_candidate_type" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps legacy authored review admin-only and rejects unsafe permissions", async () => {
    const repository = new SupabaseMeridianKnowledgeRepository();
    const input = legacyPromotionInput();

    await expect(repository.promoteLegacyClaim(session("leader"), input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(repository.promoteLegacyClaim(session("admin"), {
      ...input,
      fragment: { ...input.fragment, canUseFinalAnswer: false }
    })).rejects.toMatchObject({ code: "missing_final_answer_permission" });
    await expect(repository.promoteLegacyClaim(session("admin"), {
      ...input,
      fragment: { ...input.fragment, canUseExternalCommunication: true }
    })).rejects.toMatchObject({ code: "invalid_external_permission" });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("promotes one reviewed legacy claim through the transactional RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: { sourceId: "source-1", fragmentId: "fragment-1", claimId: "claim-1", sourceKind: "academic_paper" },
      error: null
    }));
    getSupabaseAuthClientMock.mockReturnValue({ rpc });

    await expect(new SupabaseMeridianKnowledgeRepository().promoteLegacyClaim(session("admin"), legacyPromotionInput())).resolves.toEqual({
      sourceId: "source-1",
      fragmentId: "fragment-1",
      claimId: "claim-1",
      sourceKind: "academic_paper"
    });
    expect(rpc).toHaveBeenCalledWith("promote_legacy_meridian_claim", expect.objectContaining({
      p_legacy_source_id: "0d94e9ae-f40e-48dd-9380-6dcf6932822a",
      p_legacy_chunk_id: "39eb5e80-a439-4ad9-8629-145ee467a9ea",
      p_source_kind: "academic_paper"
    }));
  });
});

function session(role: string): AuthSession {
  return {
    user: { id: "user-1", email: "user@example.com", fullName: "Example User", role },
    accessToken: "token",
    isMock: false
  };
}

function task(ministryId: string) {
  return {
    ministryId,
    audience: "leaders",
    taskType: "brief",
    sensitivity: "internal" as const,
    at: "2026-08-01T00:00:00.000Z",
    externalCommunication: false
  };
}

function promotionInput() {
  return {
    candidateId: "candidate-1",
    rationale: "Reviewed against adopted ministry strategy.",
    source: {
      title: "Reviewed source",
      authorityClass: "current_strategy" as const,
      externalVisibility: "ministry" as const,
      quotePolicy: "review_required" as const,
      sensitivity: "internal" as const
    },
    fragment: {
      text: "Synthetic reviewed fragment text.",
      locator: { kind: "note_block", value: "Reviewed promotion" },
      canQuote: false,
      canParaphrase: true,
      canCite: true,
      canUseFinalAnswer: true,
      canUseExternalCommunication: false
    },
    claim: {
      proposition: "Synthetic reviewed atomic claim.",
      kind: "strategy_priority" as const,
      authorityClass: "current_strategy" as const,
      confidence: 0.9,
      scope: {}
    }
  };
}

function legacyPromotionInput() {
  return {
    legacySourceId: "0d94e9ae-f40e-48dd-9380-6dcf6932822a",
    legacyChunkId: "39eb5e80-a439-4ad9-8629-145ee467a9ea",
    sourceKind: "academic_paper" as const,
    rationale: "The claim and its limits are explicit in the reviewed paper.",
    source: {
      title: "Synthetic academic paper",
      attribution: "Synthetic author",
      authorityClass: "approved_teaching" as const,
      externalVisibility: "ministry" as const,
      quotePolicy: "review_required" as const,
      sensitivity: "internal" as const
    },
    fragment: {
      text: "Synthetic exact supporting excerpt.",
      locator: { kind: "record", value: "Legacy chunk 1" },
      canQuote: false,
      canParaphrase: true,
      canCite: true,
      canUseFinalAnswer: true,
      canUseExternalCommunication: false
    },
    claim: {
      proposition: "The synthetic claim is explicit and appropriately qualified.",
      kind: "interpretation" as const,
      attribution: "Synthetic author",
      authorityClass: "approved_teaching" as const,
      confidence: 0.9,
      scope: { topics: ["synthetic"] }
    }
  };
}

function queryBuilder(data: unknown[]) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn(async () => ({ data, error: null }))
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  return builder;
}

function listQueryBuilder(data: unknown[]) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    returns: vi.fn(async () => ({ data, error: null }))
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

function singleQueryBuilder(data: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => ({ data, error: null }))
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function candidateRow() {
  return {
    id: "candidate-1",
    title: "One God and Triune Confession",
    source_uri: "10 Meridian Candidates/doctrine.md",
    raw_text: "Reviewed source note",
    content_hash: "b".repeat(64),
    approval_status: "in_review",
    sensitivity: "internal",
    metadata: {
      objectType: "doctrine",
      studentSummary: "A bounded doctrinal candidate.",
      topicTags: ["trinity"],
      scriptureReferences: ["Deuteronomy 6:4"],
      claimProposals: ["God is one."]
    },
    created_at: "2026-08-04T00:00:00.000Z",
    reviewed_at: null,
    promoted_source_id: null
  };
}

function questionMapPromotionInput() {
  return {
    candidateId: "candidate-1",
    aliases: ["If God is three persons, isn't that three gods?"],
    facets: ["one divine being", "real personal distinction", "why this is not tritheism"],
    topics: ["trinity", "monotheism"],
    rationale: "These facets preserve the actual objection without embedding an answer."
  };
}

function reviewEventRow() {
  return {
    id: "event-1",
    candidate_id: "candidate-1",
    decision: "started_review",
    rationale: "Compare the source carefully.",
    created_at: "2026-08-05T00:00:00.000Z"
  };
}

function claimRow() {
  return {
    id: "claim-1",
    ministry_id: "ministry-a",
    proposition: "People are saved by grace.",
    claim_kind: "doctrinal_summary",
    attribution: null,
    authority_class: "adopted_doctrine",
    approval_status: "approved",
    confidence: 0.95,
    scope: {},
    derived_artifact: false
  };
}

function fragmentRow() {
  return {
    id: "fragment-1",
    ministry_id: "ministry-a",
    source_id: "source-1",
    locator: { kind: "section", value: "Grace" },
    content_hash: "a".repeat(64),
    body_text: "",
    provenance: {},
    quote_policy: "never",
    generation_policy: "approved_generation",
    sensitivity: "internal",
    can_quote: false,
    can_paraphrase: true,
    can_cite: true,
    can_use_final_answer: true,
    can_use_external_communication: false
  };
}

function sourceRow() {
  return {
    id: "source-1",
    ministry_id: "ministry-a",
    source_kind: "policy",
    corpus_family: "approved_church",
    title: "Approved grace doctrine",
    source_uri: null,
    attribution: null,
    authority_class: "adopted_doctrine",
    approval_status: "approved",
    external_visibility: "ministry",
    quote_policy: "never",
    generation_policy: "approved_generation",
    sensitivity: "internal",
    origin_mode: "direct",
    approved_by_user_id: "admin-1",
    approved_at: "2026-08-01T00:00:00.000Z"
  };
}

function questionMapRow() {
  return {
    id: "map-trinity",
    ministry_id: "ministry-a",
    title: "Trinity and monotheism",
    aliases: ["If God is three persons, isn't that three gods?"],
    facets: ["one divine being", "real personal distinction", "why this is not tritheism"],
    topics: ["trinity", "monotheism"],
    scripture_references: []
  };
}
