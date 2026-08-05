import type { AuthSession } from "@/lib/auth/server";
import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import type {
  MeridianMcpFetchedItem,
  MeridianMcpRepository,
  MeridianMcpSearchResult,
  SubmitMeridianPrivateCandidateInput,
  SubmitMeridianResourceDraftInput,
  SubmittedMeridianPrivateCandidate,
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

  async submitPrivateCandidate(
    session: AuthSession,
    input: SubmitMeridianPrivateCandidateInput & { confirmed: true }
  ): Promise<SubmittedMeridianPrivateCandidate> {
    await this.repository.requireGrant(session, "submit_candidates");
    if (input.confirmed !== true) {
      throw new MeridianMcpError("confirmation_required", 400, "The user must explicitly confirm this private-note candidate submission.");
    }
    const title = boundedText(input.title, "title", 240);
    const rawText = boundedText(input.rawText, "rawText", 60000);
    const sourceReference = input.sourceReference.trim();
    if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(sourceReference)) {
      throw new MeridianMcpError("invalid_private_source_reference", 400, "Use the opaque source reference returned by the local Obsidian connector.");
    }
    const contentHash = input.contentHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(contentHash) || contentHash !== await sha256(rawText)) {
      throw new MeridianMcpError("private_content_hash_mismatch", 400, "The private note content no longer matches its local discovery hash.");
    }
    const summary = boundedText(input.summary, "summary", 800);
    const topicTags = boundedList(input.topicTags, 20, 120, "topicTags");
    const scriptureReferences = boundedList(input.scriptureReferences, 20, 120, "scriptureReferences");
    const claimProposals = boundedList(input.claimProposals, 16, 500, "claimProposals");
    const questionAliases = boundedList(input.questionAliases, 20, 500, "questionAliases");
    const questionFacets = boundedList(input.questionFacets, 4, 500, "questionFacets");
    if (input.objectType === "question" && (!questionAliases.length || !questionFacets.length)) {
      throw new MeridianMcpError("invalid_candidate_metadata", 400, "Question candidates require aliases and one to four review facets.");
    }
    if (input.objectType !== "question" && !claimProposals.length) {
      throw new MeridianMcpError("invalid_candidate_metadata", 400, "Passage, doctrine, and formation candidates require at least one claim proposal.");
    }
    return this.repository.submitPrivateCandidate(session, {
      title,
      sourceReference,
      rawText,
      contentHash,
      objectType: input.objectType,
      summary,
      topicTags,
      scriptureReferences,
      claimProposals,
      questionAliases,
      questionFacets
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

function boundedText(value: string, field: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new MeridianMcpError("invalid_candidate", 400, `${field} must contain 1 to ${max} characters.`);
  }
  return normalized;
}

function boundedList(values: string[], maxItems: number, maxLength: number, field: string) {
  const normalized = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  if (normalized.length > maxItems || normalized.some((value) => value.length > maxLength)) {
    throw new MeridianMcpError("invalid_candidate_metadata", 400, `${field} exceeds the private candidate limits.`);
  }
  return normalized;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
