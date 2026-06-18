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
    const safeEvent = contextManifest.safeEventContext
      ? [
          "Safe event planning context:",
          `- title: ${contextManifest.safeEventContext.title}`,
          `- type: ${contextManifest.safeEventContext.eventType}`,
          `- startTime: ${contextManifest.safeEventContext.startTime}`,
          `- endTime: ${contextManifest.safeEventContext.endTime}`,
          `- location: ${contextManifest.safeEventContext.location ?? "not set"}`,
          `- targetGroup: ${contextManifest.safeEventContext.targetGroup ?? "not set"}`,
          `- ownerId: ${contextManifest.safeEventContext.ownerId ?? "not set"}`,
          `- status: ${contextManifest.safeEventContext.status}`,
          `- priority: ${contextManifest.safeEventContext.priority ?? "not set"}`,
          `- volunteersNeeded: ${contextManifest.safeEventContext.volunteersNeeded ?? "not set"}`,
          `- description: ${contextManifest.safeEventContext.description ?? "not set"}`,
          `- missingInformation: ${
            contextManifest.safeEventContext.missingInformation.length
              ? contextManifest.safeEventContext.missingInformation.join("; ")
              : "none"
          }`
        ].join("\n")
      : "Safe event planning context: none supplied";

    return [
      "Summarize the safe internal planning context for this EMMA request.",
      `Request id: ${request.id}`,
      `Request workflow: ${request.workflow}`,
      "Context manifest identifiers:",
      contextSummary,
      safeEvent,
      "Return only the structured JSON object required by the system prompt.",
      "Do not draft communications, create tasks, propose actions, or include sensitive personal details."
    ].join("\n");
  }
};
