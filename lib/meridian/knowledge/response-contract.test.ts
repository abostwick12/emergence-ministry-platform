import { describe, expect, it } from "vitest";

import { validateMeridianResponseContract } from "@/lib/meridian/knowledge/response-contract";
import type { MeridianAnswerContract, MeridianEvidencePack } from "@/lib/meridian/knowledge/types";

describe("Meridian response contract", () => {
  it("blocks prohibited diagnosis and motive inference", () => {
    const response = contract({ interpretation: ["This leader has clinical depression and their true motive is control."] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "prohibited_inference" });
  });

  it("requires recommendations to carry primitive citations", () => {
    const response = contract({ recommendations: ["Invite a leader to review the plan."], citations: [] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "uncited_recommendation" });
  });

  it("rejects Scripture that lacks YouVersion provenance", () => {
    const response = contract({ scripture: [{ reference: "John 3:16", translation: "NIV", text: "Synthetic", fragmentId: "unknown" }] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "scripture_provenance" });
  });
});

function contract(overrides: Partial<MeridianAnswerContract> = {}): MeridianAnswerContract {
  return {
    observations: ["The approved policy calls for leader review."],
    scripture: [],
    interpretation: [],
    recommendations: [],
    uncertainty: [],
    questionsForLeader: [],
    citations: [{ claimId: "claim-1", fragmentIds: ["fragment-1"] }],
    requiresHumanReview: false,
    ...overrides
  };
}

function pack(): MeridianEvidencePack {
  return {
    task: { ministryId: "ministry-a", audience: "leaders", taskType: "brief", sensitivity: "internal", at: new Date().toISOString(), externalCommunication: false },
    sources: [],
    approvedClaims: [],
    supportingFragments: [],
    scriptureFragments: [],
    issues: [],
    excludedClaimIds: [],
    requiresReview: false,
    abstain: false
  };
}
