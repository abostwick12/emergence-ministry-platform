// Server-only Camp access management.
//
// The UI submits email + Camp role. The server resolves that email to a
// Supabase Auth identity, repairs the app profile when the identity is ready,
// and writes `camp_access_members`. Pending invites remain inactive until the
// invited user signs in and identity resolution can complete. The database
// trigger on `camp_access_members` appends `camp_access_audit` from auth.uid()
// and the actual row change, so clients never provide audit metadata.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured, type AuthSession } from "@/lib/auth/server";
import {
  findAuthUserByEmail,
  inviteAuthUserByEmail,
  normalizeCampAccessEmail,
  repairProfileForAuthUser,
  type CampAuthUser,
  type CampProfileRow
} from "@/lib/camp/access-onboarding";
import {
  BOOTSTRAP_CAMP_ADMIN_EMAIL,
  CAMP_STORED_ROLES,
  getStoredCampRoleState,
  isBootstrapCampAdmin,
  type CampStoredRole
} from "@/lib/camp/access-control";
import {
  CAMP_APP_AREA_SCOPES,
  CAMP_EDIT_SCOPES,
  type CampAppAreaScope,
  type CampEditScope
} from "@/lib/camp/access-roles";
import { normalizeScopeId } from "@/lib/camp/permissions";
import { canUseCampStubMode } from "@/lib/camp/runtime";

export type CampAccessMemberStatus = "active" | "pending_invite" | "inactive" | "bootstrap";

export type CampAccessMember = {
  userId: string;
  email: string;
  displayName?: string | null;
  campRole: CampStoredRole;
  campEditScope: CampEditScope;
  appAreaScope: CampAppAreaScope;
  canPostTeamBulletin: boolean;
  partnerChurchId?: string | null;
  assignedTeamIds: string[];
  isActive: boolean;
  updatedAt: string;
  status: CampAccessMemberStatus;
  bootstrap?: boolean;
};

export type CampAccessPartnerChurchOption = {
  id: string;
  name: string;
};

export type CampAccessTeamOption = {
  id: string;
  name: string;
};

export type CampAccessAuditEntry = {
  id: string;
  actorEmail: string | null;
  targetEmail: string | null;
  action: string;
  oldRole: string | null;
  newRole: string | null;
  reason: string | null;
  createdAt: string;
};

type Denied = { allowed: false; status: number; error: string };
type CampAccessTableClient = Pick<ReturnType<typeof getSupabaseAuthClient>, "from">;
type OnboardingOk = {
  allowed: true;
  status: 200;
  member: CampAccessMember;
  onboarding: CampAccessOnboardingResult;
};
type ListOk = {
  allowed: true;
  status: 200;
  available: boolean;
  bootstrapActive: boolean;
  roles: CampStoredRole[];
  editScopes: CampEditScope[];
  appAreaScopes: CampAppAreaScope[];
  partnerChurches: CampAccessPartnerChurchOption[];
  teams: CampAccessTeamOption[];
  members: CampAccessMember[];
  audit: CampAccessAuditEntry[];
};
type UpdateOk = { allowed: true; status: 200; member: CampAccessMember };

export type CampAccessOnboardingInput = {
  email: string;
  campRole: CampStoredRole;
  campEditScope?: CampEditScope;
  appAreaScope?: CampAppAreaScope;
  canPostTeamBulletin?: boolean;
  partnerChurchId?: string | null;
  assignedTeamIds?: string[];
  displayName?: string;
  inviteRedirectTo?: string;
};

export type CampAccessOnboardingResult = {
  status: "already_active" | "invite_sent" | "pending_invite" | "profile_repaired" | "access_granted";
  email: string;
  campRole: CampStoredRole;
  inviteSent: boolean;
  pendingInvite: boolean;
  profileRepaired: boolean;
  accessGranted: boolean;
};

export type CampAccessUpdateInput = {
  email: string;
  campRole: CampStoredRole;
  campEditScope?: CampEditScope;
  appAreaScope?: CampAppAreaScope;
  canPostTeamBulletin?: boolean;
  partnerChurchId?: string | null;
  assignedTeamIds?: string[];
  reason?: string;
  isActive?: boolean;
};

