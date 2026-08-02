import type { AuthSession } from "@/lib/auth/server";
import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import type {
  MeridianMcpFetchedItem,
  MeridianMcpRepository,
  MeridianMcpSearchResult,
  SubmitMeridianResourceDraftInput,
  SubmittedMeridianResourceDraft
} from "@/lib/meridian/mcp/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export class MeridianMcpService {
  constructor(private readonly repository: MeridianMcpRepository) {}

  async search(session: AuthSession, query: string): Promise<{ results: MeridianMcpSearchResult[] }> {
    const normalized = query.trim();
    if (!normalized) throw new MeridianMcpError("invalid_query", 400, "A search query is required.");
    await this.repository.requireGrant(session, "search");
    return { results: await this.repository.search(session, normalized.slice(0, 500)) };
  }

  async fetch(session: AuthSession, id: string): Promise<MeridianMcpFetchedItem> {
    await this.repository.requireGrant(session, "search");
    const item = await this.repository.fetch(session, normalizeClaimId(id));
    if (!item) throw new MeridianMcpError("not_found", 404, "That approved Meridian item is not available in your ministry scope.");
    return item;
  }

  async submitDraft(
    session: AuthSession,
    input: Omit<SubmitMeridianResourceDraftInput, "clientName" | "safetyFindings">,
    clientName: string
  ): Promise<SubmittedMeridianResourceDraft> {
    await this.repository.requireGrant(session, "save_drafts");
    const title = input.title.trim();
    const bodyMarkdown = input.bodyMarkdown.trim();
    const claimIds = Array.from(new Set(input.claimIds.map(normalizeClaimId)));
    if (!title || !bodyMarkdown) throw new MeridianMcpError("invalid_draft", 400, "A title and resource body are required.");
    if (!claimIds.length) {
      throw new MeridianMcpError("ungrounded_draft", 400, "At least one approved Meridian claim is required before a resource can enter review.");
    }

    const prohibited = detectProhibitedInference(`${title}\n${bodyMarkdown}`);
    if (prohibited.prohibited) {
      throw new MeridianMcpError(
        "prohibited_inference",
        422,
        "This draft makes a prohibited personal, spiritual, medical, mental-health, motive, or divine-intent inference. Revise it before submission."
      );
    }

    return this.repository.submitDraft(session, {
      ...input,
      title,
      bodyMarkdown,
      claimIds,
      clientName: sanitizeClientName(clientName),
      safetyFindings: [{ code: "human_review_required", detail: "MCP-authored resources never self-approve or publish." }]
    });
  }
}

function normalizeClaimId(value: string) {
  const normalized = value.trim().replace(/^claim:/i, "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new MeridianMcpError("invalid_claim_id", 400, "Meridian claim identifiers must be UUIDs returned by search.");
  }
  return normalized.toLowerCase();
}

function sanitizeClientName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9 ._/-]/g, "").trim().slice(0, 120);
  return sanitized || "mcp-client";
}
