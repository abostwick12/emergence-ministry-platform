import { NextResponse } from "next/server";

import { getServerSession, getSupabaseAuthClient, unauthorizedResponse } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { getMeridianMcpResourceUrl } from "@/lib/meridian/mcp/oauth";

type GrantRow = {
  access_level: "volunteer_creator" | "leader_creator" | "admin";
  can_search: boolean;
  can_save_drafts: boolean;
  can_submit_candidates: boolean;
  can_read_platform: boolean;
  can_manage_events: boolean;
  can_manage_tasks: boolean;
  can_save_resources: boolean;
  can_review_resources: boolean;
  pilot_stage: "not_enrolled" | "admin_pilot" | "leader_pilot";
  revoked_at: string | null;
};

type PhaseFiveGrantRow = Omit<GrantRow, "pilot_stage">;
type PhaseFourGrantRow = Omit<PhaseFiveGrantRow, "can_review_resources">;
type PlatformGrantWithoutCandidatesRow = Omit<PhaseFourGrantRow, "can_submit_candidates">;
type LegacyGrantRow = Omit<PlatformGrantWithoutCandidatesRow, "can_read_platform" | "can_manage_events" | "can_manage_tasks" | "can_save_resources">;

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const endpoint = getMeridianMcpResourceUrl(request);
  if (!session.accessToken || session.isGuest || session.isMock) {
    return NextResponse.json({ available: false, endpoint, grant: null, oauthGrants: [] });
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return NextResponse.json({ error: "Your account does not have a ministry workspace." }, { status: 403 });

  const supabase = getSupabaseAuthClient(session.accessToken);
  let grantResult = await supabase
    .from("meridian_mcp_access_grants")
    .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,pilot_stage,revoked_at")
    .eq("ministry_id", ministryId)
    .eq("user_id", session.user.id)
    .maybeSingle<GrantRow>();
  if (grantResult.error && isMissingPlatformGrantColumns(grantResult.error)) {
    const phaseFiveResult = await supabase
      .from("meridian_mcp_access_grants")
      .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,revoked_at")
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id)
      .maybeSingle<PhaseFiveGrantRow>();
    if (!phaseFiveResult.error) {
      grantResult = {
        ...phaseFiveResult,
        data: phaseFiveResult.data ? { ...phaseFiveResult.data, pilot_stage: "not_enrolled" } : null
      } as unknown as typeof grantResult;
    } else {
      const phaseFourResult = await supabase
      .from("meridian_mcp_access_grants")
      .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,revoked_at")
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id)
      .maybeSingle<PhaseFourGrantRow>();
      if (!phaseFourResult.error) {
        grantResult = {
          ...phaseFourResult,
          data: phaseFourResult.data ? { ...phaseFourResult.data, can_review_resources: false, pilot_stage: "not_enrolled" } : null
        } as unknown as typeof grantResult;
      } else {
        const platformResult = await supabase
        .from("meridian_mcp_access_grants")
        .select("access_level,can_search,can_save_drafts,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,revoked_at")
        .eq("ministry_id", ministryId)
        .eq("user_id", session.user.id)
        .maybeSingle<PlatformGrantWithoutCandidatesRow>();
        if (!platformResult.error) {
          grantResult = {
            ...platformResult,
            data: platformResult.data ? { ...platformResult.data, can_submit_candidates: false, can_review_resources: false, pilot_stage: "not_enrolled" } : null
          } as unknown as typeof grantResult;
        } else {
          const legacyResult = await supabase
          .from("meridian_mcp_access_grants")
          .select("access_level,can_search,can_save_drafts,revoked_at")
          .eq("ministry_id", ministryId)
          .eq("user_id", session.user.id)
          .maybeSingle<LegacyGrantRow>();
        grantResult = {
          ...legacyResult,
          data: legacyResult.data ? {
            ...legacyResult.data,
            can_submit_candidates: false,
            can_read_platform: false,
            can_manage_events: false,
            can_manage_tasks: false,
            can_save_resources: false,
            can_review_resources: false,
            pilot_stage: "not_enrolled"
          } : null
        } as unknown as typeof grantResult;
        }
      }
    }
  }
  if (grantResult.error) {
    return NextResponse.json({ error: "Meridian connection permissions could not be loaded." }, { status: 503 });
  }

  const oauthResult = await supabase.auth.oauth.listGrants();
  return NextResponse.json({
    available: true,
    endpoint,
    canManage: session.user.role === "admin",
    grant: toGrant(grantResult.data),
    oauthReady: !oauthResult.error,
    oauthGrants: (oauthResult.data ?? []).map((grant) => ({
      clientId: grant.client.id,
      clientName: grant.client.name,
      clientUri: grant.client.uri,
      scopes: grant.scopes,
      grantedAt: grant.granted_at
    }))
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();
  if (session.user.role !== "admin") return NextResponse.json({ error: "Admin access is required." }, { status: 403 });

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return NextResponse.json({ error: "Your account does not have a ministry workspace." }, { status: 403 });

  let body: {
    enabled?: unknown;
    canSaveDrafts?: unknown;
    canSubmitCandidates?: unknown;
    canReadPlatform?: unknown;
    canManageEvents?: unknown;
    canManageTasks?: unknown;
    canSaveResources?: unknown;
    canReviewResources?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Connection permissions are required." }, { status: 400 });
  }
  if (
    typeof body.enabled !== "boolean"
    || typeof body.canSaveDrafts !== "boolean"
    || typeof body.canSubmitCandidates !== "boolean"
    || typeof body.canReadPlatform !== "boolean"
    || typeof body.canManageEvents !== "boolean"
    || typeof body.canManageTasks !== "boolean"
    || typeof body.canSaveResources !== "boolean"
    || typeof body.canReviewResources !== "boolean"
  ) {
    return NextResponse.json({ error: "Connection permissions are invalid." }, { status: 400 });
  }
  if (!body.canReadPlatform && (body.canManageEvents || body.canManageTasks || body.canSaveResources || body.canReviewResources)) {
    return NextResponse.json({ error: "Platform read access is required before platform changes can be enabled." }, { status: 400 });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  if (!body.enabled) {
    const pilotResult = await supabase.rpc("set_meridian_mcp_pilot_member", {
      p_user_id: session.user.id,
      p_pilot_stage: "not_enrolled"
    });
    if (pilotResult.error && !isMissingPilotFunction(pilotResult.error)) {
      return NextResponse.json({ error: "Meridian pilot access could not be disabled safely." }, { status: 503 });
    }
    const result = await supabase
      .from("meridian_mcp_access_grants")
      .update({
        revoked_at: new Date().toISOString(),
        can_read_platform: false,
        can_manage_events: false,
        can_manage_tasks: false,
        can_save_resources: false,
        can_review_resources: false
      })
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id);
    if (result.error) return NextResponse.json({ error: "Meridian access could not be disabled." }, { status: 503 });
    return NextResponse.json({ grant: disabledGrant() });
  }

  const grantPayload = {
    ministry_id: ministryId,
    user_id: session.user.id,
    access_level: "admin",
    can_search: true,
    can_save_drafts: body.canSaveDrafts,
    can_submit_candidates: body.canSubmitCandidates,
    can_read_platform: body.canReadPlatform,
    can_manage_events: body.canManageEvents,
    can_manage_tasks: body.canManageTasks,
    can_save_resources: body.canSaveResources,
    can_review_resources: body.canReviewResources,
    created_by_user_id: session.user.id,
    revoked_at: null
  };
  const grantUpdates = {
    access_level: grantPayload.access_level,
    can_search: grantPayload.can_search,
    can_save_drafts: grantPayload.can_save_drafts,
    can_submit_candidates: grantPayload.can_submit_candidates,
    can_read_platform: grantPayload.can_read_platform,
    can_manage_events: grantPayload.can_manage_events,
    can_manage_tasks: grantPayload.can_manage_tasks,
    can_save_resources: grantPayload.can_save_resources,
    can_review_resources: grantPayload.can_review_resources,
    revoked_at: grantPayload.revoked_at
  };
  let result = await supabase
    .from("meridian_mcp_access_grants")
    .update(grantUpdates)
    .eq("ministry_id", ministryId)
    .eq("user_id", session.user.id)
    .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,pilot_stage,revoked_at")
    .maybeSingle<GrantRow>();
  if (result.error && isMissingPlatformGrantColumns(result.error)) {
    const phaseFiveResult = await supabase
      .from("meridian_mcp_access_grants")
      .update(grantUpdates)
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id)
      .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,revoked_at")
      .maybeSingle<PhaseFiveGrantRow>();
    result = {
      ...phaseFiveResult,
      data: phaseFiveResult.data ? { ...phaseFiveResult.data, pilot_stage: "not_enrolled" } : null
    } as unknown as typeof result;
  }
  if (!result.error && !result.data) {
    result = await supabase
      .from("meridian_mcp_access_grants")
      .insert(grantPayload)
      .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,pilot_stage,revoked_at")
      .single<GrantRow>();
    if (result.error && isMissingPlatformGrantColumns(result.error)) {
      const phaseFiveResult = await supabase
        .from("meridian_mcp_access_grants")
        .insert(grantPayload)
        .select("access_level,can_search,can_save_drafts,can_submit_candidates,can_read_platform,can_manage_events,can_manage_tasks,can_save_resources,can_review_resources,revoked_at")
        .single<PhaseFiveGrantRow>();
      result = {
        ...phaseFiveResult,
        data: phaseFiveResult.data ? { ...phaseFiveResult.data, pilot_stage: "not_enrolled" } : null
      } as unknown as typeof result;
    }
  }
  if (result.error || !result.data) {
    return NextResponse.json({ error: "Meridian access could not be enabled." }, { status: 503 });
  }
  return NextResponse.json({ grant: toGrant(result.data) });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();

  let body: { clientId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "An authorized client is required." }, { status: 400 });
  }
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId || clientId.length > 200 || !/^[a-zA-Z0-9._~-]+$/.test(clientId)) {
    return NextResponse.json({ error: "The authorized client is invalid." }, { status: 400 });
  }

  const result = await getSupabaseAuthClient(session.accessToken).auth.oauth.revokeGrant({ clientId });
  if (result.error) return NextResponse.json({ error: "The AI connection could not be revoked." }, { status: 400 });
  return NextResponse.json({ revoked: true });
}

