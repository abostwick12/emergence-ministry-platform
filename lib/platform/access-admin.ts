import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolvePersonName } from "@/lib/auth/display-name";
import { defaultAiAccessForRole, getAiAccessForUsers, updateAiAccessForUser, type PlatformAiAccess } from "@/lib/platform/ai-access";
import * as mockStore from "@/lib/store";
import type { Role } from "@/lib/types";
import {
  defaultGuestPublicPageKeys,
  defaultPageAccessForRole,
  findPlatformPageByPath,
  getPlatformPage,
  isPlatformPageKey,
  platformPages,
  type PlatformPageKey
} from "@/lib/platform/page-registry";

export const platformRoles: Role[] = ["admin", "leader", "student", "parent"];

export type PlatformAccessMember = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  canSaveChanges: boolean;
  aiAccess: PlatformAiAccess;
  currentUser: boolean;
  pageAccess: Record<PlatformPageKey, boolean>;
};

export type PlatformAccessPage = {
  key: PlatformPageKey;
  label: string;
  path: string;
  description: string;
  guestEligible: boolean;
  guestPublic: boolean;
};

type PlatformAccessDenied = { allowed: false; status: number; error: string };
type PlatformAccessList = {
  allowed: true;
  available: boolean;
  storage: "supabase" | "preview";
  pages: PlatformAccessPage[];
  members: PlatformAccessMember[];
};
type PlatformAccessUpdate = { allowed: true; member?: PlatformAccessMember; pages?: PlatformAccessPage[]; storage: "supabase" | "preview" };

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type UserAccessRow = {
  user_id: string;
  is_active: boolean | null;
  can_save_changes?: boolean | null;
};

type UserAccessState = {
  active: boolean;
  canSaveChanges: boolean;
};

type UserPagePermissionRow = {
  user_id: string;
  page_key: string;
  is_allowed: boolean | null;
};

type GuestPagePermissionRow = {
  page_key: string;
  is_public: boolean | null;
};

const globalState = globalThis as typeof globalThis & {
  __leadEmergencePlatformAccessPreview?: {
    members: Map<string, PlatformAccessMember>;
    guestPublicPages: Set<PlatformPageKey>;
  };
};

export async function listPlatformAccess(session: AuthSession): Promise<PlatformAccessDenied | PlatformAccessList> {
  const denied = requirePlatformAdmin(session);
  if (denied) return denied;

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const preview = previewState(session);
    return {
      allowed: true,
      available: false,
      storage: "preview",
      pages: pagesFromGuestSet(preview.guestPublicPages),
      members: Array.from(preview.members.values()).sort(compareMembers)
    };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const [profiles, accessRows, pageRows, guestRows] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,role").order("full_name", { ascending: true }).returns<ProfileRow[]>(),
      supabase.from("platform_user_access").select("user_id,is_active,can_save_changes").returns<UserAccessRow[]>(),
      supabase.from("user_page_permissions").select("user_id,page_key,is_allowed").returns<UserPagePermissionRow[]>(),
      supabase.from("guest_public_page_permissions").select("page_key,is_public").returns<GuestPagePermissionRow[]>()
    ]);

    if (profiles.error) throw profiles.error;
    const accessByUser = mapUserAccess(accessRows.data ?? []);
    const pageAccessByUser = mapUserPageAccess(pageRows.data ?? []);
    const guestPublicPages = guestPageSet(guestRows.data ?? []);
    const members = (profiles.data ?? []).map((profile) => toMember(profile, session, accessByUser, pageAccessByUser)).sort(compareMembers);
    const aiAccessByUser = await getAiAccessForUsers(members.map((member) => ({ id: member.id, role: member.role })));

    return {
      allowed: true,
      available: !accessRows.error && !pageRows.error && !guestRows.error,
      storage: "supabase",
      pages: pagesFromGuestSet(guestPublicPages),
      members: members.map((member) => ({ ...member, aiAccess: aiAccessByUser.get(member.id) ?? member.aiAccess }))
    };
  } catch {
    const preview = previewState(session);
    return {
      allowed: true,
      available: false,
      storage: "preview",
      pages: pagesFromGuestSet(preview.guestPublicPages),
      members: Array.from(preview.members.values()).sort(compareMembers)
    };
  }
}

