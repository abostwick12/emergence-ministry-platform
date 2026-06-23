// Server-only Camp access management.
//
// The UI submits email + Camp role. The server resolves that email to an
// existing authenticated profile, and writes `camp_access_members`. The
// database trigger on that table appends `camp_access_audit` from auth.uid()
// and the actual row change, so clients never provide audit metadata.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import {
  BOOTSTRAP_CAMP_ADMIN_EMAIL,
  CAMP_STORED_ROLES,
  getStoredCampRoleState,
  isBootstrapCampAdmin,
  type CampStoredRole
} from "@/lib/camp/access-control";

export type CampAccessMember = {
  userId: string;
  email: string;
  campRole: CampStoredRole;
  isActive: boolean;
  updatedAt: string;
  bootstrap?: boolean;
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
  bootstrapActive: boolean;
  roles: CampStoredRole[];
  members: CampAccessMember[];
  audit: CampAccessAuditEntry[];
};
type UpdateOk = { allowed: true; status: 200; member: CampAccessMember };

export type CampAccessUpdateInput = {
  email: string;
  campRole: CampStoredRole;
  isActive?: boolean;
};

export async function isCampAccessAdmin(session: AuthSession): Promise<boolean> {
  const stored = await getStoredCampRoleState(session);
  if (stored.role === "camp_admin") return true;
  if (stored.available) return false;
  return isBootstrapCampAdmin(session);
}

export async function listCampAccess(session: AuthSession): Promise<ListOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to Camp Admins." };
  }

  const base = {
    allowed: true as const,
    status: 200 as const,
    roles: CAMP_STORED_ROLES,
    bootstrapActive: isBootstrapCampAdmin(session)
  };

  if (session.isMock || !isSupabaseConfigured()) {
    return {
      ...base,
      available: false,
      members: base.bootstrapActive ? [bootstrapMember(session)] : [],
      audit: []
    };
  }

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const [members, audit] = await Promise.all([
      supabase.from("camp_access_members").select("user_id,email,camp_role,is_active,updated_at").eq("is_active", true).order("email", { ascending: true }),
      supabase
        .from("camp_access_audit")
        .select("id,actor_email,target_email,action,old_role,new_role,created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    if (members.error) throw members.error;
    return {
      ...base,
      bootstrapActive: false,
      available: true,
      members: (members.data ?? []).map(toMember),
      audit: (audit.data ?? []).map(toAudit)
    };
  } catch {
    return {
      ...base,
      available: false,
      members: base.bootstrapActive ? [bootstrapMember(session)] : [],
      audit: []
    };
  }
}

export async function updateCampAccessMember(session: AuthSession, input: CampAccessUpdateInput): Promise<UpdateOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to Camp Admins." };
  }
  if (!CAMP_STORED_ROLES.includes(input.campRole)) {
    return { allowed: false, status: 400, error: "Unknown Camp access tier." };
  }
  const email = normalizeEmail(input.email);
  if (!email) return { allowed: false, status: 400, error: "Email is required." };
  if (session.isMock || !isSupabaseConfigured()) {
    return {
      allowed: false,
      status: 503,
      error: "Camp access management requires migration 014 and a configured Supabase project."
    };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const profile = await supabase
    .from("profiles")
    .select("id,email")
    .ilike("email", email)
    .maybeSingle<{ id: string; email: string }>();

  if (profile.error || !profile.data) {
    return { allowed: false, status: 404, error: "No authenticated user profile was found for that email." };
  }

  const targetUserId = profile.data.id;
  const existing = await supabase
    .from("camp_access_members")
    .select("camp_role,is_active")
    .eq("user_id", targetUserId)
    .maybeSingle<{ camp_role: CampStoredRole; is_active: boolean }>();
  if (existing.error) {
    return { allowed: false, status: 503, error: "Camp access management requires migration 014." };
  }

  const oldRole = existing.data?.camp_role ?? null;
  const nextActive = input.isActive ?? true;
  const finalAdminCheck = await assertNotFinalActiveAdminChange(supabase, targetUserId, oldRole, existing.data?.is_active ?? false, input.campRole, nextActive);
  if (!finalAdminCheck.allowed) return finalAdminCheck;

  const { data, error } = await supabase
    .from("camp_access_members")
    .upsert(
      {
        user_id: targetUserId,
        email: profile.data.email,
        camp_role: input.campRole,
        is_active: nextActive,
        granted_by: session.user.id
      },
      { onConflict: "user_id" }
    )
    .select("user_id,email,camp_role,is_active,updated_at")
    .single();

  if (error || !data) {
    const message = /final Camp administrator/i.test(error?.message ?? "")
      ? "Cannot demote or remove the final Camp administrator."
      : "Camp access update failed.";
    return { allowed: false, status: 400, error: message };
  }

  return { allowed: true, status: 200, member: toMember(data) };
}

async function assertNotFinalActiveAdminChange(
  supabase: ReturnType<typeof getSupabaseAuthClient>,
  targetUserId: string,
  oldRole: CampStoredRole | null,
  wasActive: boolean,
  newRole: CampStoredRole,
  isActive: boolean
): Promise<{ allowed: true } | Denied> {
  if (oldRole !== "camp_admin" || !wasActive || (newRole === "camp_admin" && isActive)) return { allowed: true };
  const admins = await supabase
    .from("camp_access_members")
    .select("user_id")
    .eq("camp_role", "camp_admin")
    .eq("is_active", true);
  if (admins.error) return { allowed: false, status: 400, error: "Could not verify final Camp Admin protection." };
  const remaining = (admins.data ?? []).filter((row: { user_id: string }) => row.user_id !== targetUserId).length;
  if (remaining === 0) return { allowed: false, status: 400, error: "Cannot demote or remove the final Camp administrator." };
  return { allowed: true };
}

function bootstrapMember(session: AuthSession): CampAccessMember {
  return {
    userId: session.user.id,
    email: BOOTSTRAP_CAMP_ADMIN_EMAIL,
    campRole: "camp_admin",
    isActive: true,
    updatedAt: new Date().toISOString(),
    bootstrap: true
  };
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
