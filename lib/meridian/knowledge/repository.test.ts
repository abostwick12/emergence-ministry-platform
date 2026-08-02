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

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "search_meridian_approved_claims", expect.objectContaining({
      p_query_text: "How are we saved by grace",
      p_match_count: 16
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, "search_meridian_approved_claims", expect.objectContaining({
      p_query_text: "how should we understand faith and works?",
      p_match_count: 16
    }));
    expect(result.facetCoverage).toHaveLength(2);
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
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("delegates a valid promotion to the single transactional RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { sourceId: "source-1", fragmentId: "fragment-1", claimId: "claim-1" }, error: null }));
    getSupabaseAuthClientMock.mockReturnValue({ rpc });
    const repository = new SupabaseMeridianKnowledgeRepository();

    await expect(repository.promoteCandidate(session("admin"), promotionInput())).resolves.toEqual({
      sourceId: "source-1",
      fragmentId: "fragment-1",
      claimId: "claim-1"
    });
    expect(rpc).toHaveBeenCalledWith("promote_meridian_candidate", expect.objectContaining({ p_candidate_id: "candidate-1" }));
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
