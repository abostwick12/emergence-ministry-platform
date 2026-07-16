import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const fixtureRoot = join(process.cwd(), "tmp", "apple-notes-brain-compiler-test");
const scriptPath = resolve(process.cwd(), "scripts", "apple-notes-brain-compiler.mjs");

describe("Apple Notes Meridian compiler", () => {
  it("normalizes Apple Notes files with metadata, attachments, scripture, risks, and stable ids", async () => {
    const compiler = await loadCompiler();
    createFixture();

    const first = await compiler.compileAppleNotesBrain({
      sourceDir: fixtureRoot,
      vaultRoot: join(fixtureRoot, "vault"),
      importDate: "2026-07-16",
      previewLimit: 20
    });
    const second = await compiler.compileAppleNotesBrain({
      sourceDir: fixtureRoot,
      vaultRoot: join(fixtureRoot, "vault"),
      importDate: "2026-07-16",
      previewLimit: 20
    });

    expect(first.inventory).toMatchObject({
      notesScanned: 6,
      metadataRows: 6,
      attachments: 1,
      duplicateNotes: 2,
      highRiskNotes: 2,
      mediumRiskNotes: 2,
      lowRiskNotes: 2
    });
    expect(first.inventory.byRiskCategory).toMatchObject({
      emails: 1,
      medical: 1,
      phone_numbers: 1,
      secrets: 1
    });

    const garden = first.manifests.normalizedNotes.find((note: { title: string }) => note.title === "Garden to garden");
    expect(garden).toMatchObject({
      created: "04-03-2025 07:17:32",
      modified: "04-03-2025 08:06:24",
      folder: "",
      reviewStatus: "private_review_candidate"
    });
    expect(garden.scriptureReferences).toEqual(["Genesis 2", "John 20:15"]);
    expect(garden.classification.topics).toEqual(expect.arrayContaining(["Biblical Theology", "Old Testament", "New Testament"]));

    const nested = first.manifests.normalizedNotes.find((note: { title: string }) => note.title === "Biblical Decision-Making Model");
    expect(nested).toMatchObject({
      folder: "Decision Making",
      attachments: expect.arrayContaining(["raw/iCloud Notes/Notes/Decision Making/Biblical Decision-Making Model/sketches/Sketch-1.jpg"])
    });

    expect(first.reviewQueues.quarantined.map((note: { title: string }) => note.title)).toEqual(
      expect.arrayContaining(["Medical Care Notes", "API key scratchpad"])
    );
    expect(first.reviewQueues.duplicates).toHaveLength(2);
    expect(first.generatedVaultPreview.some((artifact: { relativePath: string }) => artifact.relativePath.includes("01 Source Notes/01 Own Voice/Generated/Apple Notes/"))).toBe(true);
    expect(first.internalGroundingPreview.some((artifact: { relativePath: string }) => artifact.relativePath.includes("05 Meridian Grounding/PII-Free/"))).toBe(true);
    expect(first.artifacts.vault.some((artifact: { content: string }) => artifact.content.includes("student_exposure: \"prohibited\""))).toBe(true);
    expect(first.artifacts.meridianGrounding.some((artifact: { kind: string; content: string }) => artifact.kind === "theology-grounding-policy" && artifact.content.includes("must not be exposed directly to students"))).toBe(true);
    expect(first.artifacts.meridianGrounding.some((artifact: { content: string }) => artifact.content.includes("Do not quote or summarize this note directly to students."))).toBe(true);
    expect(second.manifests.normalizedNotes.map((note: { id: string }) => note.id)).toEqual(
      first.manifests.normalizedNotes.map((note: { id: string }) => note.id)
    );
  });

  it("writes a dry-run preview without writing to the vault", async () => {
    createFixture();
    const outPath = join(fixtureRoot, "preview.json");
    const { execFileSync } = await import("node:child_process");

    const output = execFileSync(process.execPath, [
      scriptPath,
      "--source-dir",
      fixtureRoot,
      "--vault",
      join(fixtureRoot, "vault"),
      "--import-date",
      "2026-07-16",
      "--out",
      outPath,
      "--preview-limit",
      "10"
    ], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    const summary = JSON.parse(output);
    const preview = JSON.parse(readFileSync(outPath, "utf8"));
    expect(summary.mode).toBe("dry-run");
    expect(summary.writePlan.writesSupabase).toBe(false);
    expect(preview.generatedVaultPreview.length).toBeGreaterThan(0);
    expect(preview.internalGroundingPreview.length).toBeGreaterThan(0);
    expect(() => readFileSync(join(fixtureRoot, "vault", "99 System", "import-manifests", "apple-notes-2026-07-16.json"))).toThrow();
  });

  it("applies human source-note approvals without marking risky notes as internal grounding candidates", async () => {
    const compiler = await loadCompiler();
    createFixture();

    const baseline = await compiler.compileAppleNotesBrain({
      sourceDir: fixtureRoot,
      vaultRoot: join(fixtureRoot, "vault"),
      importDate: "2026-07-16",
      previewLimit: 20
    });
    const medical = baseline.manifests.normalizedNotes.find((note: { title: string }) => note.title === "Medical Care Notes");
    expect(medical.reviewStatus).toBe("quarantined");

    const reviewed = await compiler.compileAppleNotesBrain({
      sourceDir: fixtureRoot,
      vaultRoot: join(fixtureRoot, "vault"),
      importDate: "2026-07-16",
      previewLimit: 20,
      reviewOverrides: {
        reviewedAt: "2026-07-16",
        decisions: [
          {
            id: medical.id,
            decision: "source_note_approved",
            reason: "fixture review"
          }
        ]
      }
    });
    const reviewedMedical = reviewed.manifests.normalizedNotes.find((note: { id: string }) => note.id === medical.id);

    expect(reviewedMedical).toMatchObject({
      automaticReviewStatus: "quarantined",
      reviewStatus: "source_note_approved",
      reviewDecision: {
        decision: "source_note_approved",
        reason: "fixture review"
      }
    });
    expect(reviewed.inventory.writePlan).toBeUndefined();
    expect(reviewed.writePlan.reviewOverridesApplied).toBe(1);
    expect(reviewed.artifacts.vault.some((artifact: { relativePath: string }) => artifact.relativePath === reviewedMedical.generatedPath)).toBe(true);
    expect(reviewed.manifests.internalGroundingSources.some((source: { sourceNoteId: string }) => source.sourceNoteId === medical.id)).toBe(false);
  });
});

async function loadCompiler() {
  return await import(pathToFileURL(scriptPath).href) as any;
}

function createFixture() {
  rmSync(fixtureRoot, { recursive: true, force: true });
  const notesRoot = join(fixtureRoot, "raw", "iCloud Notes", "Notes");
  mkdirSync(notesRoot, { recursive: true });
  writeFileSync(
    join(fixtureRoot, "raw", "iCloud Notes", "Notes Details.csv"),
    [
      "Title,Created On,Modified On,Pinned,Deleted,Drawing/Handwriting,ContentHash at Import",
      "Garden to garden,04-03-2025 07:17:32,04-03-2025 08:06:24,No,No,No,",
      "Medical Care Notes,01-01-2026 01:00:00,01-01-2026 01:00:00,No,No,No,",
      "Student Questions as Curriculum,05-01-2025 12:00:00,05-01-2025 12:30:00,No,No,No,",
      "Student Questions Copy,05-01-2025 12:00:00,05-01-2025 12:30:00,No,No,No,",
      "Biblical Decision-Making Model,06-05-2025 16:19:38,06-05-2025 16:45:08,No,No,Yes,",
      "API key scratchpad,07-01-2026 06:00:00,07-01-2026 06:00:00,No,No,No,"
    ].join("\n"),
    "utf8"
  );

  writeNote("Garden to garden", "Garden to garden\n\nWhat started in Genesis 2 would end in a garden near John 20:15.");
  writeNote("Medical Care Notes", "Call oncology for Gabriel at 850-225-0637. Email care@example.com about medical labs.");
  writeNote("Student Questions as Curriculum", "Honest student questions can become the starting point for discipleship.");
  writeNote("Student Questions Copy", "Honest student questions can become the starting point for discipleship.");
  writeNestedNote(
    ["Decision Making", "Biblical Decision-Making Model"],
    "Biblical Decision-Making Model",
    "Leadership through intercession leads to wise action. See Proverbs 3:7."
  );
  const sketchDir = join(notesRoot, "Decision Making", "Biblical Decision-Making Model", "sketches");
  mkdirSync(sketchDir, { recursive: true });
  writeFileSync(join(sketchDir, "Sketch-1.jpg"), "fake-image", "utf8");
  writeNote("API key scratchpad", "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
}

function writeNote(title: string, body: string) {
  writeNestedNote([title], title, body);
}

function writeNestedNote(segments: string[], title: string, body: string) {
  const dir = join(fixtureRoot, "raw", "iCloud Notes", "Notes", ...segments);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${title}.txt`), body, "utf8");
}
