import { randomBytes } from "node:crypto";

import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolvePersonName } from "@/lib/auth/display-name";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import type { Role } from "@/lib/types";

export type RegistrationInviteRole = Exclude<Role, "admin">;

export type PlatformRegistrationInviteSummary = {
  id: string;
  code: string;
  label: string;
  role: RegistrationInviteRole;
  canSaveChanges: boolean;
  aiEnabled: boolean;
  aiMonthlyLimit: number | null;
  isActive: boolean;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  joinUrl: string;
};

export type PublicPlatformRegistrationInvite = {
  ok: true;
  code: string;
  label: string;
  role: RegistrationInviteRole;
  ministryName: string;
  expiresAt: string | null;
};

export type RegisterWithInviteInput = {
  code: string;
  fullName: string;
  email: string;
  password: string;
};

export type RegisterWithInviteResult =
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
        role: RegistrationInviteRole;
      };
      redirectTo: "/dashboard" | "/student";
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type InviteRow = {
  id: string;
  ministry_id: string;
  code: string;
  label: string;
  role: string;
  can_save_changes: boolean | null;
  ai_enabled: boolean | null;
  ai_monthly_limit: number | null;
  is_active: boolean;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  created_at: string;
};

const DEFAULT_INVITE_DAYS = 14;
const DEFAULT_MAX_USES = 10;
const MAX_LABEL_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 80;

