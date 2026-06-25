import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAdminClient, isSupabaseAdminConfigured, type AuthSession } from "@/lib/auth/server";
import type { CampStoredRole } from "@/lib/camp/access-roles";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

export type CampAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type CampProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export type CampProfileRepairResult =
  | {
      ok: true;
      profile: CampProfileRow;
      repaired: boolean;
      action: "created" | "updated" | "relinked" | "unchanged";
    }
  | { ok: false; error: string };

type PendingCampAccessRow = {
  user_id: string;
  email: string;
  camp_role: CampStoredRole;
  is_active: boolean;
};

export function normalizeCampAccessEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function findAuthUserByEmail(
  supabase: SupabaseAdminClient,
  email: string
): Promise<{ user: CampAuthUser | null; error: string | null }> {
  const normalizedEmail = normalizeCampAccessEmail(email);
  if (!normalizedEmail) return { user: null, error: "Email is required." };

  try {
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return { user: null, error: "Unable to check Supabase Auth users." };
      const users = data.users as CampAuthUser[];
      const match = users.find((user) => normalizeCampAccessEmail(user.email) === normalizedEmail);
      if (match) return { user: match, error: null };
      if (users.length < 1000) return { user: null, error: null };
    }
  } catch {
    return { user: null, error: "Unable to check Supabase Auth users." };
  }

  return { user: null, error: "Unable to resolve that email in the current Auth user list." };
}

export async function inviteAuthUserByEmail(
  supabase: SupabaseAdminClient,
  input: { email: string; displayName?: string }
): Promise<{ user: CampAuthUser | null; error: string | null }> {
  const email = normalizeCampAccessEmail(input.email);
  if (!email) return { user: null, error: "Email is required." };

  const displayName = normalizeDisplayName(input.displayName);
  const options = displayName ? { data: { full_name: displayName } } : undefined;

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, options);
    if (error || !data.user) return { user: null, error: "Supabase could not send the invite email." };
    return { user: data.user as CampAuthUser, error: null };
  } catch {
    return { user: null, error: "Supabase could not send the invite email." };
  }
}

export async function repairProfileForAuthUser(
  supabase: SupabaseAdminClient,
  authUser: CampAuthUser,
  displayName?: string
): Promise<CampProfileRepairResult> {
  const email = normalizeCampAccessEmail(authUser.email);
  if (!authUser.id || !email) return { ok: false, error: "Unable to resolve a Supabase Auth user for that email." };

  const requestedDisplayName = normalizeDisplayName(displayName);
  const fallbackFullName = displayNameForProfile(authUser, displayName, email);
  const byUserId = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .eq("id", authUser.id)
    .maybeSingle<CampProfileRow>();

  if (byUserId.error) return { ok: false, error: "Unable to read the app profile for that Auth user." };
  if (byUserId.data) {
    const updates: Partial<Pick<CampProfileRow, "email" | "full_name">> = {};
    if (normalizeCampAccessEmail(byUserId.data.email) !== email) updates.email = email;
    if (requestedDisplayName && byUserId.data.full_name !== requestedDisplayName) updates.full_name = requestedDisplayName;

    if (!Object.keys(updates).length) {
      return { ok: true, profile: byUserId.data, repaired: false, action: "unchanged" };
    }

    const updated = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", authUser.id)
      .select("id,email,full_name")
      .single<CampProfileRow>();

    if (updated.error || !updated.data) return { ok: false, error: "Unable to update the app profile for that Auth user." };
    return { ok: true, profile: updated.data, repaired: true, action: "updated" };
  }

  const byEmail = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .ilike("email", email)
    .maybeSingle<CampProfileRow>();

  if (byEmail.error) return { ok: false, error: "Unable to read the app profile for that email." };
  if (byEmail.data) {
    const fullName = requestedDisplayName ?? byEmail.data.full_name ?? fallbackFullName;
    const relinked = await supabase
      .from("profiles")
      .update({ id: authUser.id, email, full_name: fullName })
      .eq("id", byEmail.data.id)
      .select("id,email,full_name")
      .single<CampProfileRow>();

    if (relinked.error || !relinked.data) {
      return { ok: false, error: "A profile for that email exists but could not be linked to the Auth user." };
    }
    return { ok: true, profile: relinked.data, repaired: true, action: "relinked" };
  }

  const inserted = await supabase
    .from("profiles")
    .insert({
      id: authUser.id,
      email,
      full_name: fallbackFullName,
      role: "staff"
    })
    .select("id,email,full_name")
    .single<CampProfileRow>();

  if (inserted.error || !inserted.data) return { ok: false, error: "Unable to create the app profile for that Auth user." };
  return { ok: true, profile: inserted.data, repaired: true, action: "created" };
}

export async function activatePendingCampInviteForSession(session: AuthSession): Promise<CampStoredRole | null> {
  if (session.isMock || !isSupabaseConfigured() || !isSupabaseAdminConfigured()) return null;

  const sessionEmail = normalizeCampAccessEmail(session.user.email);
  if (!session.user.id || !sessionEmail) return null;

  try {
    const supabase = getSupabaseAdminClient();
    const pending = await supabase
      .from("camp_access_members")
      .select("user_id,email,camp_role,is_active")
      .eq("user_id", session.user.id)
      .eq("is_active", false)
      .maybeSingle<PendingCampAccessRow>();

    if (pending.error || !pending.data) return null;
    if (normalizeCampAccessEmail(pending.data.email) !== sessionEmail) return null;

    const authUser = await supabase.auth.admin.getUserById(session.user.id);
    const user = authUser.data?.user as CampAuthUser | null;
    if (authUser.error || !user || normalizeCampAccessEmail(user.email) !== sessionEmail) return null;

    const profile = await repairProfileForAuthUser(supabase, user, session.user.fullName);
    if (!profile.ok) return null;

    const activated = await supabase
      .from("camp_access_members")
      .update({ email: sessionEmail, is_active: true })
      .eq("user_id", session.user.id)
      .eq("is_active", false)
      .select("camp_role")
      .single<{ camp_role: CampStoredRole }>();

    if (activated.error || !activated.data) return null;
    return activated.data.camp_role;
  } catch {
    return null;
  }
}

function displayNameForProfile(authUser: CampAuthUser, preferredName: string | undefined, email: string) {
  return normalizeDisplayName(preferredName) ?? metadataString(authUser.user_metadata, "full_name") ?? metadataString(authUser.user_metadata, "name") ?? email;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value !== "string") return null;
  return normalizeDisplayName(value);
}

function normalizeDisplayName(displayName: string | undefined) {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : undefined;
}
