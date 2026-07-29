export type EmmaChatAuditPayload = {
  providerMode: "live_provider" | "audited_fallback" | "guest_simulation";
  provider: string;
  proposalCreated: boolean;
  warnings?: string[];
};

export function buildMinistryChatAudit(payload: EmmaChatAuditPayload): string {
  const proposal = payload.proposalCreated ? " Recommendation saved for review." : "";

  if (payload.providerMode === "guest_simulation") {
    return `Guest demo response. Read-only guidance shown; no writes, sends, workflow triggers, or external ministry data changes ran.${proposal}`;
  }

  if (payload.providerMode === "live_provider") {
    const recoveredByFailover = payload.warnings?.some((warning) => /failover returned a valid response/i.test(warning));
    return `AI response ready through ${providerDisplayName(payload.provider)}. ${
      recoveredByFailover ? "Primary provider recovered through safe failover. " : ""
    }Audit trail saved; no actions executed.${proposal}`;
  }

  const auditUnavailable = payload.warnings?.some((warning) => /audit persistence was unavailable/i.test(warning));
  return `${auditUnavailable ? "Audited EMMA response shown; audit storage was unavailable. " : "Audited EMMA response shown. Audit trail saved; "}No actions executed.${proposal}`;
}

function providerDisplayName(provider: string): string {
  if (provider === "gloo") return "Gloo AI Studio";
  if (provider === "azure") return "Azure AI";
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  return "the configured AI provider";
}