export async function isCampAccessAdmin(session: AuthSession): Promise<boolean> {
  const stored = await getStoredCampRoleState(session);
  if (stored.role === "camp_admin") return true;
  if (stored.available) return false;
  if (!canUseCampStubMode()) return false;
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
    editScopes: CAMP_EDIT_SCOPES,
    appAreaScopes: CAMP_APP_AREA_SCOPES,
    partnerChurches: [],
    teams: [],
    bootstrapActive: canUseCampStubMode() && isBootstrapCampAdmin(session)
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
    const [members, partnerChurches, teams, audit] = await Promise.all([
      supabase
        .from("camp_access_members")
        .select("user_id,email,camp_role,camp_edit_scope,app_area_scope,can_post_team_bulletin,partner_church_id,assigned_team_ids,is_active,updated_at")
        .order("email", { ascending: true }),
      loadPartnerChurchOptions(supabase),
      loadTeamOptions(supabase),
      supabase
        .from("camp_access_audit")
        .select("id,actor_email,target_email,action,old_role,new_role,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    if (members.error) throw members.error;
    const memberRows = members.data ?? [];
    const profilesById = await loadProfilesByUserId(supabase, memberRows.map((member) => member.user_id));
    return {
      ...base,
      bootstrapActive: false,
      available: true,
      partnerChurches,
      teams,
      members: memberRows.map((member) => toMember(member, profilesById.get(member.user_id))),
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

export async function onboardCampAccessMember(session: AuthSession, input: CampAccessOnboardingInput): Promise<OnboardingOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to Camp Admins." };
  }
  if (!CAMP_STORED_ROLES.includes(input.campRole)) {
    return { allowed: false, status: 400, error: "Unknown Camp access tier." };
  }
  const scopes = normalizeAccessScopes(input.campRole, input);
  if (!scopes.allowed) return scopes;
  const email = normalizeEmail(input.email);
  if (!email) return { allowed: false, status: 400, error: "Email is required." };
  if (session.isMock || !isSupabaseConfigured()) {
    return {
      allowed: false,
      status: 503,
      error: "Camp access onboarding requires migration 014 and a configured Supabase project."
    };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      allowed: false,
      status: 503,
      error: "Camp access onboarding requires the server-only SUPABASE_SERVICE_ROLE_KEY environment variable."
    };
  }

  const supabase = getSupabaseAdminClient();
  const authLookup = await findAuthUserByEmail(supabase, email);
  if (authLookup.error) return { allowed: false, status: 503, error: authLookup.error };

  if (!authLookup.user) {
    const invited = await inviteAuthUserByEmail(supabase, { email, displayName: input.displayName, redirectTo: input.inviteRedirectTo });
    if (invited.error || !invited.user) {
      return { allowed: false, status: 400, error: invited.error ?? "Unable to resolve user." };
    }

    const pending = await writePendingInvite(supabase, session, invited.user, email, input.campRole, scopes);
    if (!pending.allowed) return pending;
    return {
      allowed: true,
      status: 200,
      member: pending.member,
      onboarding: {
        status: "invite_sent",
        email,
        campRole: input.campRole,
        inviteSent: true,
        pendingInvite: true,
        profileRepaired: false,
        accessGranted: false
      }
    };
  }

  const existingAccess = await readExistingCampAccess(supabase, authLookup.user.id);
  if (!existingAccess.allowed) return existingAccess;

  const existingProfile = await readProfileByUserId(supabase, authLookup.user.id);
  if (!existingProfile.allowed) return existingProfile;

  if (existingAccess.member?.is_active === false && !existingProfile.profile) {
    const pending = await writePendingInvite(supabase, session, authLookup.user, email, input.campRole, scopes);
    if (!pending.allowed) return pending;
    return {
      allowed: true,
      status: 200,
      member: pending.member,
      onboarding: {
        status: "pending_invite",
        email,
        campRole: input.campRole,
        inviteSent: false,
        pendingInvite: true,
        profileRepaired: false,
        accessGranted: false
      }
    };
  }

  const profile = await repairProfileForAuthUser(supabase, authLookup.user, input.displayName);
  if (!profile.ok) return { allowed: false, status: 400, error: profile.error };

  const finalAdminCheck = await assertNotFinalActiveAdminChange(
    supabase,
    authLookup.user.id,
    existingAccess.member?.camp_role ?? null,
    existingAccess.member?.is_active ?? false,
    input.campRole,
    true
  );
  if (!finalAdminCheck.allowed) return finalAdminCheck;

  const { data, error } = await supabase
    .from("camp_access_members")
    .upsert(
      {
        user_id: authLookup.user.id,
        email: profile.profile.email,
        camp_role: input.campRole,
        camp_edit_scope: scopes.campEditScope,
        app_area_scope: scopes.appAreaScope,
        can_post_team_bulletin: scopes.canPostTeamBulletin,
        partner_church_id: scopes.partnerChurchId,
        assigned_team_ids: scopes.assignedTeamIds,
        last_change_reason: null,
        is_active: true,
        granted_by: session.user.id
      },
      { onConflict: "user_id" }
    )
    .select("user_id,email,camp_role,camp_edit_scope,app_area_scope,can_post_team_bulletin,partner_church_id,assigned_team_ids,is_active,updated_at")
    .single();

  if (error || !data) return { allowed: false, status: 400, error: "Camp access update failed." };

  const alreadyActive = existingAccess.member?.is_active === true && existingAccess.member.camp_role === input.campRole && !profile.repaired;
  const status = alreadyActive ? "already_active" : profile.repaired ? "profile_repaired" : "access_granted";
  return {
    allowed: true,
    status: 200,
    member: toMember(data, profile.profile),
    onboarding: {
      status,
      email: profile.profile.email,
      campRole: input.campRole,
      inviteSent: false,
      pendingInvite: false,
      profileRepaired: profile.repaired,
      accessGranted: true
    }
  };
}

export async function updateCampAccessMember(session: AuthSession, input: CampAccessUpdateInput): Promise<UpdateOk | Denied> {
  if (!(await isCampAccessAdmin(session))) {
    return { allowed: false, status: 403, error: "Camp access management is limited to Camp Admins." };
  }
  if (!CAMP_STORED_ROLES.includes(input.campRole)) {
    return { allowed: false, status: 400, error: "Unknown Camp access tier." };
  }
  const scopes = normalizeAccessScopes(input.campRole, input);
  if (!scopes.allowed) return scopes;
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
        camp_edit_scope: scopes.campEditScope,
        app_area_scope: scopes.appAreaScope,
        can_post_team_bulletin: scopes.canPostTeamBulletin,
        partner_church_id: scopes.partnerChurchId,
        assigned_team_ids: scopes.assignedTeamIds,
        last_change_reason: normalizeReason(input.reason),
        is_active: nextActive,
        granted_by: session.user.id
      },
      { onConflict: "user_id" }
    )
    .select("user_id,email,camp_role,camp_edit_scope,app_area_scope,can_post_team_bulletin,partner_church_id,assigned_team_ids,is_active,updated_at")
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
  supabase: CampAccessTableClient,
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

async function readExistingCampAccess(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string
): Promise<{ allowed: true; member: { camp_role: CampStoredRole; is_active: boolean } | null } | Denied> {
  const existing = await supabase
    .from("camp_access_members")
    .select("camp_role,is_active")
    .eq("user_id", userId)
    .maybeSingle<{ camp_role: CampStoredRole; is_active: boolean }>();
  if (existing.error) return { allowed: false, status: 503, error: "Camp access management requires migration 014." };
  return { allowed: true, member: existing.data ?? null };
}

async function readProfileByUserId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string
): Promise<{ allowed: true; profile: CampProfileRow | null } | Denied> {
  const existing = await supabase.from("profiles").select("id,email,full_name").eq("id", userId).maybeSingle<CampProfileRow>();
  if (existing.error) return { allowed: false, status: 503, error: "Unable to read the app profile for that Auth user." };
  return { allowed: true, profile: existing.data ?? null };
}

