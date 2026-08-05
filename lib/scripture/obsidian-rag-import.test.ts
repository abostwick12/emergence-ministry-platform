import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts", "obsidian-rag-import.mjs");
const fixtureRoot = join(process.cwd(), "tmp", "obsidian-rag-import-test");

describe("Obsidian Meridian candidate importer", () => {
  it("builds private discovery-only candidates and never infers approval from visibility", () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    const ownDir = join(fixtureRoot, "01 Source Notes", "01 Own Voice", "Generated");
    const scholarDir = join(fixtureRoot, "01 Source Notes", "02 Scholar Hemisphere", "Generated");
    mkdirSync(ownDir, { recursive: true });
    mkdirSync(scholarDir, { recursive: true });

    writeFileSync(join(ownDir, "safe-question-note.md"), safeOwnVoiceNote(), "utf8");
    writeFileSync(join(ownDir, "safe-question-note-copy.md"), safeOwnVoiceNote(), "utf8");
    writeFileSync(join(ownDir, "private-care-note.md"), privateCareNote(), "utf8");
    writeFileSync(join(ownDir, "internal-grounding-note.md"), internalGroundingNote(), "utf8");
    writeFileSync(join(scholarDir, "scholar-note.md"), scholarNote(), "utf8");

    const outPath = join(fixtureRoot, "preview.json");
    const output = execFileSync(process.execPath, [scriptPath, "--vault", fixtureRoot, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const summary = JSON.parse(output);
    const preview = JSON.parse(readFileSync(outPath, "utf8"));

    expect(summary.counts).toMatchObject({
      scanned: 5,
      optedIn: 3,
      candidates: 1,
      blockedCandidates: 0,
      skipped: 4
    });
    expect(preview.candidates[0]).toMatchObject({
      title: "Student Questions as Curriculum",
      sourceKind: "obsidian_note",
      authorityClass: "none",
      approvalStatus: "unreviewed",
      quotePolicy: "never",
      generationPolicy: "discovery_only",
      externalVisibility: "private",
      permissions: {
        quote: false,
        paraphrase: false,
        cite: false,
        finalAnswer: false,
        externalCommunication: false
      }
    });
    expect(preview.candidates[0].metadata).toMatchObject({
      schemaVersion: "1",
      objectType: "question",
      scriptureReferences: ["Genesis 3", "Romans 8:18"]
    });
    expect(preview.candidates[0].metadata.readiness).toEqual({ status: "ready_for_review", issues: [] });
    expect(preview.candidates[0].rawText).toContain("Honest student questions can become the starting point");
    expect(preview.candidates[0].sourceKey).not.toContain("c:\\\\vault");
    expect(preview.candidates[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.skipped.map((item: { reason: string }) => item.reason)).toEqual(
      expect.arrayContaining(["duplicate_source", "risk_filter:\\bmedical\\b", "visibility:internal_grounding", "visibility:scholar-citation-only"])
    );
  });

  it("blocks malformed curated candidates without copying their raw text into the readiness report", () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    const candidateDir = join(fixtureRoot, "10 Meridian Candidates", "Doctrine");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "ready-doctrine.md"), readyDoctrineNote(), "utf8");
    writeFileSync(join(candidateDir, "blocked-doctrine.md"), blockedDoctrineNote(), "utf8");

    const outPath = join(fixtureRoot, "readiness-preview.json");
    const output = execFileSync(process.execPath, [scriptPath, "--vault", fixtureRoot, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const summary = JSON.parse(output);
    const preview = JSON.parse(readFileSync(outPath, "utf8"));

    expect(summary.counts).toMatchObject({ scanned: 2, optedIn: 2, candidates: 1, blockedCandidates: 1 });
    expect(summary.readiness).toMatchObject({
      status: "blocked",
      objectTypes: { doctrine: 1 },
      blockingIssueCounts: {
        invalid_scripture_locator: 2,
        missing_claim_proposals: 1,
        missing_consensus_status: 1,
        missing_tradition_scope: 1
      }
    });
    expect(preview.candidates[0].metadata).toMatchObject({
      objectType: "doctrine",
      claimProposals: ["God is one divine being eternally existing as Father, Son, and Holy Spirit."],
      scriptureReferences: ["Matthew 28:19"]
    });
    expect(preview.blockedCandidates[0]).toMatchObject({
      title: "Blocked Doctrine Candidate",
      objectType: "doctrine"
    });
    expect(preview.blockedCandidates[0].issues.map((issue: { code: string }) => issue.code)).toEqual(
      expect.arrayContaining(["invalid_scripture_locator", "missing_claim_proposals", "missing_tradition_scope", "missing_consensus_status"])
    );
    expect(preview.blockedCandidates[0]).not.toHaveProperty("rawText");
    expect(JSON.stringify(preview.blockedCandidates)).not.toContain("sensitive draft body");

    const apply = spawnSync(process.execPath, [
      scriptPath,
      "--vault", fixtureRoot,
      "--out", outPath,
      "--apply",
      "--confirm-production-write",
      "--ministry-id", "00000000-0000-0000-0000-000000000001",
      "--created-by-user-id", "00000000-0000-0000-0000-000000000002"
    ], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" } });
    expect(apply.status).not.toBe(0);
    expect(apply.stderr).toContain("Refusing to apply while 1 opted-in candidate(s) fail the Meridian readiness contract.");
  });

  it("blocks untouched templates and accepts all seven object types only after placeholders are filled", () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    const candidateDir = join(fixtureRoot, "10 Meridian Candidates");
    const templateDir = join(process.cwd(), "docs", "templates", "meridian-candidates");
    const templates = [
      "passage.md",
      "doctrine.md",
      "formation.md",
      "question.md",
      "relationship-proposal.md",
      "guardrail-proposal.md",
      "derived-journey.md"
    ];
    mkdirSync(candidateDir, { recursive: true });
    for (const template of templates) {
      writeFileSync(join(candidateDir, template), readFileSync(join(templateDir, template), "utf8"), "utf8");
    }

    const outPath = join(fixtureRoot, "template-preview.json");
    execFileSync(process.execPath, [scriptPath, "--vault", fixtureRoot, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const preview = JSON.parse(readFileSync(outPath, "utf8"));

    expect(preview.counts).toMatchObject({ scanned: 7, optedIn: 7, candidates: 0, blockedCandidates: 7 });
    expect(preview.readiness).toMatchObject({ status: "blocked", objectTypes: {} });
    expect(preview.blockedCandidates.every((candidate: { issues: Array<{ code: string }> }) => candidate.issues.some((issue) => issue.code === "placeholder_value"))).toBe(true);

    for (const template of templates) {
      const raw = readFileSync(join(templateDir, template), "utf8");
      writeFileSync(join(candidateDir, template), fillTemplate(raw, template.replace(".md", "")), "utf8");
    }
    execFileSync(process.execPath, [scriptPath, "--vault", fixtureRoot, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const filledPreview = JSON.parse(readFileSync(outPath, "utf8"));

    expect(filledPreview.counts).toMatchObject({ scanned: 7, optedIn: 7, candidates: 7, blockedCandidates: 0 });
    expect(filledPreview.candidates.every((candidate: { sourceKey: string }) => !candidate.sourceKey.includes(fixtureRoot.toLowerCase()))).toBe(true);
    expect(filledPreview.readiness.objectTypes).toEqual({
      derived_journey: 1,
      doctrine: 1,
      formation: 1,
      guardrail_proposal: 1,
      passage: 1,
      question: 1,
      relationship_proposal: 1
    });
    const relationship = filledPreview.candidates.find((candidate: { metadata: { objectType: string } }) => candidate.metadata.objectType === "relationship_proposal");
    expect(relationship.metadata.relationshipProposal).toMatchObject({ kind: "supports", confidence: 0.8 });
    const derived = filledPreview.candidates.find((candidate: { metadata: { objectType: string } }) => candidate.metadata.objectType === "derived_journey");
    expect(derived.metadata.readiness.issues).toContainEqual(expect.objectContaining({ code: "derived_artifact_never_authority", level: "warning" }));
  });

  it("submits a ready candidate set in one atomic PostgREST request", async () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    const candidateDir = join(fixtureRoot, "10 Meridian Candidates");
    mkdirSync(candidateDir, { recursive: true });
    writeFileSync(join(candidateDir, "question.md"), safeOwnVoiceNote(), "utf8");
    writeFileSync(join(candidateDir, "doctrine.md"), readyDoctrineNote(), "utf8");

    const requests: Array<{ body: string; method?: string; prefer?: string | string[]; url?: string }> = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        requests.push({
          body: Buffer.concat(chunks).toString("utf8"),
          method: request.method,
          prefer: request.headers.prefer,
          url: request.url
        });
        response.statusCode = 204;
        response.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a local TCP address for the importer test server.");

    try {
      const result = await new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
        execFile(
          process.execPath,
          [
            scriptPath,
            "--vault", fixtureRoot,
            "--out", join(fixtureRoot, "apply-preview.json"),
            "--apply",
            "--confirm-production-write",
            "--ministry-id", "00000000-0000-0000-0000-000000000001",
            "--created-by-user-id", "00000000-0000-0000-0000-000000000002"
          ],
          {
            cwd: process.cwd(),
            encoding: "utf8",
            env: {
              ...process.env,
              NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
              SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
            }
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(Object.assign(error, { stderr, stdout }));
              return;
            }
            resolve({ stderr, stdout });
          }
        );
      });
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain('"submittedCandidates": 2');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      url: "/rest/v1/meridian_candidates?on_conflict=ministry_id,content_hash"
    });
    const rows = JSON.parse(requests[0].body);
    expect(rows).toHaveLength(2);
    expect(rows.every((row: Record<string, unknown>) => row.ministry_id === "00000000-0000-0000-0000-000000000001")).toBe(true);
    expect(rows.every((row: Record<string, unknown>) => row.created_by_user_id === "00000000-0000-0000-0000-000000000002")).toBe(true);
  });
});

