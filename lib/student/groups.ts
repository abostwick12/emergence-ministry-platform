import { randomBytes } from "node:crypto";

import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";

export type StudentGroupSummary = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: string;
};

export type StudentGroupInviteSummary = {
  id: string;
  groupId: string;
  groupName: string;
  code: string;
  label: string;
  joinUrl: string;
  isActive: boolean;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
};

export type StudentGroupMemberSummary = {
  id: string;
  groupId: string;
  groupName: string;
  displayName: string;
  status: "active" | "inactive";
  joinedAt: string;
};

export type StudentGroupLeaderState = {
  liveStorage: boolean;
  message: string;
  groups: StudentGroupSummary[];
  invites: StudentGroupInviteSummary[];
  members: StudentGroupMemberSummary[];
};

export type PublicStudentInvite = {
  ok: true;
  code: string;
  groupName: string;
  ministryName: string;
  expiresAt: string | null;
};

export type JoinStudentGroupInput = {
  code: string;
  fullName: string;
  email: string;
  password: string;
};

export type JoinStudentGroupResult =
  | {
      ok: true;
      session: {
        accessToken: string;
        refreshToken: string;
      };
      user: {
        id: string;
        email: string;
        fullName: string;
        role: "student";
      };
      redirectTo: "/student";
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type StudentGroupRow = {
  id: string;
  ministry_id: string;
  name: string;
  slug: string;
  created_at: string;
};

type StudentGroupInviteRow = {
  id: string;
  ministry_id: string;
  group_id: string;
  code: string;
  label: string;
  is_active: boolean;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
};

type StudentGroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  status: "active" | "inactive";
  joined_at: string;
};

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_INVITE_LABEL_LENGTH = 80;
const DEFAULT_INVITE_DAYS = 21;
const DEFAULT_MAX_USES = 40;

export function canManageStudentGroups(session: AuthSession) {
  const role = session.user.role.trim().toLowerCase();
  return role === "admin" || role === "leader";
}

export async function getStudentGroupLeaderState(session: AuthSession, origin = ""): Promise<StudentGroupLeaderState> {
  if (!isLiveStudentGroupStorageReady(session)) {
    return {
      liveStorage: false,
      message: "Student access is not connected yet. Finish launch access setup before sharing invite links.",
      groups: [],
      invites: [],
      members: []
    };
  }

  if (!canManageStudentGroups(session)) {
    return {
      liveStorage: true,
      message: "Only leaders can manage student invite links.",
      groups: [],
      invites: [],
      members: []
    };
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) {
    return {
      liveStorage: false,
      message: "Your ministry profile is missing, so student invite links cannot be loaded yet.",
      groups: [],
      invites: [],
      members: []
    };
  }

  const supabase = getSupabaseAdminClient();
  const [groupsResult, invitesResult, membersResult] = await Promise.all([
    supabase
      .from("student_groups")
      .select("id,ministry_id,name,slug,created_at")
      .eq("ministry_id", ministryId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<StudentGroupRow[]>(),
    supabase
      .from("student_group_invites")
      .select("id,ministry_id,group_id,code,label,is_active,max_uses,use_count,expires_at,created_at")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<StudentGroupInviteRow[]>(),
    supabase
      .from("student_group_members")
      .select("id,group_id,user_id,display_name,status,joined_at")
      .eq("ministry_id", ministryId)
      .order("joined_at", { ascending: false })
      .limit(30)
      .returns<StudentGroupMemberRow[]>()
  ]);

  throwIfSupabaseError(groupsResult.error);
  throwIfSupabaseError(invitesResult.error);
  throwIfSupabaseError(membersResult.error);

  return toLeaderState(groupsResult.data ?? [], invitesResult.data ?? [], membersResult.data ?? [], origin);
}

export async function createStudentGroupInvite(
  session: AuthSession,
  input: {
    groupId?: string;
    groupName?: string;
    label?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  },
  origin = ""
): Promise<StudentGroupLeaderState> {
  if (!canManageStudentGroups(session)) {
    throw new StudentGroupError("Only leaders can create student invite links.", 403, "forbidden");
  }
  if (!isLiveStudentGroupStorageReady(session)) {
    throw new StudentGroupError("Student access is not connected yet. Finish launch access setup before creating invite links.", 503, "live_storage_not_configured");
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) {
    throw new StudentGroupError("Your ministry profile is missing, so student invite links cannot be created yet.", 409, "missing_ministry");
  }

  const supabase = getSupabaseAdminClient();
  const group = await resolveInviteGroup(supabase, ministryId, session, input);
  const label = normalizeOptionalText(input.label, MAX_INVITE_LABEL_LENGTH) || "Student invite";
  const maxUses = normalizeMaxUses(input.maxUses);
  const expiresAt = normalizeExpiry(input.expiresAt);
  const code = `${group.slug}-${randomBytes(4).toString("hex")}`.slice(0, 80);

  const insert = await supabase
    .from("student_group_invites")
    .insert({
      ministry_id: ministryId,
      group_id: group.id,
      code,
      label,
      max_uses: maxUses,
      expires_at: expiresAt,
      created_by_user_id: session.user.id
    })
    .select("id")
    .single<{ id: string }>();

  throwIfSupabaseError(insert.error);
  return getStudentGroupLeaderState(session, origin);
}

export async function getPrimaryStudentGroupId(session: AuthSession): Promise<string | undefined> {
  if (!isLiveStudentGroupStorageReady(session)) return undefined;

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return undefined;

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("student_group_members")
    .select("group_id")
    .eq("ministry_id", ministryId)
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ group_id: string }>();

  if (result.error) return undefined;
  return result.data?.group_id;
}