function toGrant(row: GrantRow | null) {
  const enabled = Boolean(row && !row.revoked_at && row.can_search);
  return {
    enabled,
    canSearch: enabled,
    canSaveDrafts: enabled && Boolean(row?.can_save_drafts),
    canSubmitCandidates: enabled && Boolean(row?.can_submit_candidates),
    canReadPlatform: enabled && Boolean(row?.can_read_platform),
    canManageEvents: enabled && Boolean(row?.can_read_platform) && Boolean(row?.can_manage_events),
    canManageTasks: enabled && Boolean(row?.can_read_platform) && Boolean(row?.can_manage_tasks),
    canSaveResources: enabled && Boolean(row?.can_read_platform) && Boolean(row?.can_save_resources),
    canReviewResources: enabled && Boolean(row?.can_read_platform) && Boolean(row?.can_review_resources),
    pilotStage: enabled ? row?.pilot_stage ?? "not_enrolled" : "not_enrolled",
    accessLevel: enabled ? row?.access_level ?? null : null
  };
}

function disabledGrant() {
  return {
    enabled: false,
    canSearch: false,
    canSaveDrafts: false,
    canSubmitCandidates: false,
    canReadPlatform: false,
    canManageEvents: false,
    canManageTasks: false,
    canSaveResources: false,
    canReviewResources: false,
    pilotStage: "not_enrolled",
    accessLevel: null
  };
}

function isMissingPlatformGrantColumns(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("pilot_stage") || message.includes("can_review_resources") || message.includes("can_submit_candidates") || message.includes("can_read_platform") || message.includes("can_manage_events") || message.includes("can_manage_tasks") || message.includes("can_save_resources");
}

function isMissingPilotFunction(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST202" || error.code === "42883" || message.includes("set_meridian_mcp_pilot_member");
}