export async function updatePlatformAccess(
  session: AuthSession,
  input: {
    userId: string;
    role?: string;
    pageKey?: string;
    allowed?: boolean;
    guestPageKey?: string;
    guestPublic?: boolean;
    aiEnabled?: boolean;
    aiMonthlyLimit?: number | null;
    canSaveChanges?: boolean;
  }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  const denied = requirePlatformAdmin(session);
  if (denied) return denied;

  if (input.guestPageKey) {
    return setGuestPageAccess(session, { pageKey: input.guestPageKey, isPublic: input.guestPublic === true });
  }

  if (input.pageKey) {
    return setUserPageAccess(session, {
      userId: input.userId,
      pageKey: input.pageKey,
      allowed: input.allowed === true
    });
  }

  if (typeof input.aiEnabled === "boolean" || typeof input.aiMonthlyLimit === "number" || input.aiMonthlyLimit === null) {
    return setUserAiAccess(session, {
      userId: input.userId,
      enabled: input.aiEnabled === true,
      monthlyLimit: input.aiMonthlyLimit ?? null
    });
  }

  if (typeof input.canSaveChanges === "boolean") {
    return setUserSaveAccess(session, {
      userId: input.userId,
      canSaveChanges: input.canSaveChanges
    });
  }

  return updatePlatformUserRole(session, { userId: input.userId, role: input.role ?? "" });
}

export async function deactivatePlatformUser(session: AuthSession, input: { userId: string }): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  const denied = requirePlatformAdmin(session);
  if (denied) return denied;
  const userId = input.userId.trim();
  if (!userId) return { allowed: false, status: 400, error: "Choose a user to deactivate." };
  if (userId === session.user.id) return { allowed: false, status: 409, error: "Your own administrator access is protected." };

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    const member = state.members.get(userId);
    if (!member) return { allowed: false, status: 404, error: "Website member not found." };
    if (member.role === "admin" && activeAdminCount(Array.from(state.members.values()).filter((item) => item.id !== userId)) === 0) {
      return { allowed: false, status: 409, error: "Cannot deactivate the final platform administrator." };
    }
    const updated = { ...member, active: false };
    state.members.set(userId, updated);
    return { allowed: true, member: updated, storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const list = await listPlatformAccess(session);
  if (!list.allowed) return list;
  const target = list.members.find((member) => member.id === userId);
  if (!target) return { allowed: false, status: 404, error: "Website member not found." };
  if (target.role === "admin" && activeAdminCount(list.members.filter((member) => member.id !== userId)) === 0) {
    return { allowed: false, status: 409, error: "Cannot deactivate the final platform administrator." };
  }

  const result = await supabase
    .from("platform_user_access")
    .upsert({ user_id: userId, is_active: false, updated_by: session.user.id }, { onConflict: "user_id" })
    .select("user_id,is_active,can_save_changes")
    .single<UserAccessRow>();
  if (result.error) return { allowed: false, status: 503, error: "User access could not be deactivated." };

  return {
    allowed: true,
    storage: "supabase",
    member: { ...target, active: false }
  };
}

export async function isPlatformUserActiveById(userId: string): Promise<boolean> {
  if (!userId.trim() || !isSupabaseAdminConfigured()) return true;
  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("platform_user_access")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle<{ is_active: boolean | null }>();
    if (result.error || !result.data) return true;
    return result.data.is_active !== false;
  } catch {
    return true;
  }
}

export async function canPlatformUserSaveChanges(session: AuthSession): Promise<boolean> {
  if (session.isGuest || session.isMock) return true;
  if (!session.user.id.trim() || !isSupabaseAdminConfigured()) return true;
  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("platform_user_access")
      .select("can_save_changes")
      .eq("user_id", session.user.id)
      .maybeSingle<{ can_save_changes: boolean | null }>();
    if (result.error || !result.data) return true;
    return result.data.can_save_changes !== false;
  } catch {
    return true;
  }
}

export async function resolvePageAccessForSession(session: AuthSession, pathname: string): Promise<boolean> {
  const pageDef = findPlatformPageByPath(pathname);
  if (!pageDef) return true;
  if (session.isGuest) return isGuestPagePublic(pageDef.key);
  if (session.user.role === "admin") return true;
  if (!(await isPlatformUserActiveById(session.user.id))) return false;
  return getUserPageAccess(session, pageDef.key);
}

export async function visiblePlatformPagesForSession(session: AuthSession) {
  const allowed: PlatformPageKey[] = [];
  for (const pageDef of platformPages) {
    if (session.isGuest) {
      if (await isGuestPagePublic(pageDef.key)) allowed.push(pageDef.key);
    } else if (session.user.role === "admin" || await getUserPageAccess(session, pageDef.key)) {
      allowed.push(pageDef.key);
    }
  }
  return allowed;
}