export async function getPublicStudentInvite(code: string): Promise<PublicStudentInvite | { ok: false; reason: string }> {
  const normalizedCode = normalizeInviteCode(code);
  if (!normalizedCode || !isSupabaseAdminConfigured()) return { ok: false, reason: "not_found" };

  const invite = await loadInvite(normalizedCode);
  if (!invite.ok) return invite;

  return {
    ok: true,
    code: invite.invite.code,
    groupName: invite.group.name,
    ministryName: invite.ministryName,
    expiresAt: invite.invite.expires_at
  };
}

export async function joinStudentGroupWithInvite(input: JoinStudentGroupInput): Promise<JoinStudentGroupResult> {
  if (!isSupabaseAdminConfigured() || !isSupabaseConfigured()) {
    return { ok: false, status: 503, error: "Student access is not connected yet. Ask your leader for the launch invite once setup is ready." };
  }

  const code = normalizeInviteCode(input.code);
  let fullName = "";
  try {
    fullName = normalizeRequiredText(input.fullName, "Name", MAX_DISPLAY_NAME_LENGTH);
  } catch (error) {
    if (error instanceof StudentGroupError) return { ok: false, status: error.status, error: error.message };
    throw error;
  }
  const email = normalizeEmail(input.email);
  const password = input.password ?? "";

  if (!code) return { ok: false, status: 404, error: "This student invite link is not available." };
  if (!email) return { ok: false, status: 400, error: "Use a valid email address." };
  if (password.length < 8) return { ok: false, status: 400, error: "Password must be at least 8 characters." };
  if (password.length > 128) return { ok: false, status: 400, error: "Password must be 128 characters or fewer." };

  const loaded = await loadInvite(code);
  if (!loaded.ok) return { ok: false, status: 404, error: "This student invite link is not available." };

  const { invite, group } = loaded;
  const supabase = getSupabaseAdminClient();
  const auth = getSupabaseAuthClient();
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "student"
    }
  });

  let userId = created.data.user?.id;
  if (created.error || !userId) {
    const signInExisting = await auth.auth.signInWithPassword({ email, password });
    if (signInExisting.error || !signInExisting.data.user || !signInExisting.data.session) {
      return {
        ok: false,
        status: 409,
        error: "That email may already have an account. Try logging in, or ask your leader for help."
      };
    }
    userId = signInExisting.data.user.id;
  }

  await updateStudentAuthMetadata(supabase, userId, fullName);
  await upsertStudentProfile(supabase, {
    id: userId,
    ministryId: invite.ministry_id,
    email,
    fullName
  });

  const existingMembership = await supabase
    .from("student_group_members")
    .select("id,status")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; status: string }>();

  throwIfSupabaseError(existingMembership.error);

  const membership = await supabase.from("student_group_members").upsert(
    {
      ministry_id: invite.ministry_id,
      group_id: group.id,
      user_id: userId,
      display_name: fullName,
      status: "active"
    },
    { onConflict: "group_id,user_id" }
  );
  throwIfSupabaseError(membership.error);

  if (!existingMembership.data || existingMembership.data.status !== "active") {
    const usage = await supabase
      .from("student_group_invites")
      .update({ use_count: invite.use_count + 1 })
      .eq("id", invite.id)
      .eq("use_count", invite.use_count);
    throwIfSupabaseError(usage.error);
  }

  const signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || !signedIn.data.user.email) {
    return {
      ok: false,
      status: 409,
      error: "Your student access was created, but sign-in did not finish. Use the login page with this email and password."
    };
  }

  return {
    ok: true,
    session: {
      accessToken: signedIn.data.session.access_token,
      refreshToken: signedIn.data.session.refresh_token
    },
    user: {
      id: signedIn.data.user.id,
      email: signedIn.data.user.email,
      fullName,
      role: "student"
    },
    redirectTo: "/student"
  };
}

