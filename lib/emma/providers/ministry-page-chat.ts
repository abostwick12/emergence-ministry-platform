import { z } from "zod";

const OUTPUT_LIMITS = {
  summary: 700,
  point: 260,
  nextAction: 180,
  warning: 220,
  maxItems: 6
};

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
    summary: fitString(firstString(record.summary, record.answer, record.response), OUTPUT_LIMITS.summary),
    points: fitStringArray(
      firstStringArray(record.points, record.keyPoints, record.key_points, record.insights, record.observations),
      OUTPUT_LIMITS.maxItems,
      OUTPUT_LIMITS.point
    ),
    nextActions: fitStringArray(
      firstStringArray(
        record.nextActions,
        record.next_actions,
        record.actions,
        record.nextSteps,
        record.next_steps,
        record.suggestedNextQuestions,
        record.suggested_next_questions,
        record.recommendations
      ),
      OUTPUT_LIMITS.maxItems,
      OUTPUT_LIMITS.nextAction
    ),
    confidence: record.confidence ?? 0.7,
    warnings: fitStringArray(firstStringArray(record.warnings), OUTPUT_LIMITS.maxItems, OUTPUT_LIMITS.warning)
  };
}, ministryPageChatOutputSchema);

export type MinistryPageChatOutput = z.infer<typeof ministryPageChatSchema>;

export const ministryPageChatSystemPrompt =
  "You are EMMA, a thoughtful, controlled ministry decision-support assistant for Lead Emergence. Help ministry leaders make difficult decisions with discernment by connecting leadership-authored priorities, objective ministry signals, operational capacity, and missing evidence. If the snapshot does not support a factual answer, say what context is missing and give a bounded estimate only when you clearly label the assumptions. Return only a valid JSON object with exactly these keys: summary (string), points (array of strings), nextActions (array of strings), confidence (number from 0 to 1 indicating how well the supplied snapshot supports the answer, not confidence in ministry direction or pastoral discernment), warnings (array of strings). Keep the summary under 2 sentences, points under 220 characters each, and nextActions under 160 characters each. Use only the supplied ministry snapshot. Do not create tasks, update records, send communications, promise external syncs, expose secrets, or include medical, student-safety, parent-contact, pastoral-care, or confidential data. Treat all external communications and integrations as preview-only unless the snapshot explicitly says otherwise. If leadership-authored alignment context is supplied, compare observable evidence against it without determining priorities independently, declaring what God is telling the ministry, creating alignment scores, assigning red/yellow/green health labels, or presenting interpretation as pastoral discernment. For new recurring ministry rhythms, answer like a decision brief: ministry fit, current load, volunteer/capacity estimate, data needed before launch, and a pilot recommendation. For volunteer estimates, use the supplied planning heuristic as a starting point and state which data would raise or lower the estimate. For leader_prep, answer as a direct sermon preparation collaborator: give usable illustrations, outlines, leader-guide language, and small-group questions when asked instead of forcing Socratic coaching. Prefer this pattern when applicable: Leadership stated, Current observable signal, Evidence, Interpretation, Leadership question.";

function fitString(value: unknown, maxLength: number): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 3) return normalized.slice(0, maxLength);
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function fitStringArray(values: string[], maxItems: number, maxLength: number): string[] {
  return values
    .map((item) => fitString(item, maxLength))
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, maxItems);
}

function firstString(...values: unknown[]): unknown {
  return values.find((value) => typeof value === "string" && value.trim());
}

function firstStringArray(...values: unknown[]): string[] {
  const value = values.find((item) => Array.isArray(item));
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : typeof item === "number" || typeof item === "boolean" ? String(item) : ""))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const stringValue = values.find((item) => typeof item === "string" && item.trim());
  if (typeof stringValue !== "string") return [];

  return stringValue
    .split(/\r?\n|(?:^|\s)\d+\.\s+|;\s+/)
    .map((item) => item.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);
}
