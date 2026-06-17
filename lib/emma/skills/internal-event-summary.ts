import {
  internalEventSummarySchema,
  internalEventSummarySystemPrompt,
  type InternalEventSummary
} from "@/lib/emma/providers/internal-event-summary";
import type { EmmaSkillDefinition } from "@/lib/emma/skills/types";

export const internalEventSummarySkill: EmmaSkillDefinition<InternalEventSummary> = {
  key: "internal_event_summary",
  workflow: "GENERATE_MINISTRY_SUMMARY",
  displayName: "Internal Event Summary",
  riskLevel: "low",
  actionType: "none",
  requiresApproval: false,
  allowedRoles: ["admin", "leader"],
  allowedContextCategories: ["event", "task", "activity_log", "budget"],
  inputSchemaVersion: "1",
  outputSchemaVersion: "1",
  featureKey: "internal_event_summary",
  systemPrompt: internalEventSummarySystemPrompt,
  outputSchema: internalEventSummarySchema,
  buildUserPrompt({ request, contextManifest }) {
    const contextLines = contextManifest.entries.map(
      (entry) => `- ${entry.category}:${entry.recordType}:${entry.recordId}`
    );
    const contextSummary = contextLines.length ? contextLines.join("\n") : "- no context records supplied";

    return [
      "Summarize the safe internal planning context for this EMMA request.",
      `Request id: ${request.id}`,
      `Request workflow: ${request.workflow}`,
      "Context manifest records only safe identifiers, not record contents:",
      contextSummary,
      "Return only the structured JSON object required by the system prompt.",
      "Do not draft communications, create tasks, propose actions, or include sensitive personal details."
    ].join("\n");
  }
};