function isLiveStudentGroupStorageReady(session: AuthSession) {
  return !session.isMock && Boolean(session.accessToken) && isSupabaseConfigured() && isSupabaseAdminConfigured();
}

async function resolveInviteGroup(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  ministryId: string,
  session: AuthSession,
  input: { groupId?: string; groupName?: string }
) {
  const groupId = normalizeOptionalText(input.groupId, 80);
  if (groupId) {
    const existing = await supabase
      .from("student_groups")
      .select("id,ministry_id,name,slug,created_at")
      .eq("ministry_id", ministryId)
      .eq("id", groupId)
      .single<StudentGroupRow>();
    throwIfSupabaseError(existing.error);
    if (!existing.data) throw new StudentGroupError("Choose an active student group.", 400, "missing_group");
    return existing.data;
  }

  const name = normalizeRequiredText(input.groupName ?? "", "Group name", MAX_GROUP_NAME_LENGTH);
  const slug = slugify(name);
  const existing = await supabase
    .from("student_groups")
    .select("id,ministry_id,name,slug,created_at")
    .eq("ministry_id", ministryId)
    .eq("slug", slug)
    .maybeSingle<StudentGroupRow>();
  throwIfSupabaseError(existing.error);
  if (existing.data) return existing.data;

  const inserted = await supabase
    .from("student_groups")
    .insert({
      ministry_id: ministryId,
      name,
      slug,
      created_by_user_id: session.user.id
    })
    .select("id,ministry_id,name,slug,created_at")
    .single<StudentGroupRow>();
  throwIfSupabaseError(inserted.error);
  if (!inserted.data) throw new StudentGroupError("Student group could not be created.", 500, "missing_group");
  return inserted.data;
}

async function loadInvite(code: string): Promise<
  | {
      ok: true;
      invite: StudentGroupInviteRow;
      group: StudentGroupRow;
      ministryName: string;
    }
  | { ok: false; reason: string }
> {
  const supabase = getSupabaseAdminClient();
  const inviteResult = await supabase
    .from("student_group_invites")
    .select("id,ministry_id,group_id,code,label,is_active,max_uses,use_count,expires_at,created_at")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle<StudentGroupInviteRow>();

  if (inviteResult.error || !inviteResult.data) return { ok: false, reason: "not_found" };
  const invite = inviteResult.data;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (invite.max_uses != null && invite.use_count >= invite.max_uses) return { ok: false, reason: "full" };

  const [groupResult, ministryResult] = await Promise.all([
    supabase
      .from("student_groups")
      .select("id,ministry_id,name,slug,created_at")
      .eq("id", invite.group_id)
      .eq("is_active", true)
      .single<StudentGroupRow>(),
    supabase.from("ministries").select("name").eq("id", invite.ministry_id).maybeSingle<{ name: string }>()
  ]);

  if (groupResult.error || !groupResult.data) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    invite,
    group: groupResult.data,
    ministryName: ministryResult.data?.name ?? "Lead Emergence"
  };
}

