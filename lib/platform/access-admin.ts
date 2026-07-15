import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolvePersonName } from "@/lib/auth/display-name";
import * as mockStore from "@/lib/store";
import type { Role } from "@/lib/types";

export const platformRoles: Role[] = ["admin", "leader", "student", "parent"];

export type PlatformAccessMember = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  currentUser: boolean;
};

type PlatformAccessDenied = { allowed: false; status: number; error: string };
type PlatformAccessList = {
  allowed: true;
  available: boolean;
  storage: "supabase" | "preview";
  members: PlatformAccessMember[];
};
type PlatformAccessUpdate = { allowed: true; member: PlatformAccessMember; storage: "supabase" | "preview" };

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

const globalState = globalThis as typeof globalThis & {
  __leadEmergencePlatformAccessPreview?: Map<string, PlatformAccessMember>;
};

export async function listPlatformAccess(session: AuthSession): Promise<PlatformAccessDenied | PlatformAccessList> {
  const denied = requirePlatformAdmin(session);
  if (denied) return denied;

  if (session.isMock || !isSupabaseAdminConfigured()) {
    return {
      allowed: true,
      available: false,
      storage: "preview",
      members: Array.from(previewMembers(session).values()).sort(compareMembers)
    };
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .order("full_name", { ascending: true })
    .returns<ProfileRow[]>();

  if (result.error) {
    return { allowed: false, status: 503, error: "Website access could not be loaded." };
  }

  return {
    allowed: true,
    available: true,
    storage: "supabase",
    members: (result.data ?? []).map((profile) => toMember(profile, session)).sort(compareMembers)
  };
}

export async function updatePlatformAccess(
  session: AuthSession,
  input: { userId: string; role: string }
): Promise<PlatformAccessDenied | PlatformAccessUpdate> {
  const denied = requirePlatformAdmin(session);
  if (denied) return denied;

  const role = parseRole(input.role);
  if (!role || !input.userId.trim()) {
    return { allowed: false, status: 400, error: "Choose a supported website role." };
  }

  if (input.userId === session.user.id && role !== "admin") {
    return { allowed: false, status: 409, error: "Your own administrator access is protected." };
  }

  if (session.isMock || !isSupabaseAdminConfigured()) {
    const members = previewMembers(session);
    const existing = members.get(input.userId);
    if (!existing) return { allowed: false, status: 404, error: "Website member not found." };
    const member = { ...existing, role };
    members.set(member.id, member);
    return { allowed: true, member, storage: "preview" };
  }

  const supabase = getSupabaseAdminClient();
  const existingResult = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", input.userId)
    .maybeSingle<ProfileRow>();

  if (existingResult.error || !existingResult.data) {
    return { allowed: false, status: 404, error: "Website member not found." };
  }

  const previousRole = parseRole(existingResult.data.role) ?? "leader";
  const authUser = await supabase.auth.admin.getUserById(input.userId);
  if (authUser.error || !authUser.data.user) {
    return { allowed: false, status: 503, error: "The authenticated account could not be loaded." };
  }

  const profileUpdate = await supabase.from("profiles").update({ role }).eq("id", input.userId);
  if (profileUpdate.error) {
    return { allowed: false, status: 503, error: "The website role could not be updated." };
  }

  const authUpdate = await supabase.auth.admin.updateUserById(input.userId, {
    app_metadata: { ...authUser.data.user.app_metadata, role }
  });

  if (authUpdate.error) {
    await supabase.from("profiles").update({ role: previousRole }).eq("id", input.userId);
    return { allowed: false, status: 503, error: "The role update was rolled back because the authenticated account could not be updated." };
  }

  return {
    allowed: true,
    storage: "supabase",
    member: toMember({ ...existingResult.data, role }, session)
  };
}

function requirePlatformAdmin(session: AuthSession): PlatformAccessDenied | null {
  if (session.user.role !== "admin") {
    return { allowed: false, status: 403, error: "Platform administrator access is required." };
  }
  return null;
}

function previewMembers(session: AuthSession) {
  if (!globalState.__leadEmergencePlatformAccessPreview) {
    const members = mockStore.listUsers().map<PlatformAccessMember>((user) => ({
      id: user.id,
      email: user.email,
      displayName: resolvePersonName(`${user.firstName} ${user.lastName}`, user.email),
      role: user.role,
      currentUser: user.id === session.user.id
    }));
    if (!members.some((member) => member.id === session.user.id)) {
      members.unshift({
        id: session.user.id,
        email: session.user.email,
        displayName: resolvePersonName(session.user.fullName, session.user.email),
        role: parseRole(session.user.role) ?? "admin",
        currentUser: true
      });
    }
    globalState.__leadEmergencePlatformAccessPreview = new Map(members.map((member) => [member.id, member]));
  }

  for (const member of Array.from(globalState.__leadEmergencePlatformAccessPreview.values())) {
    member.currentUser = member.id === session.user.id;
  }
  return globalState.__leadEmergencePlatformAccessPreview;
}

function toMember(profile: ProfileRow, session: AuthSession): PlatformAccessMember {
  const email = profile.email?.trim() || "Account email unavailable";
  return {
    id: profile.id,
    email,
    displayName: resolvePersonName(profile.full_name, email, "Ministry user"),
    role: parseRole(profile.role) ?? "leader",
    currentUser: profile.id === session.user.id
  };
}

function parseRole(value: string | null | undefined): Role | null {
  return platformRoles.includes(value as Role) ? (value as Role) : null;
}

function compareMembers(first: PlatformAccessMember, second: PlatformAccessMember) {
  if (first.currentUser !== second.currentUser) return first.currentUser ? -1 : 1;
  return first.displayName.localeCompare(second.displayName);
}