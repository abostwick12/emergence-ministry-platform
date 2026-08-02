export type MeridianRetrievalCalibrationCase = {
  id: string;
  category: string;
  query: string;
  expectedBehavior: string;
  audience?: string;
  taskType?: string;
  requestedTenant?: "primary" | "neighbor";
};

// Locked before any semantic retrieval or ranking-weight work. Expectations
// describe observable behavior and intentionally contain no preferred answer prose.
export const meridianRetrievalCorpusV1 = {
  version: "2026-08-02.v1",
  locked: true,
  fixture: "meridian_retrieval_calibration_2026_08_02",
  cases: [
    { id: "grace_core", category: "relevance", query: "saved grace faith", expectedBehavior: "retrieve_then_filter_stale" },
    { id: "works_fruit", category: "ranking", query: "faith works evidence fruit", expectedBehavior: "claim_2_first" },
    { id: "policy_exact", category: "relevance", query: "overnight transportation assignments", expectedBehavior: "claim_3_only" },
    { id: "lament", category: "relevance", query: "biblical lament suffering presence hope", expectedBehavior: "claim_10_only" },
    { id: "trinity_identity", category: "relevance", query: "one three persons father son holy spirit", expectedBehavior: "claim_11_only" },
    { id: "trinity_life", category: "ranking", query: "trinity prayer community witness", expectedBehavior: "claim_12_first" },
    { id: "nonsense", category: "abstention", query: "quantum photosynthesis", expectedBehavior: "abstain" },
    { id: "generic", category: "abstention", query: "what does this mean", expectedBehavior: "abstain" },
    { id: "relevance_over_authority", category: "ranking", query: "faithful action transportation", expectedBehavior: "claim_5_first" },
    { id: "audience_scope", category: "scope", query: "grace works review", audience: "leaders", expectedBehavior: "claim_7_only" },
    { id: "task_scope", category: "scope", query: "grace faith works glossary", taskType: "resource_development", expectedBehavior: "claim_8_only" },
    { id: "unreviewed_gate", category: "approval", query: "unreviewed note works purchase salvation", expectedBehavior: "exclude_claim_9" },
    { id: "cross_tenant_request", category: "tenant", query: "grace faith living works fruit", requestedTenant: "neighbor", expectedBehavior: "deny_cross_tenant" },
    { id: "empty", category: "abstention", query: "", expectedBehavior: "abstain" },
    { id: "numeric_only", category: "abstention", query: "2 8 10 2024", expectedBehavior: "abstain" },
    { id: "stopwords_only", category: "abstention", query: "what does this mean and how", expectedBehavior: "abstain" },
    { id: "known_synonyms", category: "paraphrase", query: "divine favor trust faithful action", expectedBehavior: "claim_5_first" },
    { id: "unseen_paraphrase", category: "lexical_limit", query: "unmerited benevolence reliance conduct", expectedBehavior: "safe_over_abstention" },
    { id: "scripture_reference", category: "scripture", query: "Ephesians 2:8-10", expectedBehavior: "retrieve_claims_1_and_2" },
    { id: "contradiction_prompt", category: "contradiction", query: "works earn salvation purchase acceptance", expectedBehavior: "withhold_claim_14_and_require_review" },
    { id: "negation_prompt", category: "contradiction", query: "works do not earn salvation", expectedBehavior: "withhold_claim_14_and_require_review" },
    { id: "typo_prompt", category: "lexical_limit", query: "grcae faitth wroks", expectedBehavior: "safe_over_abstention" },
    { id: "sql_syntax_text", category: "input_safety", query: "grace | faith & works ! salvation", expectedBehavior: "treat_as_text" },
    { id: "fragment_only_wording", category: "relevance", query: "retired curriculum wording", expectedBehavior: "retrieve_then_filter_stale" }
  ] satisfies MeridianRetrievalCalibrationCase[]
} as const;
