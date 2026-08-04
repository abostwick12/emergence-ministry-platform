import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { SupabaseMeridianKnowledgeRepository } from "@/lib/meridian/knowledge/repository";
import type { MeridianClaim, MeridianFragment, MeridianSource, MeridianTaskContext } from "@/lib/meridian/knowledge/types";
import type {
  MeridianMcpCapability,
  MeridianMcpFetchedItem,
  MeridianMcpGrant,
  MeridianMcpRepository,
  MeridianMcpSearchResult,
  SubmitMeridianResourceDraftInput,
  SubmittedMeridianResourceDraft
} from "@/lib/meridian/mcp/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

type GrantRow = {
  ministry_id: string;
  user_id: string;
  access_level: MeridianMcpGrant["accessLevel"];
  can_search: boolean;
  can_save_drafts: boolean;
  can_read_platform: boolean;
  can_manage_events: boolean;
  can_manage_tasks: boolean;
  can_save_resources: boolean;
};

type LegacyGrantRow = Omit<GrantRow, "can_read_platform" | "can_manage_events" | "can_manage_tasks" | "can_save_resources">;

type ClaimRow = {
  id: string;
  ministry_id: string;
  proposition: string;
  claim_kind: MeridianClaim["kind"];
  attribution: string | null;
  authority_class: MeridianClaim["authorityClass"];
  approval_status: MeridianClaim["approvalStatus"];
};

type ClaimFragmentRow = { claim_id: string; fragment_id: string };
type FragmentRow = {
  id: string;
  ministry_id: string;
  source_id: string;
  locator: MeridianFragment["locator"];
  content_hash: string;
  body_text: string;
  provenance: Record<string, unknown> | null;
  quote_policy: MeridianFragment["quotePolicy"];
  generation_policy: MeridianFragment["generationPolicy"];
  sensitivity: MeridianFragment["sensitivity"];
  can_quote: boolean;
  can_paraphrase: boolean;
  can_cite: boolean;
  can_use_final_answer: boolean;
};
type SourceRow = {
  id: string;
  ministry_id: string;
  title: string;
  source_uri: string | null;
  approval_status: MeridianSource["approvalStatus"];
  generation_policy: MeridianSource["generationPolicy"];
  sensitivity: MeridianSource["sensitivity"];
};

export class SupabaseMeridianMcpRepository implements MeridianMcpRepository {
  async requireGrant(session: AuthSession, capability: MeridianMcpCapability): Promise<MeridianMcpGrant> {
    if (!session.accessToken || session.isGuest || session.isMock) {
      throw new MeridianMcpError("authentication_required", 401, "A live Lead Emergence account is required for Meridian MCP access.");
    }
    const ministryId = await requireMinistryId(session);
    const supabase = getSupabaseAuthClient(session.accessToken);
    let result = await supabase
      .from("meridian_mcp_access_grants")
      .select("ministry_id,user_id,access_level,can_search,can_save_drafts,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources")
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .maybeSingle<GrantRow>();
    if (result.error && isMissingPlatformGrantColumns(result.error)) {
      const legacyResult = await supabase
        .from("meridian_mcp_access_grants")
        .select("ministry_id,user_id,access_level,can_search,can_save_drafts")
        .eq("ministry_id", ministryId)
        .eq("user_id", session.user.id)
        .is("revoked_at", null)
        .maybeSingle<LegacyGrantRow>();
      result = {
        ...legacyResult,
        data: legacyResult.data ? {
          ...legacyResult.data,
          can_read_platform: false,
          can_manage_events: false,
          can_manage_tasks: false,
          can_save_resources: false
        } : null
      } as typeof result;
    }
    if (result.error) throw storageError(result.error.message);
    const row = result.data;
    const allowed = row ? capabilityAllowed(row, capability) : false;
    if (!row || !allowed) {
      throw new MeridianMcpError("mcp_access_denied", 403, "Your ministry has not granted this Meridian MCP capability.");
    }
    return {
      ministryId: row.ministry_id,
      userId: row.user_id,
      accessLevel: row.access_level,
      canSearch: row.can_search,
      canSaveDrafts: row.can_save_drafts,
      canReadPlatform: row.can_read_platform,
      canManageEvents: row.can_manage_events,
      canManageTasks: row.can_manage_tasks,
      canSaveResources: row.can_save_resources
    };
  }

