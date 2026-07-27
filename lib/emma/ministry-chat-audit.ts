export type EmmaChatAuditPayload = {
  providerMode: "live_provider" | "audited_fallback" | "guest_simulation";
  provider: string;
  proposalCreated: boolean;
  warnings?: string[];
};

export function buildMinistryChatAudit(payload: EmmaChatAuditPayload): string {
  const proposal = payload.proposalCreated ? " Recommendation saved for review." : "";

  if (payload.providerMode === "guest_simulation") {
    return `Guest simulation response. No AI provider, workflow trigger, or database write ran.${proposal}`;
  }

  if (payload.providerMode === "live_provider") {
    const recoveredByFailover = payload.warnings?.some((warning) => /failover returned a valid response/i.test(warning));
    return `AI response ready through ${providerDisplayName(payload.provider)}. ${
      recoveredByFailover ? "Primary provider recovered through safe failover. " : ""
    }Audit trail saved; no actions executed.${proposal}`;
  }

  const auditUnavailable = payload.warnings?.some((warning) => /audit persistence was unavailable/i.test(warning));
  return `${auditUnavailable ? "Guided fallback shown; audit storage was unavailable. " : "Guided fallback shown. Audit trail saved; "}No actions executed.${proposal}`;
}

function providerDisplayName(provider: string): string {
  if (provider === "azure") return "Azure AI";
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  return "the configured AI provider";
}
