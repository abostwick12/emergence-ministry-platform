// Server-only admin workflow for Camp access management (Settings #2).
//
// Real workflow against the durable `camp_access_members` table (migration 014):
// list authorized users + their tier, change/revoke a tier (guarded so the final
// administrator can never be removed), and append an audit row per change.
// Admin-gated (platform admin OR camp_admin). Exposes NO medical data.
//
// When the table is not applied or Supabase is not configured (e.g. local Stub
// Mode), it reports `available: false` honestly rather than fabricating data.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { CAMP_STORED_ROLES, getStoredCampRole, type CampStoredRole } from "@/lib/camp/access-control";

export type CampAccessMember = {
  userId: string;
  email: string;
  campRole: CampStoredRole;
  isActive: boolean;
  updatedAt: string;
};

export type CampAccessAuditEntry = {
  id: string;
  actorEmail: string | null;
  targetEmail: string | null;
  action: string;
  oldRole: string | null;
  newRole: string | null;
  createdAt: string;
};

type Denied = { allowed: false; status: number; error: string };
type ListOk = {
  allowed: true;
  status: 200;
  available: boolean;
  roles: CampStoredRole[];
  members: CampAccessMember[];
  audit: CampAccessAuditEntry[];
};
type UpdateOk = { allowed: true; status: 200; member: CampAccessMember };

export type CampAccessUpdateInput = {
  userId: string;
  email: string;
  campRole: CampStoredRole;
  isActive?: boolean;
};

export async function isCampAccessAdmin(session: AuthSession): Promise<boolean> {
  if (session.user.role === "admin") return true; // platform admin
  return (await getStoredCampRole(session)) === "camp_admin"; // Camp admin
}

export async function listCampAccess(session: AuthSession): Promise<ListOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to administrators." };
  }
  const base = { allowed: true as const, status: 200 as const, roles: CAMP_STORED_ROLES };
  if (session.isMock || !isSupabaseConfigured()) {
    return { ...base, available: false, members: [], audit: [] };
  }
  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const [members, audit] = await Promise.all([
      supabase.from("camp_access_members").select("user_id,email,camp_role,is_active,updated_at").order("email", { ascending: true }),
      supabase
        .from("camp_access_audit")
        .select("id,actor_email,target_email,action,old_role,new_role,created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    if (members.error) throw members.error;
    return {
      ...base,
      available: true,
      members: (members.data ?? []).map(toMember),
      audit: (audit.data ?? []).map(toAudit)
    };
  } catch {
    // Table not applied yet, or transient — report unavailable rather than guess.
    return { ...base, available: false, members: [], audit: [] };
  }
}

export async function updateCampAccessMember(session: AuthSession, input: CampAccessUpdateInput): Promise<UpdateOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to administrators." };
  }
  if (!CAMP_STORED_ROLES.includes(input.campRole)) {
    return { allowed: false, status: 400, error: "Unknown Camp access tier." };
  }
  if (!input.userId.trim() || !input.email.trim()) {
    return { allowed: false, status: 400, error: "A user id and email are required." };
  }
  if (session.isMock || !isSupabaseConfigured()) {
    return {
      allowed: false,
      status: 503,
      error: "Camp access management requires the camp_access table (migration 014) and a configured Supabase project."
    };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const existing = await supabase.from("camp_access_members").select("camp_role").eq("user_id", input.userId).maybeSingle<{ camp_role: string }>();
  const oldRole = existing.data?.camp_role ?? null;

  const { data, error } = await supabase
    .from("camp_access_members")
    .upsert(
      {
        user_id: input.userId,
        email: input.email.trim(),
        camp_role: input.campRole,
        is_active: input.isActive ?? true,
        granted_by: session.user.id
      },
      { onConflict: "user_id" }
    )
    .select("user_id,email,camp_role,is_active,updated_at")
    .single();

  if (error || !data) {
    // The last-admin guard raises a clear, safe message; surface it. Otherwise stay generic.
    const message = /final Camp administrator/i.test(error?.message ?? "")
      ? "Cannot demote or remove the final Camp administrator."
      : "Camp access update failed.";
    return { allowed: false, status: 400, error: message };
  }

  // Append the change to the audit trail (actor, target, old/new value, timestamp).
  await supabase.from("camp_access_audit").insert({
    actor_user_id: session.user.id,
    actor_email: session.user.email,
    target_user_id: input.userId,
    target_email: input.email.trim(),
    action: oldRole ? "update" : "grant",
    old_role: oldRole,
    new_role: input.campRole
  });

  return { allowed: true, status: 200, member: toMember(data) };
}

function toMember(row: { user_id: string; email: string; camp_role: string; is_active: boolean; updated_at: string }): CampAccessMember {
  return {
    userId: row.user_id,
    email: row.email,
    campRole: row.camp_role as CampStoredRole,
    isActive: row.is_active,
    updatedAt: row.updated_at
  };
}

function toAudit(row: {
  id: string;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  old_role: string | null;
  new_role: string | null;
  created_at: string;
}): CampAccessAuditEntry {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    targetEmail: row.target_email,
    action: row.action,
    oldRole: row.old_role,
    newRole: row.new_role,
    createdAt: row.created_at
  };
}