function fillTemplate(raw: string, label: string) {
  return raw.replace(/Replace with[^"\r\n]*/g, `${label} reviewed value`);
}

function safeOwnVoiceNote() {
  return `---
source_title: "Student Questions as Curriculum"
hemisphere: "Own Voice"
source_category: "Youth Ministry"
source_type: "lesson-study"
visibility: "contest-candidate"
meridian_ingest: "candidate"
meridian_schema: "1"
meridian_object_type: "question"
meridian_summary: "Maps honest student questions into explicit facets for leader review."
question_aliases:
  - "How can student questions shape discipleship?"
question_facets:
  - "student questions"
  - "leader review"
source_path: "C:\\\\vault\\\\safe.docx"
tags:
  - "source-note"
  - "own-voice"
  - "contest-candidate"
---

# Student Questions as Curriculum

## Source Orientation

Own-voice ministry source for extracting Andrew's pedagogy and platform instincts.

## Mind Map Links

- [[Student Questions as Curriculum]]
- [[Leader Review as Pedagogy]]

## Detected Scripture References

- Genesis 3
- Romans 8:18

## Launch Use

Candidate source for contest-safe synthesis after review.

## Own-Voice Signals

- Honest student questions can become the starting point for discipleship instead of a distraction from curriculum.
- Leaders still shape the conversation before anything is shared with the whole group.
`;
}

function readyDoctrineNote() {
  return `---
source_title: "Trinity Doctrine Candidate"
hemisphere: "Own Voice"
source_category: "Theology"
source_type: "reviewed-teaching"
visibility: "contest-candidate"
meridian_ingest: "candidate"
meridian_schema: "1"
meridian_object_type: "doctrine"
meridian_summary: "A candidate definition of the Trinity that preserves Christian monotheism."
primary_passages:
  - "Matthew 28:19"
claim_proposals:
  - "God is one divine being eternally existing as Father, Son, and Holy Spirit."
tradition_scope: "historic Nicene Christianity"
consensus_status: "adopted doctrine candidate"
---

# Trinity Doctrine Candidate

## Source Orientation

Prepared for atomic claim review, not automatic approval.
`;
}

function blockedDoctrineNote() {
  return `---
source_title: "Blocked Doctrine Candidate"
hemisphere: "Own Voice"
source_category: "Theology"
source_type: "draft"
visibility: "contest-candidate"
meridian_ingest: "candidate"
meridian_schema: "1"
meridian_object_type: "doctrine"
meridian_summary: "This note intentionally fails the readiness contract."
primary_passages:
  - "NotABibleBook 99:4"
  - "XYZ.1.1"
---

# Blocked Doctrine Candidate

sensitive draft body that must not be copied into the blocked-candidate report
`;
}

function privateCareNote() {
  return `---
source_title: "Medical Care Notes"
hemisphere: "Own Voice"
source_category: "Pastoral Care"
source_type: "care-note"
visibility: "contest-candidate"
meridian_ingest: "candidate"
source_path: "C:\\\\vault\\\\medical.docx"
---

# Medical Care Notes

## Source Orientation

Private medical and care details.

## Own-Voice Signals

- This should never be public.
`;
}

function internalGroundingNote() {
  return `---
source_title: "Internal Grounding Signals"
hemisphere: "Own Voice"
source_category: "Youth Ministry"
source_type: "apple_note_internal_grounding_candidate"
visibility: "internal_grounding"
student_exposure: "prohibited"
---

# Internal Grounding Signals

## Grounding Signals

- Shape questions with local ministry voice.
- Do not quote Meridian Left Hemisphere material to students.
`;
}

function scholarNote() {
  return `---
source_title: "Scholar Article"
hemisphere: "Scholar Hemisphere"
source_category: "Biblical Studies"
source_type: "scholar-reference"
visibility: "scholar-citation-only"
source_path: "C:\\\\vault\\\\scholar.pdf"
---

# Scholar Article

## Source Orientation

Scholar source for citation-aware synthesis.
`;
}
