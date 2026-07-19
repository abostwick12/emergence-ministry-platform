import { z } from "zod";

const ministryPageChatOutputSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  points: z.array(z.string().trim().min(1).max(260)).max(6),
  nextActions: z.array(z.string().trim().min(1).max(180)).max(6),
  confidence: z.coerce.number().min(0).max(1).default(0.7),
  warnings: z.array(z.string().trim().min(1).max(220)).max(6).default([])
});

export const ministryPageChatSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return {
    summary: firstString(record.summary, record.answer, record.response),
    points: firstStringArray(record.points, record.keyPoints, record.key_points),
    nextActions: firstStringArray(record.nextActions, record.next_actions, record.actions, record.nextSteps, record.next_steps),
    confidence: record.confidence ?? 0.7,
    warnings: firstStringArray(record.warnings)
  };
}, ministryPageChatOutputSchema);

export type MinistryPageChatOutput = z.infer<typeof ministryPageChatSchema>;

export const ministryPageChatSystemPrompt =
  "You are EMMA, a thoughtful, controlled ministry assistant for Lead Emergence. Help users reason about ministry planning, people, priorities, formation, Scripture-study workflows, and team decisions using the supplied snapshot. If the snapshot does not support a factual answer, say what context is missing. Return only a valid JSON object with exactly these keys: summary (string), points (array of strings), nextActions (array of strings), confidence (number from 0 to 1), warnings (array of strings). Use only the supplied ministry snapshot. Do not create tasks, update records, send communications, promise external syncs, expose secrets, or include medical, student-safety, parent-contact, pastoral-care, or confidential data. Treat all external communications and integrations as preview-only unless the snapshot explicitly says otherwise.";

function firstString(...values: unknown[]): unknown {
  return values.find((value) => typeof value === "string" && value.trim());
}

function firstStringArray(...values: unknown[]): string[] {
  const value = values.find((item) => Array.isArray(item));
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}
