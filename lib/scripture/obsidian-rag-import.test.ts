import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts", "obsidian-rag-import.mjs");
const fixtureRoot = join(process.cwd(), "tmp", "obsidian-rag-import-test");

describe("Obsidian RAG launch importer", () => {
  it("builds a dry-run launch pack from safe own-voice source notes only", () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    const ownDir = join(fixtureRoot, "01 Source Notes", "01 Own Voice", "Generated");
    const scholarDir = join(fixtureRoot, "01 Source Notes", "02 Scholar Hemisphere", "Generated");
    mkdirSync(ownDir, { recursive: true });
    mkdirSync(scholarDir, { recursive: true });

    writeFileSync(join(ownDir, "safe-question-note.md"), safeOwnVoiceNote(), "utf8");
    writeFileSync(join(ownDir, "safe-question-note-copy.md"), safeOwnVoiceNote(), "utf8");
    writeFileSync(join(ownDir, "private-care-note.md"), privateCareNote(), "utf8");
    writeFileSync(join(scholarDir, "scholar-note.md"), scholarNote(), "utf8");

    const outPath = join(fixtureRoot, "preview.json");
    const output = execFileSync(process.execPath, [scriptPath, "--vault", fixtureRoot, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const summary = JSON.parse(output);
    const preview = JSON.parse(readFileSync(outPath, "utf8"));

    expect(summary.counts).toMatchObject({
      scanned: 4,
      sources: 1,
      chunks: 1,
      skipped: 3
    });
    expect(preview.sources[0]).toMatchObject({
      title: "Student Questions as Curriculum",
      sourceKind: "own_voice",
      hemisphere: "own_voice",
      visibility: "student_visible"
    });
    expect(preview.sources[0].chunks[0]).toMatchObject({
      visibility: "student_visible",
      scriptureReferences: ["Genesis 3", "Romans 8:18"]
    });
    expect(preview.sources[0].chunks[0].body).toContain("Honest student questions can become the starting point");
    expect(preview.skipped.map((item: { reason: string }) => item.reason)).toEqual(
      expect.arrayContaining(["duplicate_source", "risk_filter:\\bmedical\\b", "visibility:scholar-citation-only"])
    );
  });
});

function safeOwnVoiceNote() {
  return `---
source_title: "Student Questions as Curriculum"
hemisphere: "Own Voice"
source_category: "Youth Ministry"
source_type: "lesson-study"
visibility: "contest-candidate"
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

function privateCareNote() {
  return `---
source_title: "Medical Care Notes"
hemisphere: "Own Voice"
source_category: "Pastoral Care"
source_type: "care-note"
visibility: "contest-candidate"
source_path: "C:\\\\vault\\\\medical.docx"
---

# Medical Care Notes

## Source Orientation

Private medical and care details.

## Own-Voice Signals

- This should never be public.
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