async function writePendingInvite(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  session: AuthSession,
  authUser: CampAuthUser,
  email: string,
  campRole: CampStoredRole,
  scopes: {
    campEditScope: CampEditScope;
    appAreaScope: CampAppAreaScope;
    canPostTeamBulletin: boolean;
    partnerChurchId: string | null;
    assignedTeamIds: string[];
  }
): Promise<{ allowed: true; member: CampAccessMember } | Denied> {
  if (!authUser.id) return { allowed: false, status: 400, error: "Unable to resolve user." };

  const { data, error } = await supabase
    .from("camp_access_members")
    .upsert(
      {
        user_id: authUser.id,
        email,
        camp_role: campRole,
        camp_edit_scope: scopes.campEditScope,
        app_area_scope: scopes.appAreaScope,
        can_post_team_bulletin: scopes.canPostTeamBulletin,
        partner_church_id: scopes.partnerChurchId,
        assigned_team_ids: scopes.assignedTeamIds,
        last_change_reason: null,
        is_active: false,
        granted_by: session.user.id
      },
      { onConflict: "user_id" }
    )
    .select("user_id,email,camp_role,camp_edit_scope,app_area_scope,can_post_team_bulletin,partner_church_id,assigned_team_ids,is_active,updated_at")
    .single();

  if (error || !data) return { allowed: false, status: 400, error: "Unable to save the pending Camp access invite." };
  return { allowed: true, member: toMember(data) };
}

