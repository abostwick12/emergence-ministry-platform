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
    })).resolves.toEqual({ claims: [], fragments: [], relationships: [], sources: [] });
    expect(rpc).toHaveBeenCalledWith("search_meridian_approved_claims", expect.objectContaining({
      p_ministry_id: "ministry-a",
      p_query_text: "grace faith works",
      p_match_count: 32
    }));
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