export async function listPlatformRegistrationInvites(session: AuthSession, origin = "") {
  if (!canManageRegistrationInvites(session)) return { allowed: false as const, status: 403, error: "Platform administrator access is required." };
  if (!isLiveRegistrationStorageReady(session)) return { allowed: true as const, available: false, invites: [] as PlatformRegistrationInviteSummary[] };

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return { allowed: true as const, available: false, invites: [] as PlatformRegistrationInviteSummary[] };

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("platform_registration_invites")
    .select("id,ministry_id,code,label,role,can_save_changes,ai_enabled,ai_monthly_limit,is_active,max_uses,use_count,expires_at,created_at")
    .eq("ministry_id", ministryId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<InviteRow[]>();

  if (result.error) return { allowed: true as const, available: false, invites: [] as PlatformRegistrationInviteSummary[] };
  return {
    allowed: true as const,
    available: true,
    invites: (result.data ?? []).map((invite) => toInviteSummary(invite, origin))
  };
}

export async function createPlatformRegistrationInvite(
  session: AuthSession,
  input: {
    label?: string;
    role?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    canSaveChanges?: boolean;
    aiEnabled?: boolean;
    aiMonthlyLimit?: number | null;
  },
  origin = ""
) {
  if (!canManageRegistrationInvites(session)) {
    throw new PlatformRegistrationError("Platform administrator access is required.", 403, "forbidden");
  }
  if (!isLiveRegistrationStorageReady(session)) {
    throw new PlatformRegistrationError("Registration links require Supabase Auth and service-role access.", 503, "live_storage_not_configured");
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) {
    throw new PlatformRegistrationError("Your ministry profile is missing, so registration links cannot be created yet.", 409, "missing_ministry");
  }

  const role = normalizeInviteRole(input.role);
  const label = normalizeOptionalText(input.label, MAX_LABEL_LENGTH) || `${roleLabel(role)} registration`;
  const code = `platform-${randomBytes(5).toString("hex")}`;
  const maxUses = normalizeMaxUses(input.maxUses);
  const expiresAt = normalizeExpiry(input.expiresAt);
  const aiMonthlyLimit = normalizeAiMonthlyLimit(input.aiMonthlyLimit);
  if (aiMonthlyLimit === "invalid") {
    throw new PlatformRegistrationError("Monthly AI request limit must be between 1 and 1000.", 400, "invalid_ai_limit");
  }

  const supabase = getSupabaseAdminClient();
  const insert = await supabase
    .from("platform_registration_invites")
    .insert({
      ministry_id: ministryId,
      code,
      label,
      role,
      can_save_changes: input.canSaveChanges === true,
      ai_enabled: input.aiEnabled === true,
      ai_monthly_limit: aiMonthlyLimit,
      max_uses: maxUses,
      expires_at: expiresAt,
      created_by_user_id: session.user.id,
      created_by_email: session.user.email
    })
    .select("id,ministry_id,code,label,role,can_save_changes,ai_enabled,ai_monthly_limit,is_active,max_uses,use_count,expires_at,created_at")
    .single<InviteRow>();

  if (insert.error || !insert.data) {
    throw new PlatformRegistrationError("Registration link could not be created.", 503, "supabase_error");
  }

  return toInviteSummary(insert.data, origin);
}

export async function getPublicPlatformRegistrationInvite(code: string): Promise<PublicPlatformRegistrationInvite | { ok: false; reason: string }> {
  const loaded = await loadInvite(normalizeInviteCode(code));
  if (!loaded.ok) return loaded;

  return {
    ok: true,
    code: loaded.invite.code,
    label: loaded.invite.label,
    role: normalizeInviteRole(loaded.invite.role),
    ministryName: loaded.ministryName,
    expiresAt: loaded.invite.expires_at
  };
}

export async function registerWithPlatformInvite(input: RegisterWithInviteInput): Promise<RegisterWithInviteResult> {
  if (!isSupabaseAdminConfigured() || !isSupabaseConfigured()) {
    return { ok: false, status: 503, error: "Registration links are not connected yet. Ask an administrator for help." };
  }

  const code = normalizeInviteCode(input.code);
  if (!code) return { ok: false, status: 404, error: "This registration link is not available." };

  let fullName = "";
  try {
    fullName = normalizeRequiredText(input.fullName, "Name", MAX_DISPLAY_NAME_LENGTH);
  } catch (error) {
    if (error instanceof PlatformRegistrationError) return { ok: false, status: error.status, error: error.message };
    throw error;
  }

  const email = normalizeEmail(input.email);
  const password = input.password ?? "";
  if (!email) return { ok: false, status: 400, error: "Use a valid email address." };
  if (password.length < 8) return { ok: false, status: 400, error: "Password must be at least 8 characters." };
  if (password.length > 128) return { ok: false, status: 400, error: "Password must be 128 characters or fewer." };

  const loaded = await loadInvite(code);
  if (!loaded.ok) return { ok: false, status: 404, error: "This registration link is not available." };

  const invite = loaded.invite;
  const role = normalizeInviteRole(invite.role);
  const supabase = getSupabaseAdminClient();
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role
    },
    app_metadata: {
      role
    }
  });

  if (created.error || !created.data.user?.id) {
    return {
      ok: false,
      status: 409,
      error: "That email may already have an account. Try the login page, or ask an administrator for help."
    };
  }

  const user = created.data.user;
  const profile = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ministry_id: invite.ministry_id,
      email: user.email ?? email,
      full_name: fullName,
      role
    },
    { onConflict: "id" }
  );
  if (profile.error) return { ok: false, status: 503, error: "Your account was created, but profile setup did not finish. Ask an administrator to finish access setup." };

  const active = await supabase
    .from("platform_user_access")
    .upsert({ user_id: user.id, is_active: true, can_save_changes: invite.can_save_changes === true, updated_by: null }, { onConflict: "user_id" });
  if (active.error) return { ok: false, status: 503, error: "Your account was created, but platform access did not finish. Ask an administrator to finish access setup." };

  const aiAccess = await supabase.from("platform_ai_access").upsert(
    {
      user_id: user.id,
      ai_enabled: invite.ai_enabled === true,
      monthly_request_limit: invite.ai_monthly_limit,
      updated_by: null
    },
    { onConflict: "user_id" }
  );
  if (aiAccess.error) return { ok: false, status: 503, error: "Your account was created, but AI access setup did not finish. Ask an administrator to finish access setup." };

  const usage = await supabase
    .from("platform_registration_invites")
    .update({ use_count: invite.use_count + 1 })
    .eq("id", invite.id)
    .eq("use_count", invite.use_count);
  if (usage.error) return { ok: false, status: 503, error: "Your account was created, but the registration link could not be marked used." };

  const auth = getSupabaseAuthClient();
  const signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || !signedIn.data.user.email) {
    return {
      ok: false,
      status: 409,
      error: "Your account was created, but sign-in did not finish. Use the login page with this email and password."
    };
  }

  return {
    ok: true,
    session: {
      accessToken: signedIn.data.session.access_token,
      refreshToken: signedIn.data.session.refresh_token
    },
    user: {
      id: user.id,
      email: signedIn.data.user.email,
      fullName: resolvePersonName(fullName, signedIn.data.user.email),
      role
    },
    redirectTo: role === "student" ? "/student" : "/dashboard"
  };
}