async function updateStudentAuthMetadata(supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string, fullName: string) {
  const result = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      full_name: fullName,
      role: "student"
    }
  });
  if (result.error) throw new StudentGroupError("Student access was created, but profile metadata could not be updated.", 500, "auth_metadata_failed");
}

async function upsertStudentProfile(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  input: { id: string; ministryId: string; email: string; fullName: string }
) {
  const result = await supabase.from("profiles").upsert(
    {
      id: input.id,
      ministry_id: input.ministryId,
      email: input.email,
      full_name: input.fullName,
      role: "student"
    },
    { onConflict: "id" }
  );
  throwIfSupabaseError(result.error);
}

function toLeaderState(
  groupRows: StudentGroupRow[],
  inviteRows: StudentGroupInviteRow[],
  memberRows: StudentGroupMemberRow[],
  origin: string
): StudentGroupLeaderState {
  const groupNames = new Map(groupRows.map((group) => [group.id, group.name]));
  const memberCounts = new Map<string, number>();
  for (const member of memberRows) {
    if (member.status !== "active") continue;
    memberCounts.set(member.group_id, (memberCounts.get(member.group_id) ?? 0) + 1);
  }

  return {
    liveStorage: true,
    message: "Student self-join links are ready.",
    groups: groupRows.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      memberCount: memberCounts.get(group.id) ?? 0,
      createdAt: group.created_at
    })),
    invites: inviteRows.map((invite) => ({
      id: invite.id,
      groupId: invite.group_id,
      groupName: groupNames.get(invite.group_id) ?? "Student group",
      code: invite.code,
      label: invite.label,
      joinUrl: joinUrlForCode(origin, invite.code),
      isActive: invite.is_active,
      maxUses: invite.max_uses,
      useCount: invite.use_count,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at
    })),
    members: memberRows.map((member) => ({
      id: member.id,
      groupId: member.group_id,
      groupName: groupNames.get(member.group_id) ?? "Student group",
      displayName: member.display_name,
      status: member.status,
      joinedAt: member.joined_at
    }))
  };
}

function joinUrlForCode(origin: string, code: string) {
  return origin ? `${origin.replace(/\/$/, "")}/join/${code}` : `/join/${code}`;
}

function normalizeInviteCode(code: string) {
  const normalized = code.trim().toLowerCase();
  return /^[a-z0-9-]{8,80}$/.test(normalized) ? normalized : "";
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new StudentGroupError(`${label} is required.`, 400, "required");
  if (normalized.length > maxLength) throw new StudentGroupError(`${label} is too long.`, 400, "too_long");
  return normalized;
}

function normalizeOptionalText(value: string | undefined | null, maxLength: number) {
  if (!value) return "";
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new StudentGroupError("This field is too long.", 400, "too_long");
  return normalized;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeMaxUses(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return DEFAULT_MAX_USES;
  const rounded = Math.floor(value);
  if (rounded < 1 || rounded > 500) throw new StudentGroupError("Invite use limit must be between 1 and 500.", 400, "invalid_limit");
  return rounded;
}

function normalizeExpiry(value: string | null | undefined) {
  if (!value) {
    const expires = new Date();
    expires.setDate(expires.getDate() + DEFAULT_INVITE_DAYS);
    return expires.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) {
    throw new StudentGroupError("Invite expiration must be a future date.", 400, "invalid_expiry");
  }
  return parsed.toISOString();
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `group-${randomBytes(3).toString("hex")}`;
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new StudentGroupError(error.message, 500, "supabase_error");
  }
}

export class StudentGroupError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
