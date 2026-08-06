import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildPrivateDiscoveryIndex,
  getPrivateDiscoveryNote,
  preparePrivateDiscoveryCheck,
  searchPrivateDiscovery
} from "../../../scripts/obsidian-private-discovery-mcp.mjs";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("local Obsidian private discovery connector", () => {
  it("indexes only opted-in folders and excludes sensitive or explicitly denied notes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lead-emergence-private-discovery-"));
    temporary.push(root);
    await writeFile(path.join(root, "formation.md"), `---
title: Formation rhythm
tags: [formation, leaders]
---
# Formation rhythm

Practice faithful presence in community.
`);
    await writeFile(path.join(root, "denied.md"), `---
lead_emergence_discovery: false
---
This note must remain outside discovery.
`);
    await mkdir(path.join(root, "Pastoral"), { recursive: true });
    await writeFile(path.join(root, "Pastoral", "care.md"), "# Care\n\nA person-specific care note.");

    const notes = await buildPrivateDiscoveryIndex([root]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      title: "Formation rhythm",
      relativePath: "formation.md",
      tags: ["formation", "leaders"],
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/)
    });
    expect(JSON.stringify(notes)).not.toContain("person-specific care note");
  });

  it("can require explicit frontmatter opt-in even inside a selected folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lead-emergence-private-discovery-"));
    temporary.push(root);
    await writeFile(path.join(root, "included.md"), "---\nlead_emergence_discovery: true\n---\n# Included\n\nFormation.");
    await writeFile(path.join(root, "missing.md"), "# Missing\n\nNot explicitly opted in.");
    const notes = await buildPrivateDiscoveryIndex([root], { requireFrontmatter: true });
    expect(notes.map((note) => note.title)).toEqual(["Included"]);
  });

  it("returns opaque references and prepares the exact transient leakage payload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lead-emergence-private-discovery-"));
    temporary.push(root);
    await writeFile(path.join(root, "note.md"), "# Grace and formation\n\nGrace forms faithful action in community.");
    const notes = await buildPrivateDiscoveryIndex([root]);
    const results = searchPrivateDiscovery(notes, "grace formation");
    expect(results[0].id).toMatch(/^note:[0-9a-f]{32}$/);
    const note = getPrivateDiscoveryNote(notes, results[0].id);
    expect(note).toMatchObject({ authority: "none", quotePermission: "never", storage: "local_only" });
    const prepared = preparePrivateDiscoveryCheck(notes, [note.id]);
    expect(prepared.privateDiscovery).toEqual([{
      sourceReference: note.id,
      contentHash: note.contentHash,
      rawText: note.rawText
    }]);
  });
});