export async function isGuestPagePublic(pageKey: PlatformPageKey): Promise<boolean> {
  const pageDef = getPlatformPage(pageKey);
  if (!pageDef?.guestEligible) return false;
  const previewGuestPublicPages = globalState.__leadEmergencePlatformAccessPreview?.guestPublicPages;
  if (previewGuestPublicPages) return previewGuestPublicPages.has(pageKey);
  if (!isSupabaseAdminConfigured()) return currentPreviewGuestPublicPages().has(pageKey);

  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("guest_public_page_permissions")
      .select("is_public")
      .eq("page_key", pageKey)
      .maybeSingle<{ is_public: boolean | null }>();
    if (result.error || !result.data) return defaultGuestPublicPageKeys.includes(pageKey);
    return result.data.is_public === true;
  } catch {
    return defaultGuestPublicPageKeys.includes(pageKey);
  }
}

async function updatePlatformUserRole(
  session: AuthSession,
  input: { userId: string; role: string }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  const role = parseRole(input.role);
  if (!role || !input.userId.trim()) return { allowed: false, status: 400, error: "Choose a supported website role." };
  if (input.userId === session.user.id && role !== "admin") {
    return { allowed: false, status: 409, error: "Your own administrator access is protected." };
  }

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    const existing = state.members.get(input.userId);
    if (!existing) return { allowed: false, status: 404, error: "Website member not found." };
    const member = { ...existing, role, pageAccess: defaultAccessMap(role, existing.pageAccess) };
    state.members.set(member.id, member);
    return { allowed: true, member, storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const existingResult = await supabase.from("profiles").select("id,email,full_name,role").eq("id", input.userId).maybeSingle<ProfileRow>();
  if (existingResult.error || !existingResult.data) return { allowed: false, status: 404, error: "Website member not found." };

  const previousRole = parseRole(existingResult.data.role) ?? "leader";
  const authUser = await supabase.auth.admin.getUserById(input.userId);
  if (authUser.error || !authUser.data.user) {
    return { allowed: false, status: 503, error: "The authenticated account could not be loaded." };
  }

  const profileUpdate = await supabase.from("profiles").update({ role }).eq("id", input.userId);
  if (profileUpdate.error) return { allowed: false, status: 503, error: "The website role could not be updated." };

  const authUpdate = await supabase.auth.admin.updateUserById(input.userId, {
    app_metadata: { ...authUser.data.user.app_metadata, role }
  });
  if (authUpdate.error) {
    await supabase.from("profiles").update({ role: previousRole }).eq("id", input.userId);
    return { allowed: false, status: 503, error: "The role update was rolled back because the authenticated account could not be updated." };
  }

  const list = await listPlatformAccess(session);
  const fallback = toMember({ ...existingResult.data, role }, session, new Map(), new Map());
  return {
    allowed: true,
    storage: "supabase",
    member: list.allowed ? list.members.find((member) => member.id === input.userId) ?? fallback : fallback
  };
}

async function setUserPageAccess(
  session: AuthSession,
  input: { userId: string; pageKey: string; allowed: boolean }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  if (!input.userId.trim() || !isPlatformPageKey(input.pageKey)) {
    return { allowed: false, status: 400, error: "Choose a supported page." };
  }
  if (input.userId === session.user.id && input.pageKey === "settings" && !input.allowed) {
    return { allowed: false, status: 409, error: "Your own Settings access is protected." };
  }

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    const existing = state.members.get(input.userId);
    if (!existing) return { allowed: false, status: 404, error: "Website member not found." };
    const member = {
      ...existing,
      pageAccess: { ...existing.pageAccess, [input.pageKey]: input.allowed }
    };
    state.members.set(member.id, member);
    return { allowed: true, member, storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("user_page_permissions")
    .upsert(
      { user_id: input.userId, page_key: input.pageKey, is_allowed: input.allowed, updated_by: session.user.id },
      { onConflict: "user_id,page_key" }
    );
  if (result.error) return { allowed: false, status: 503, error: "Page access could not be updated." };

  const list = await listPlatformAccess(session);
  if (!list.allowed) return list;
  return { allowed: true, storage: list.storage, member: list.members.find((member) => member.id === input.userId) };
}

async function setUserAiAccess(
  session: AuthSession,
  input: { userId: string; enabled: boolean; monthlyLimit: number | null }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    const existing = state.members.get(input.userId);
    if (!existing) return { allowed: false, status: 404, error: "Website member not found." };
    const member = { ...existing, aiAccess: { enabled: input.enabled, monthlyLimit: input.monthlyLimit, currentMonthUsage: existing.aiAccess.currentMonthUsage } };
    state.members.set(member.id, member);
    return { allowed: true, member, storage: "preview" };
  }

  const result = await updateAiAccessForUser(session, input);
  if ("error" in result) return { allowed: false, status: result.status, error: result.error };

  const list = await listPlatformAccess(session);
  if (!list.allowed) return list;
  return { allowed: true, storage: list.storage, member: list.members.find((member) => member.id === input.userId) };
}

async function setUserSaveAccess(
  session: AuthSession,
  input: { userId: string; canSaveChanges: boolean }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  if (!input.userId.trim()) return { allowed: false, status: 400, error: "Choose a user to update." };
  if (input.userId === session.user.id && !input.canSaveChanges) {
    return { allowed: false, status: 409, error: "Your own save rights are protected." };
  }

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    const existing = state.members.get(input.userId);
    if (!existing) return { allowed: false, status: 404, error: "Website member not found." };
    const member = { ...existing, canSaveChanges: input.canSaveChanges };
    state.members.set(member.id, member);
    return { allowed: true, member, storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("platform_user_access")
    .upsert({ user_id: input.userId, can_save_changes: input.canSaveChanges, updated_by: session.user.id }, { onConflict: "user_id" });
  if (result.error) return { allowed: false, status: 503, error: "Save rights could not be updated." };

  const list = await listPlatformAccess(session);
  if (!list.allowed) return list;
  return { allowed: true, storage: list.storage, member: list.members.find((member) => member.id === input.userId) };
}

async function setGuestPageAccess(
  session: AuthSession,
  input: { pageKey: string; isPublic: boolean }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  if (!isPlatformPageKey(input.pageKey)) return { allowed: false, status: 400, error: "Choose a supported page." };
  const pageDef = getPlatformPage(input.pageKey);
  if (!pageDef?.guestEligible) return { allowed: false, status: 409, error: "That page cannot be made public in guest mode." };

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const state = previewState(session);
    if (input.isPublic) state.guestPublicPages.add(input.pageKey);
    else state.guestPublicPages.delete(input.pageKey);
    return { allowed: true, pages: pagesFromGuestSet(state.guestPublicPages), storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("guest_public_page_permissions")
    .upsert({ page_key: input.pageKey, is_public: input.isPublic, updated_by: session.user.id }, { onConflict: "page_key" });
  if (result.error) return { allowed: false, status: 503, error: "Guest page access could not be updated." };

  const list = await listPlatformAccess(session);
  if (!list.allowed) return list;
  return { allowed: true, storage: list.storage, pages: list.pages };
}

async function getUserPageAccess(session: AuthSession, pageKey: PlatformPageKey): Promise<boolean> {
  const defaultAccess = defaultPageAccessForRole(pageKey, session.user.role);
  if (session.isMock || !isSupabaseAdminConfigured()) {
    const member = previewState(session).members.get(session.user.id);
    return member?.active !== false && (member?.pageAccess[pageKey] ?? defaultAccess);
  }
  try {
    const supabase = getSupabaseAdminClient();
    const [status, permission] = await Promise.all([
      supabase.from("platform_user_access").select("is_active").eq("user_id", session.user.id).maybeSingle<{ is_active: boolean | null }>(),
      supabase.from("user_page_permissions").select("is_allowed").eq("user_id", session.user.id).eq("page_key", pageKey).maybeSingle<{ is_allowed: boolean | null }>()
    ]);
    if (status.data?.is_active === false) return false;
    if (permission.error || !permission.data) return defaultAccess;
    return permission.data.is_allowed === true;
  } catch {
    return defaultAccess;
  }
}

function requirePlatformAdmin(session: AuthSession): PlatformAccessDenied | null {
  if (session.isGuest || session.user.role !== "admin") {
    return { allowed: false, status: 403, error: "Platform administrator access is required." };
  }
  return null;
}

function previewState(session: AuthSession) {
  if (!globalState.__leadEmergencePlatformAccessPreview) {
    const members = mockStore.listUsers().map<PlatformAccessMember>((user) => ({
      id: user.id,
      email: user.email,
      displayName: resolvePersonName(`${user.firstName} ${user.lastName}`, user.email),
      role: user.role,
      active: true,
      canSaveChanges: true,
      aiAccess: defaultAiAccessForRole(user.role),
      currentUser: user.id === session.user.id,
      pageAccess: defaultAccessMap(user.role)
    }));
    if (!members.some((member) => member.id === session.user.id)) {
      const role = parseRole(session.user.role) ?? "admin";
      members.unshift({
        id: session.user.id,
        email: session.user.email,
        displayName: resolvePersonName(session.user.fullName, session.user.email),
        role,
        active: true,
        canSaveChanges: true,
        aiAccess: defaultAiAccessForRole(role),
        currentUser: true,
        pageAccess: defaultAccessMap(role)
      });
    }
    globalState.__leadEmergencePlatformAccessPreview = {
      members: new Map(members.map((member) => [member.id, member])),
      guestPublicPages: new Set(defaultGuestPublicPageKeys)
    };
  }

  for (const member of Array.from(globalState.__leadEmergencePlatformAccessPreview.members.values())) {
    member.currentUser = member.id === session.user.id;
  }
  return globalState.__leadEmergencePlatformAccessPreview;
}

function currentPreviewGuestPublicPages() {
  return globalState.__leadEmergencePlatformAccessPreview?.guestPublicPages ?? new Set(defaultGuestPublicPageKeys);
}

function toMember(
  profile: ProfileRow,
  session: AuthSession,
  accessByUser: Map<string, UserAccessState>,
  pageAccessByUser: Map<string, Map<PlatformPageKey, boolean>>
): PlatformAccessMember {
  const email = profile.email?.trim() || "Account email unavailable";
  const role = parseRole(profile.role) ?? "leader";
  const access = accessByUser.get(profile.id);
  return {
    id: profile.id,
    email,
    displayName: resolvePersonName(profile.full_name, email, "Ministry user"),
    role,
    active: access?.active ?? true,
    canSaveChanges: access?.canSaveChanges ?? true,
    aiAccess: defaultAiAccessForRole(role),
    currentUser: profile.id === session.user.id,
    pageAccess: defaultAccessMap(role, Object.fromEntries(pageAccessByUser.get(profile.id) ?? []))
  };
}

function defaultAccessMap(role: Role, overrides: Partial<Record<PlatformPageKey, boolean>> = {}): Record<PlatformPageKey, boolean> {
  return Object.fromEntries(
    platformPages.map((pageDef) => [pageDef.key, overrides[pageDef.key] ?? defaultPageAccessForRole(pageDef.key, role)])
  ) as Record<PlatformPageKey, boolean>;
}

function pagesFromGuestSet(guestPublicPages: Set<PlatformPageKey>): PlatformAccessPage[] {
  return platformPages.map((pageDef) => ({
    key: pageDef.key,
    label: pageDef.label,
    path: pageDef.path,
    description: pageDef.description,
    guestEligible: pageDef.guestEligible,
    guestPublic: guestPublicPages.has(pageDef.key)
  }));
}

function mapUserAccess(rows: UserAccessRow[]) {
  return new Map(rows.map((row) => [row.user_id, { active: row.is_active !== false, canSaveChanges: row.can_save_changes !== false }]));
}

function mapUserPageAccess(rows: UserPagePermissionRow[]) {
  const byUser = new Map<string, Map<PlatformPageKey, boolean>>();
  for (const row of rows) {
    if (!isPlatformPageKey(row.page_key)) continue;
    const permissions = byUser.get(row.user_id) ?? new Map<PlatformPageKey, boolean>();
    permissions.set(row.page_key, row.is_allowed === true);
    byUser.set(row.user_id, permissions);
  }
  return byUser;
}

function guestPageSet(rows: GuestPagePermissionRow[]) {
  const guestPublicPages = new Set(defaultGuestPublicPageKeys);
  for (const row of rows) {
    if (!isPlatformPageKey(row.page_key)) continue;
    if (row.is_public === true) guestPublicPages.add(row.page_key);
    else guestPublicPages.delete(row.page_key);
  }
  return guestPublicPages;
}

function parseRole(value: string | null | undefined): Role | null {
  return platformRoles.includes(value as Role) ? (value as Role) : null;
}

function activeAdminCount(members: PlatformAccessMember[]) {
  return members.filter((member) => member.active && member.role === "admin").length;
}

function compareMembers(first: PlatformAccessMember, second: PlatformAccessMember) {
  if (first.currentUser !== second.currentUser) return first.currentUser ? -1 : 1;
  if (first.active !== second.active) return first.active ? -1 : 1;
  return first.displayName.localeCompare(second.displayName);
}
