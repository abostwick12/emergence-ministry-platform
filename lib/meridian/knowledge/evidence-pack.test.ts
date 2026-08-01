import { describe, expect, it } from "vitest";

import { buildMeridianEvidencePack, formatApprovedEvidencePackForGeneration } from "@/lib/meridian/knowledge/evidence-pack";
import { obsidianCandidateDefaults } from "@/lib/meridian/knowledge/policy";
import type { MeridianClaim, MeridianFragment, MeridianRelationship, MeridianSource, MeridianTaskContext } from "@/lib/meridian/knowledge/types";

const task: MeridianTaskContext = {
  ministryId: "ministry-a",
  audience: "leaders",
  taskType: "strategy_brief",
  sensitivity: "internal",
  at: "2026-08-01T12:00:00.000Z",
  externalCommunication: false
};

describe("Meridian governed evidence packs", () => {
  it("ranks approved atomic claims by the explicit authority hierarchy", () => {
    const doctrine = claim("doctrine", "adopted_doctrine", "fragment-doctrine");
    const sermon = claim("sermon", "approved_teaching", "fragment-sermon");
    const scholarship = claim("scholar", "attributed_scholarship", "fragment-scholar", { attribution: "Dr. Example" });
    const pack = buildMeridianEvidencePack({
      task,
      claims: [scholarship, sermon, doctrine],
      fragments: [fragment("fragment-doctrine"), fragment("fragment-sermon"), fragment("fragment-scholar")],
      relationships: []
    });

    expect(pack.approvedClaims.map((item) => item.id)).toEqual(["doctrine", "sermon", "scholar"]);
  });

  it("excludes unapproved, stale, out-of-scope, discovery-only, and person-specific evidence", () => {
    const unreviewed = claim("unreviewed", "approved_teaching", "fragment-a", { approvalStatus: "unreviewed" });
    const stale = claim("stale", "current_strategy", "fragment-b", { scope: { validUntil: "2026-01-01T00:00:00.000Z" } });
    const wrongTenant = claim("wrong-tenant", "approved_policy", "fragment-c", { ministryId: "ministry-b" });
    const privateClaim = claim("private", "operational_evidence", "fragment-private");
    const pack = buildMeridianEvidencePack({
      task,
      claims: [unreviewed, stale, wrongTenant, privateClaim],
      fragments: [
        fragment("fragment-a"),
        fragment("fragment-b"),
        fragment("fragment-c", { ministryId: "ministry-b" }),
        fragment("fragment-private", { sensitivity: "person_specific", generationPolicy: "discovery_only" })
      ],
      relationships: []
    });

    expect(pack.approvedClaims).toEqual([]);
    expect(pack.abstain).toBe(true);
    expect(pack.issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining(["permission", "out_of_scope", "missing_support"]));
  });

  it("excludes superseded strategy and requires review for unresolved contradictions", () => {
    const current = claim("current", "current_strategy", "fragment-current");
    const old = claim("old", "current_strategy", "fragment-old");
    const peer = claim("peer", "current_strategy", "fragment-peer");
    const relationships: MeridianRelationship[] = [
      relationship("supersedes", "current", "old"),
      relationship("contradicts", "current", "peer")
    ];
    const pack = buildMeridianEvidencePack({
      task,
      claims: [old, current, peer],
      fragments: [fragment("fragment-old"), fragment("fragment-current"), fragment("fragment-peer")],
      relationships
    });

    expect(pack.excludedClaimIds).toContain("old");
    expect(pack.abstain).toBe(true);
    expect(pack.abstentionReason).toContain("Conflicting approved evidence");
  });

  it("serializes only approved-generation fragments and keeps YouVersion Scripture structurally separate", () => {
    const scripture = fragment("scripture-fragment", {
      exactText: "Synthetic test passage text.",
      scripture: {
        provider: "YouVersion",
        passageId: "JHN.3.16",
        reference: "John 3:16",
        translationId: "3034",
        translationName: "NIV",
        retrievedAt: task.at
      }
    });
    const pack = buildMeridianEvidencePack({
      task,
      claims: [claim("scripture-claim", "canonical_scripture", "scripture-fragment")],
      fragments: [scripture],
      relationships: []
    });
    const serialized = JSON.parse(formatApprovedEvidencePackForGeneration(pack));

    expect(serialized.fragments).toEqual([]);
    expect(serialized.scripture[0]).toMatchObject({
      fragmentId: "scripture-fragment",
      provenance: { provider: "YouVersion", passageId: "JHN.3.16", translationName: "NIV" }
    });
  });

  it("assigns every Obsidian candidate a deny-by-default capability matrix", () => {
    expect(obsidianCandidateDefaults()).toEqual({
      kind: "obsidian_note",
      corpusFamily: "private_discovery",
      authorityClass: "none",
      approvalStatus: "unreviewed",
      externalVisibility: "private",
      quotePolicy: "never",
      generationPolicy: "discovery_only",
      sensitivity: "internal",
      originMode: "candidate",
      permissions: { quote: false, paraphrase: false, cite: false, finalAnswer: false, externalCommunication: false }
    });
  });

  it("uses task relevance and authored subtype priority without crossing authority levels", () => {
    const academic = claim("academic", "approved_teaching", "fragment-academic", { proposition: "Grace is God's gift received through faith." });
    const curriculum = claim("curriculum", "approved_teaching", "fragment-curriculum", { proposition: "Grace forms a life of faithful action." });
    const doctrine = claim("doctrine-first", "adopted_doctrine", "fragment-doctrine-first", { proposition: "The church receives salvation as God's grace." });
    const pack = buildMeridianEvidencePack({
      task: { ...task, query: "grace faith works", scriptureReferences: ["Ephesians 2:8-10"] },
      claims: [curriculum, academic, doctrine],
      fragments: [fragment("fragment-academic"), fragment("fragment-curriculum"), fragment("fragment-doctrine-first")],
      sources: [
        authoredSource("source-fragment-academic", "academic_paper", "Grace and Faith"),
        authoredSource("source-fragment-curriculum", "curriculum_material", "Grace and Faith Curriculum"),
        { ...authoredSource("source-fragment-doctrine-first", "academic_paper", "Adopted Doctrine"), corpusFamily: "approved_church", authorityClass: "adopted_doctrine" }
      ],
      relationships: []
    });

    expect(pack.approvedClaims.map((item) => item.id)).toEqual(["doctrine-first", "academic", "curriculum"]);
    expect(pack.sources.map((source) => source.kind)).toEqual(expect.arrayContaining(["academic_paper", "curriculum_material"]));
  });
});