function canManageRegistrationInvites(session: AuthSession) {
  return !session.isGuest && session.user.role.trim().toLowerCase() === "admin";
}

function isLiveRegistrationStorageReady(session: AuthSession) {
  return !session.isMock && Boolean(session.accessToken) && isSupabaseConfigured() && isSupabaseAdminConfigured();
}

async function loadInvite(code: string): Promise<
  | { ok: true; invite: InviteRow; ministryName: string }
  | { ok: false; reason: string }
> {
  if (!code || !isSupabaseAdminConfigured()) return { ok: false, reason: "not_found" };

  const supabase = getSupabaseAdminClient();
  const inviteResult = await supabase
    .from("platform_registration_invites")
    .select("id,ministry_id,code,label,role,can_save_changes,ai_enabled,ai_monthly_limit,is_active,max_uses,use_count,expires_at,created_at")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle<InviteRow>();

  if (inviteResult.error || !inviteResult.data) return { ok: false, reason: "not_found" };
  const invite = inviteResult.data;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (invite.use_count >= invite.max_uses) return { ok: false, reason: "full" };

  const ministry = await supabase.from("ministries").select("name").eq("id", invite.ministry_id).maybeSingle<{ name: string }>();
  return {
    ok: true,
    invite,
    ministryName: ministry.data?.name ?? "Lead Emergence"
  };
}

function toInviteSummary(invite: InviteRow, origin: string): PlatformRegistrationInviteSummary {
  return {
    id: invite.id,
    code: invite.code,
    label: invite.label,
    role: normalizeInviteRole(invite.role),
    canSaveChanges: invite.can_save_changes === true,
    aiEnabled: invite.ai_enabled === true,
    aiMonthlyLimit: invite.ai_monthly_limit,
    isActive: invite.is_active,
    maxUses: invite.max_uses,
    useCount: invite.use_count,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    joinUrl: registrationUrlForCode(origin, invite.code)
  };
}

function registrationUrlForCode(origin: string, code: string) {
  return origin ? `${origin.replace(/\/$/, "")}/register/${code}` : `/register/${code}`;
}

function normalizeInviteCode(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^platform-[a-f0-9]{10}$/.test(normalized) ? normalized : "";
}

function normalizeInviteRole(value: string | null | undefined): RegistrationInviteRole {
  switch ((value ?? "").trim().toLowerCase()) {
    case "student":
      return "student";
    case "parent":
      return "parent";
    default:
      return "leader";
  }
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new PlatformRegistrationError(`${label} is required.`, 400, "required");
  if (normalized.length > maxLength) throw new PlatformRegistrationError(`${label} is too long.`, 400, "too_long");
  return normalized;
}

function normalizeOptionalText(value: string | undefined | null, maxLength: number) {
  if (!value) return "";
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new PlatformRegistrationError("This field is too long.", 400, "too_long");
  return normalized;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeMaxUses(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return DEFAULT_MAX_USES;
  const rounded = Math.floor(value);
  if (rounded < 1 || rounded > 500) throw new PlatformRegistrationError("Registration link use limit must be between 1 and 500.", 400, "invalid_limit");
  return rounded;
}

function normalizeAiMonthlyLimit(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.floor(value);
  if (rounded < 1 || rounded > 1000) return "invalid";
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
    throw new PlatformRegistrationError("Registration link expiration must be a future date.", 400, "invalid_expiry");
  }
  return parsed.toISOString();
}

function roleLabel(role: RegistrationInviteRole) {
  if (role === "student") return "Student";
  if (role === "parent") return "Parent";
  return "Leader";
}

export class PlatformRegistrationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
