// Parses a SAGE Feed Sources note (markdown or exported Google Doc text)
// into its YAML frontmatter and body, per the template in
// docs/architecture/command-center-integrations.md's weekly feed spec:
//
// ---
// title:
// source_type: article | podcast | video | linkedin | report
// source_name:
// author_or_host:
// url:
// date_found:
// topic_tags:
// priority: low | medium | high
// status: new
// ---
//
// ## Summary
// ...
//
// Never throws for malformed input -- returns a discriminated result so a
// single bad file can be skipped without failing the whole ingestion run
// (see lib/command-center/weekly-feed/ingest.ts).

import matter from "gray-matter";
import { z } from "zod";
import type { KnowledgeSourceType } from "@/lib/command-center/types";

const SOURCE_TYPES: [KnowledgeSourceType, ...KnowledgeSourceType[]] = ["article", "podcast", "video", "linkedin", "report"];

const frontmatterSchema = z.object({
  title: z.string().min(1),
  source_type: z.enum(SOURCE_TYPES),
  source_name: z.string().optional(),
  author_or_host: z.string().optional(),
  url: z.string().optional(),
  date_found: z.union([z.string(), z.date()]).optional(),
  topic_tags: z.union([z.array(z.string()), z.string()]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.string().optional()
});

export type SourceNoteFrontmatter = {
  title: string;
  sourceType: KnowledgeSourceType;
  sourceName?: string;
  authorOrHost?: string;
  url?: string;
  dateFound?: string;
  topicTags: string[];
  priority?: "low" | "medium" | "high";
  status?: string;
};

export type ParsedSourceNote = {
  frontmatter: SourceNoteFrontmatter;
  body: string;
};

export type ParseSourceNoteResult = { ok: true; note: ParsedSourceNote } | { ok: false; error: string };

function normalizeDate(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function normalizeTags(value: string[] | string | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((tag) => tag.trim()).filter(Boolean);
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseSourceNote(raw: string): ParseSourceNoteResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    return { ok: false, error: "Could not parse YAML frontmatter." };
  }

  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    const missingOrInvalid = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    return { ok: false, error: `Frontmatter missing or invalid fields: ${missingOrInvalid}` };
  }

  const data = result.data;
  return {
    ok: true,
    note: {
      frontmatter: {
        title: data.title,
        sourceType: data.source_type,
        sourceName: data.source_name,
        authorOrHost: data.author_or_host,
        url: data.url,
        dateFound: normalizeDate(data.date_found),
        topicTags: normalizeTags(data.topic_tags),
        priority: data.priority,
        status: data.status
      },
      body: parsed.content.trim()
    }
  };
}