  async search(session: AuthSession, query: string): Promise<MeridianMcpSearchResult[]> {
    const ministryId = await requireMinistryId(session);
    const task: MeridianTaskContext = {
      ministryId,
      audience: "ministry_resource_creators",
      taskType: "resource_development",
      query,
      sensitivity: "general",
      at: new Date().toISOString(),
      externalCommunication: false
    };
    const evidence = await new SupabaseMeridianKnowledgeRepository().loadApprovedEvidence(session, task);
    const fragmentsById = new Map(evidence.fragments.map((fragment) => [fragment.id, fragment]));
    const sourcesById = new Map(evidence.sources.map((source) => [source.id, source]));

    return evidence.claims.slice(0, 20).map((claim) => {
      const source = claim.supportingFragmentIds
        .map((fragmentId) => fragmentsById.get(fragmentId))
        .map((fragment) => fragment && sourcesById.get(fragment.sourceId))
        .find((candidate): candidate is MeridianSource => Boolean(candidate));
      return {
        id: claim.id,
        title: source ? `${source.title}: ${truncate(claim.proposition, 100)}` : truncate(claim.proposition, 140),
        url: claimUrl(claim.id)
      };
    });
  }

  async fetch(session: AuthSession, id: string): Promise<MeridianMcpFetchedItem | null> {
    const ministryId = await requireMinistryId(session);
    const supabase = getSupabaseAuthClient(session.accessToken);
    const claimResult = await supabase
      .from("meridian_claims")
      .select("id,ministry_id,proposition,claim_kind,attribution,authority_class,approval_status")
      .eq("ministry_id", ministryId)
      .eq("id", id)
      .eq("approval_status", "approved")
      .neq("authority_class", "none")
      .maybeSingle<ClaimRow>();
    if (claimResult.error) throw storageError(claimResult.error.message);
    if (!claimResult.data) return null;

    const supportResult = await supabase
      .from("meridian_claim_fragments")
      .select("claim_id,fragment_id")
      .eq("ministry_id", ministryId)
      .eq("claim_id", id)
      .returns<ClaimFragmentRow[]>();
    if (supportResult.error) throw storageError(supportResult.error.message);
    const fragmentIds = (supportResult.data ?? []).map((row) => row.fragment_id);
    if (!fragmentIds.length) return null;

    const fragmentResult = await supabase.rpc("fetch_meridian_generation_fragments", {
      p_ministry_id: ministryId,
      p_fragment_ids: fragmentIds
    }) as unknown as { data: FragmentRow[] | null; error: { message: string } | null };
    if (fragmentResult.error) throw storageError(fragmentResult.error.message);
    const fragments = (fragmentResult.data ?? []).filter(
      (fragment) => fragment.sensitivity !== "pastoral" && fragment.sensitivity !== "person_specific"
    );
    if (!fragments.length) return null;

    const sourceIds = Array.from(new Set(fragments.map((fragment) => fragment.source_id)));
    const sourceResult = await supabase
      .from("meridian_sources")
      .select("id,ministry_id,title,source_uri,approval_status,generation_policy,sensitivity")
      .eq("ministry_id", ministryId)
      .eq("approval_status", "approved")
      .eq("generation_policy", "approved_generation")
      .in("id", sourceIds)
      .returns<SourceRow[]>();
    if (sourceResult.error) throw storageError(sourceResult.error.message);
    const sources = (sourceResult.data ?? []).filter(
      (source) => source.sensitivity !== "pastoral" && source.sensitivity !== "person_specific"
    );
    if (!sources.length) return null;

    const sourceIdSet = new Set(sources.map((source) => source.id));
    const allowedFragments = fragments.filter((fragment) => sourceIdSet.has(fragment.source_id));
    const quotations = allowedFragments.filter(
      (fragment) => fragment.can_quote && fragment.quote_policy === "allowed" && fragment.body_text.trim()
    );
    const claim = claimResult.data;
    return {
      id: claim.id,
      title: sources.length === 1 ? sources[0].title : truncate(claim.proposition, 140),
      text: [
        `Approved claim: ${claim.proposition}`,
        claim.attribution ? `Attribution: ${claim.attribution}` : "",
        `Authority: ${claim.authority_class}`,
        `Supporting sources: ${sources.map((source) => source.title).join("; ")}`,
        quotations.length ? `Approved exact quotation${quotations.length === 1 ? "" : "s"}:\n${quotations.map((fragment) => fragment.body_text).join("\n\n")}` : "Exact source text is not exposed because quotation permission was not granted. Use the approved claim as a proposition, not as a quotation."
      ].filter(Boolean).join("\n\n"),
      url: claimUrl(claim.id),
      metadata: {
        claimKind: claim.claim_kind,
        authorityClass: claim.authority_class,
        attribution: claim.attribution ?? undefined,
        approvalStatus: "approved",
        quotePermission: quotations.length ? "allowed" : "not_allowed",
        sourceTitles: sources.map((source) => source.title),
        fragmentIds: allowedFragments.map((fragment) => fragment.id)
      }
    };
  }