function authoredSource(id: string, kind: "academic_paper" | "curriculum_material" | "sermon", title: string): MeridianSource {
  return {
    id,
    ministryId: "ministry-a",
    kind,
    corpusFamily: "andrew_authored_ministry",
    title,
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    externalVisibility: "ministry",
    quotePolicy: "review_required",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    originMode: "direct",
    attribution: "Andrew",
    approvedByUserId: "admin-a",
    approvedAt: task.at
  };
}

function claim(
  id: string,
  authorityClass: MeridianClaim["authorityClass"],
  fragmentId: string,
  overrides: Partial<MeridianClaim> = {}
): MeridianClaim {
  return {
    id,
    ministryId: "ministry-a",
    proposition: `Atomic proposition ${id}`,
    kind: authorityClass === "attributed_scholarship" ? "scholarly_perspective" : "strategy_priority",
    authorityClass,
    approvalStatus: "approved",
    confidence: 0.9,
    scope: {},
    supportingFragmentIds: [fragmentId],
    derivedArtifact: false,
    ...overrides
  };
}

function fragment(id: string, overrides: Partial<MeridianFragment> = {}): MeridianFragment {
  return {
    id,
    ministryId: "ministry-a",
    sourceId: `source-${id}`,
    locator: { kind: "section", value: "Synthetic fixture" },
    contentHash: "a".repeat(64),
    exactText: `Synthetic approved support for ${id}.`,
    provenance: { fixture: true },
    permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "never",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true,
    ...overrides
  };
}

function relationship(kind: MeridianRelationship["kind"], fromId: string, toId: string): MeridianRelationship {
  return {
    id: `${kind}-${fromId}-${toId}`,
    ministryId: "ministry-a",
    kind,
    fromType: "claim",
    fromId,
    toType: "claim",
    toId
  };
}