async function loadProfilesByUserId(supabase: ReturnType<typeof getSupabaseAuthClient>, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const profilesById = new Map<string, CampProfileRow>();
  if (!uniqueIds.length) return profilesById;

  const profiles = await supabase.from("profiles").select("id,email,full_name").in("id", uniqueIds);
  if (profiles.error) return profilesById;
  for (const profile of profiles.data ?? []) {
    profilesById.set(profile.id, profile);
  }
  return profilesById;
}

function bootstrapMember(session: AuthSession): CampAccessMember {
  return {
    userId: session.user.id,
    email: BOOTSTRAP_CAMP_ADMIN_EMAIL,
    displayName: session.user.fullName,
    campRole: "camp_admin",
    campEditScope: "all_campers",
    appAreaScope: "admin",
    canPostTeamBulletin: true,
    partnerChurchId: null,
    assignedTeamIds: [],
    isActive: true,
    updatedAt: new Date().toISOString(),
    status: "bootstrap",
    bootstrap: true
  };
}

function toMember(
  row: {
    user_id: string;
    email: string;
    camp_role: string;
    camp_edit_scope?: CampEditScope | null;
    app_area_scope?: CampAppAreaScope | null;
    can_post_team_bulletin?: boolean | null;
    partner_church_id?: string | null;
    assigned_team_ids?: string[] | null;
    is_active: boolean;
    updated_at: string;
  },
  profile?: CampProfileRow | null
): CampAccessMember {
  const defaults = normalizeAccessScopes(row.camp_role as CampStoredRole, {});
  const fallback = defaults.allowed
    ? defaults
    : { campEditScope: "read_only" as CampEditScope, appAreaScope: "camp_only" as CampAppAreaScope, canPostTeamBulletin: false, partnerChurchId: null, assignedTeamIds: [] };
  return {
    userId: row.user_id,
    email: row.email,
    displayName: profile?.full_name ?? null,
    campRole: row.camp_role as CampStoredRole,
    campEditScope: row.camp_edit_scope ?? fallback.campEditScope,
    appAreaScope: row.app_area_scope ?? fallback.appAreaScope,
    canPostTeamBulletin: row.can_post_team_bulletin ?? fallback.canPostTeamBulletin,
    partnerChurchId: row.partner_church_id ?? null,
    assignedTeamIds: row.assigned_team_ids ?? [],
    isActive: row.is_active,
    updatedAt: row.updated_at,
    status: row.is_active ? "active" : profile ? "inactive" : "pending_invite"
  };
}

