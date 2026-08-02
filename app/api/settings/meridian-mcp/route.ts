import { NextResponse } from "next/server";

import { getServerSession, getSupabaseAuthClient, unauthorizedResponse } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { getMeridianMcpResourceUrl } from "@/lib/meridian/mcp/oauth";

type GrantRow = {
  access_level: "volunteer_creator" | "leader_creator" | "admin";
  can_search: boolean;
  can_save_drafts: boolean;
  revoked_at: string | null;
};

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
  const grantResult = await supabase
    .from("meridian_mcp_access_grants")
    .select("access_level,can_search,can_save_drafts,revoked_at")
    .eq("ministry_id", ministryId)
    .eq("user_id", session.user.id)
    .maybeSingle<GrantRow>();
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

  let body: { enabled?: unknown; canSaveDrafts?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Connection permissions are required." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean" || typeof body.canSaveDrafts !== "boolean") {
    return NextResponse.json({ error: "Connection permissions are invalid." }, { status: 400 });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  if (!body.enabled) {
    const result = await supabase
      .from("meridian_mcp_access_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id);
    if (result.error) return NextResponse.json({ error: "Meridian access could not be disabled." }, { status: 503 });
    return NextResponse.json({ grant: { enabled: false, canSearch: false, canSaveDrafts: false, accessLevel: null } });
  }

  const result = await supabase
    .from("meridian_mcp_access_grants")
    .upsert({
      ministry_id: ministryId,
      user_id: session.user.id,
      access_level: "admin",
      can_search: true,
      can_save_drafts: body.canSaveDrafts,
      created_by_user_id: session.user.id,
      revoked_at: null
    }, { onConflict: "ministry_id,user_id" })
    .select("access_level,can_search,can_save_drafts,revoked_at")
    .single<GrantRow>();
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
    accessLevel: enabled ? row?.access_level ?? null : null
  };
}
