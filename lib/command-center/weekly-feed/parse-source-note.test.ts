import { describe, expect, it } from "vitest";
import { parseSourceNote } from "@/lib/command-center/weekly-feed/parse-source-note";

const validNote = `---
title: How to translate military leadership into civilian executive language
source_type: article
source_name: Hiring Our Heroes
author_or_host: Jane Doe
url: https://example.com/military-to-executive
date_found: 2026-07-01
topic_tags:
  - military_transition
  - leadership
priority: high
status: new
---

## Summary

A practical framework for reframing command experience.

## Key Takeaways

- Translate rank into scope of responsibility.
`;

describe("parseSourceNote", () => {
  it("parses valid frontmatter and body", () => {
    const result = parseSourceNote(validNote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.frontmatter).toEqual({
      title: "How to translate military leadership into civilian executive language",
      sourceType: "article",
      sourceName: "Hiring Our Heroes",
      authorOrHost: "Jane Doe",
      url: "https://example.com/military-to-executive",
      dateFound: "2026-07-01",
      topicTags: ["military_transition", "leadership"],
      priority: "high",
      status: "new"
    });
    expect(result.note.body).toContain("## Summary");
    expect(result.note.body).toContain("Translate rank into scope of responsibility.");
  });

  it("accepts a comma-separated topic_tags string as well as a YAML list", () => {
    const note = validNote.replace("topic_tags:\n  - military_transition\n  - leadership", "topic_tags: military_transition, leadership");
    const result = parseSourceNote(note);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.frontmatter.topicTags).toEqual(["military_transition", "leadership"]);
  });

  it("fails when required fields are missing", () => {
    const note = `---\nsource_type: article\n---\n\nNo title here.`;
    const result = parseSourceNote(note);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("title");
  });

  it("fails when source_type is not one of the allowed values", () => {
    const note = `---\ntitle: Something\nsource_type: blog_post\n---\n\nBody.`;
    const result = parseSourceNote(note);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("source_type");
  });

  it("fails gracefully on a file with no frontmatter at all", () => {
    const result = parseSourceNote("Just a plain text file with no frontmatter.");
    expect(result.ok).toBe(false);
  });

  it("treats an unparseable date_found as absent rather than throwing", () => {
    const note = `---\ntitle: Something\nsource_type: report\ndate_found: not-a-date\n---\n\nBody.`;
    const result = parseSourceNote(note);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.frontmatter.dateFound).toBeUndefined();
  });
});
