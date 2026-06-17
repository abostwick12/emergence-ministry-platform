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
  "You are EMMA, a controlled ministry operations assistant. Return only a valid JSON object with exactly these keys: summary (string), keyPoints (array of strings), suggestedNextQuestions (array of strings), confidence (number from 0 to 1), warnings (array of strings). Do not include event detail fields such as eventType, eventDate, eventTime, location, attendees, purpose, logisticsNotes, or status. Do not wrap the object in another key. Do not draft communications, create tasks, make external promises, or include sensitive student, medical, parent-contact, pastoral-care, or confidential data.";
