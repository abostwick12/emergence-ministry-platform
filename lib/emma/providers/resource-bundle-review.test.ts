import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { runResourceBundleEmmaReview } from "@/lib/emma/providers/resource-bundle-review";
import { __resetEmmaMockStoreForTests, getEmmaAuditTrail } from "@/lib/emma/repository";

const session: AuthSession = {
  user: { id: "323e4567-e89b-42d3-a456-426614174000", email: "leader@example.test", fullName: "Leader", role: "leader" },
  accessToken: "mock-token",
  isMock: true
};

beforeEach(() => {
  __resetEmmaMockStoreForTests();
});

describe("EMMA resource bundle review provider", () => {
  it("returns contract 1.0 through the audited provider pipeline without storing draft text in the manifest", async () => {
    const result = await runResourceBundleEmmaReview(session, reviewInput());
    expect(result).toMatchObject({
      ok: true,
      provider: "mock",
      model: "mock-emma-model",
      review: { contractVersion: "1.0", outcome: "ready_for_human_review", findings: [] }
    });
    if (!result.ok) throw new Error("expected a successful mock review");
    const audit = await getEmmaAuditTrail(session, result.requestId);
    expect(audit.request).toMatchObject({ source: "platform_mcp", workflow: "REVIEW_RESOURCE_BUNDLE", sourceRecordId: reviewInput().bundleId });
    expect(audit.runs[0]).toMatchObject({ skillKey: "resource_bundle_review_v1", outputSchemaVersion: "1.0" });
    expect(audit.runs[0].contextManifest).toEqual({
      entries: [{
        recordId: reviewInput().bundleId,
        recordType: "meridian_mcp_resource_bundle",
        category: "resource_bundle",
        sourceTable: "meridian_mcp_resource_bundles"
      }]
    });
    expect(JSON.stringify(audit)).not.toContain("Grace forms faithful action");
  });

  it("fails closed and records a failed run when structured output is invalid", async () => {
    process.env.EMMA_DEFAULT_MODEL = "mock-invalid-output";
    try {
      const result = await runResourceBundleEmmaReview(session, reviewInput());
      expect(result).toMatchObject({ ok: false, failureCode: "PROVIDER_ERROR" });
      const audit = await getEmmaAuditTrail(session, result.requestId);
      expect(audit.runs[0].status).toBe("failed");
      expect(audit.providerAttempts[0]).toMatchObject({ status: "failure", errorCode: "invalid_output" });
    } finally {
      delete process.env.EMMA_DEFAULT_MODEL;
    }
  });
});

function reviewInput() {
  return {
    reviewId: "423e4567-e89b-42d3-a456-426614174000",
    bundleId: "523e4567-e89b-42d3-a456-426614174000",
    title: "Sunday resource set",
    destination: {
      type: "weekly_leader_prep" as const,
      id: "current-week",
      title: "Current weekly leader preparation",
      description: "Shared leader preparation.",
      audience: "student ministry leaders",
      startsAt: null
    },
    privateDiscoveryStatus: "passed" as const,
    items: [{
      id: "623e4567-e89b-42d3-a456-426614174000",
      kind: "leader_guide",
      title: "Leader guide",
      bodyMarkdown: "# Guide\n\nGrace forms faithful action in community.",
      evidence: [{
        id: "723e4567-e89b-42d3-a456-426614174000",
        title: "Approved claim",
        text: "Approved claim: Grace forms faithful action in community.",
        authorityClass: "approved_teaching",
        quotePermission: "not_allowed" as const,
        fragmentIds: ["823e4567-e89b-42d3-a456-426614174000"]
      }]
    }]
  };
}