function toAudit(row: {
  id: string;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  old_role: string | null;
  new_role: string | null;
  reason?: string | null;
  created_at: string;
}): CampAccessAuditEntry {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    targetEmail: row.target_email,
    action: row.action,
    oldRole: row.old_role,
    newRole: row.new_role,
    reason: row.reason ?? null,
    createdAt: row.created_at
  };
}

function normalizeEmail(email: string) {
  return normalizeCampAccessEmail(email);
}

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function normalizeAccessScopes(
  campRole: CampStoredRole,
  input: Partial<Pick<CampAccessUpdateInput, "campEditScope" | "appAreaScope" | "canPostTeamBulletin" | "partnerChurchId" | "assignedTeamIds">>
):
  | {
    allowed: true;
    campEditScope: CampEditScope;
    appAreaScope: CampAppAreaScope;
    canPostTeamBulletin: boolean;
    partnerChurchId: string | null;
    assignedTeamIds: string[];
  }
  | Denied {
  const defaults = defaultScopesForRole(campRole);
  const campEditScope = input.campEditScope ?? defaults.campEditScope;
  const appAreaScope = input.appAreaScope ?? defaults.appAreaScope;
  if (!CAMP_EDIT_SCOPES.includes(campEditScope)) return { allowed: false, status: 400, error: "Unknown Camp edit rights." };
  if (!CAMP_APP_AREA_SCOPES.includes(appAreaScope)) return { allowed: false, status: 400, error: "Unknown app area access." };
  if (campRole !== "camp_admin" && appAreaScope === "admin") {
    return { allowed: false, status: 400, error: "Admin app access requires the Camp Admin role." };
  }
  const partnerChurchId = campEditScope === "partner_church_only"
    ? normalizeScopeId(input.partnerChurchId)
    : null;
  if (campEditScope === "partner_church_only" && !partnerChurchId) {
    return { allowed: false, status: 400, error: "Choose a partner church before assigning Partner Church Only edit rights." };
  }
  const assignedTeamIds = Array.from(new Set((input.assignedTeamIds ?? []).map((id) => id.trim()).filter(Boolean)));
  return {
    allowed: true,
    campEditScope,
    appAreaScope,
    canPostTeamBulletin: input.canPostTeamBulletin ?? defaults.canPostTeamBulletin,
    partnerChurchId,
    assignedTeamIds
  };
}

function defaultScopesForRole(campRole: CampStoredRole) {
  if (campRole === "camp_admin") {
    return { campEditScope: "all_campers" as CampEditScope, appAreaScope: "admin" as CampAppAreaScope, canPostTeamBulletin: true };
  }
  return { campEditScope: "read_only" as CampEditScope, appAreaScope: "camp_only" as CampAppAreaScope, canPostTeamBulletin: false };
}

async function loadPartnerChurchOptions(supabase: CampAccessTableClient): Promise<CampAccessPartnerChurchOption[]> {
  const names = new Set<string>();
  try {
    const [campers, staff] = await Promise.all([
      supabase.from("camp_campers").select("source_church").not("source_church", "is", null).limit(200),
      supabase.from("camp_staff").select("source_church").not("source_church", "is", null).limit(200)
    ]);
    for (const row of campers.data ?? []) addChurchName(names, (row as { source_church?: string | null }).source_church);
    for (const row of staff.data ?? []) addChurchName(names, (row as { source_church?: string | null }).source_church);
  } catch {
    return [];
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b)).map((name) => ({ id: normalizeScopeId(name), name }));
}

async function loadTeamOptions(supabase: CampAccessTableClient): Promise<CampAccessTeamOption[]> {
  try {
    const teams = await supabase
      .from("camp_teams")
      .select("id,name,color,display_order")
      .is("archived_at", null)
      .order("display_order", { ascending: true });
    if (teams.error) return [];
    return (teams.data ?? []).map((team: { id: string; name?: string | null; color?: string | null }) => ({
      id: team.id,
      name: team.name?.trim() || team.color?.trim() || "Unnamed team"
    }));
  } catch {
    return [];
  }
}

function addChurchName(names: Set<string>, value?: string | null) {
  const name = value?.trim();
  if (name) names.add(name);
}