  async submitDraft(session: AuthSession, input: SubmitMeridianResourceDraftInput): Promise<SubmittedMeridianResourceDraft> {
    const ministryId = await requireMinistryId(session);
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase.rpc("submit_meridian_resource_draft", {
      p_ministry_id: ministryId,
      p_title: input.title,
      p_resource_type: input.resourceType,
      p_audience: input.audience,
      p_task_type: input.taskType,
      p_body_markdown: input.bodyMarkdown,
      p_claim_ids: input.claimIds,
      p_client_name: input.clientName,
      p_idempotency_key: input.idempotencyKey,
      p_safety_findings: input.safetyFindings
    });
    if (result.error) throw storageError(result.error.message);
    const data = result.data as { id?: unknown; status?: unknown; safetyStatus?: unknown; idempotentReplay?: unknown } | null;
    if (typeof data?.id !== "string" || data.status !== "submitted" || data.safetyStatus !== "review_required") {
      throw new MeridianMcpError("draft_submission_failed", 503, "The resource draft could not be placed in the Meridian review queue.");
    }
    return {
      id: data.id,
      status: "submitted",
      safetyStatus: "review_required",
      reviewRequired: true,
      idempotentReplay: data.idempotentReplay === true
    };
  }
}

async function requireMinistryId(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) throw new MeridianMcpError("tenant_scope_missing", 403, "Your Lead Emergence account does not have a ministry scope.");
  return ministryId;
}

function claimUrl(id: string) {
  return `${publicOrigin()}/api/meridian/knowledge/claims/${encodeURIComponent(id)}`;
}

function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configured) return "https://www.leademergence.com";
  return configured.startsWith("http://") || configured.startsWith("https://") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
}

function truncate(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function storageError(_message: string) {
  return new MeridianMcpError("mcp_storage_unavailable", 503, "Meridian MCP storage is not ready. No data was changed.");
}

function capabilityAllowed(row: GrantRow, capability: MeridianMcpCapability) {
  if (capability === "search") return row.can_search;
  if (capability === "save_drafts") return row.can_save_drafts;
  if (capability === "read_platform") return row.can_read_platform;
  if (capability === "manage_events") return row.can_manage_events;
  if (capability === "manage_tasks") return row.can_manage_tasks;
  return row.can_save_resources;
}

function isMissingPlatformGrantColumns(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("can_read_platform") || message.includes("can_manage_events") || message.includes("can_manage_tasks") || message.includes("can_save_resources");
}
