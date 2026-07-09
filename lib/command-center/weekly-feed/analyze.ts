// Turns each newly-ingested source note into a structured
// personal_knowledge_items row via one SAGE call per source. Deliberately
// one call per (small) note rather than one call over everything, so a bad
// extraction on one source never affects the others and cost stays
// proportional to how much Andrew actually saved this week.

import { z } from "zod";
import type { AuthSession } from "@/lib/auth/server";
import { callSageStructured } from "@/lib/command-center/sage";
import { createKnowledgeItem } from "@/lib/command-center/repository";
import type { ChangedSource } from "@/lib/command-center/weekly-feed/ingest";
import type { KnowledgeItem } from "@/lib/command-center/types";

const ANALYSIS_INSTRUCTIONS = `You are SAGE, analyzing one saved research note for Andrew's Personal Command Center Weekly Intelligence Feed.

Andrew's priorities, in rough order: youth ministry leadership, student discipleship, student mental health and pastoral boundaries, AI ministry operations, student career readiness, volunteer development, communication systems, student leadership, theological/exegetical insight, Emerge platform development.

Given one source note (its declared metadata and body), extract a structured analysis. Respond with ONLY a single valid JSON object -- no markdown fences, no commentary -- matching this shape exactly:
{
  "summary": string,
  "keyTakeaways": string,
  "topicTags": string[],
  "relevanceScore": number between 0 and 10 (how relevant this is to Andrew's priorities above),
  "ministryApplication": string,
  "commandCenterApplication": string,
  "theologicalOrDiscipleshipConnection": string,
  "careerReadinessConnection": string,
  "caveats": string (weak claims, missing context, or reasons to be skeptical -- empty string if none)
}

Distinguish clearly in your fields between what the source itself said and what you are inferring or applying -- never present your own inference as something the source stated.`;

const knowledgeItemSchema = z.object({
  summary: z.string(),
  keyTakeaways: z.string().default(""),
  topicTags: z.array(z.string()).default([]),
  relevanceScore: z.number().min(0).max(10),
  ministryApplication: z.string().default(""),
  commandCenterApplication: z.string().default(""),
  theologicalOrDiscipleshipConnection: z.string().default(""),
  careerReadinessConnection: z.string().default(""),
  caveats: z.string().default("")
});

function buildSourceInput(changed: ChangedSource): string {
  const { source, body } = changed;
  return [
    `title: ${source.title}`,
    `source_type: ${source.sourceType}`,
    source.sourceName ? `source_name: ${source.sourceName}` : null,
    source.authorOrHost ? `author_or_host: ${source.authorOrHost}` : null,
    source.url ? `url: ${source.url}` : null,
    "",
    body
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export type AnalyzeResult = {
  items: KnowledgeItem[];
  failures: string[];
};

export async function analyzeSources(session: AuthSession, changedSources: ChangedSource[]): Promise<AnalyzeResult> {
  const items: KnowledgeItem[] = [];
  const failures: string[] = [];

  for (const changed of changedSources) {
    const result = await callSageStructured({
      instructions: ANALYSIS_INSTRUCTIONS,
      input: buildSourceInput(changed),
      schema: knowledgeItemSchema
    });

    if (!result.ok) {
      failures.push(`Could not analyze "${changed.source.title}": ${result.message}`);
      continue;
    }

    const item = await createKnowledgeItem(session, {
      sourceId: changed.source.id,
      summary: result.data.summary,
      keyTakeaways: result.data.keyTakeaways || undefined,
      topicTags: result.data.topicTags,
      relevanceScore: result.data.relevanceScore,
      ministryApplication: result.data.ministryApplication || undefined,
      commandCenterApplication: result.data.commandCenterApplication || undefined,
      theologicalOrDiscipleshipConnection: result.data.theologicalOrDiscipleshipConnection || undefined,
      careerReadinessConnection: result.data.careerReadinessConnection || undefined,
      caveats: result.data.caveats || undefined
    });
    items.push(item);
  }

  return { items, failures };
}
