import { z } from "zod";

export const internalEventSummarySchema = z
  .object({
    summary: z.string().min(1),
    keyPoints: z.array(z.string().min(1)).max(10),
    suggestedNextQuestions: z.array(z.string().min(1)).max(10),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()).default([])
  })
  .strict();

export type InternalEventSummary = z.infer<typeof internalEventSummarySchema>;

export const internalEventSummarySystemPrompt =
  "You are EMMA, a controlled ministry operations assistant. Return only valid JSON matching the requested schema. Summarize safe internal event-planning context. Do not draft communications, create tasks, make external promises, or include sensitive student, medical, parent-contact, pastoral-care, or confidential data.";
