import type { AuthSession } from "@/lib/auth/server";
import { campAccessLabels, parseCampAccessRole } from "@/lib/camp/access";
import type { CampAppAreaScope, CampEditScope } from "@/lib/camp/access-roles";
import type { CampAccessRole } from "@/lib/camp/types";

const restrictedCampNames = ["andrew", "jaci", "joel"] as const;

export type CampRestrictedActor = "Andrew" | "Jaci" | "Joel";

export type CampAccessContext = {
  requestedRole: CampAccessRole;
  effectiveRole: CampAccessRole;
  canAccessRestricted: boolean;
  restrictedActor?: CampRestrictedActor;
  isDriver: boolean;
  campEditScope: CampEditScope;
  appAreaScope: CampAppAreaScope;
  canPostTeamBulletin: boolean;
  partnerChurchId?: string | null;
  assignedTeamIds: string[];
};

export function resolveCampAccessContext(session: AuthSession, requestedRole: string | null): CampAccessContext {
  const parsed = parseCampAccessRole(requestedRole) ?? "general_leader";

  if (session.isMock) {
    return {
      requestedRole: parsed,
      effectiveRole: parsed,
      canAccessRestricted: parsed === "andrew" || parsed === "jaci" || parsed === "joel",
      restrictedActor: parsed === "andrew" || parsed === "jaci" || parsed === "joel" ? campAccessLabels[parsed] as CampRestrictedActor : undefined,
      isDriver: parsed === "driver",
      campEditScope: parsed === "driver" ? "read_only" : "all_campers",
      appAreaScope: parsed === "andrew" ? "admin" : "camp_only",
      canPostTeamBulletin: parsed !== "driver",
      assignedTeamIds: []
    };
  }

  const restrictedActor = restrictedActorForSession(session);
  const isDriver = session.user.role === "driver";
  const effectiveRole = isDriver
    ? "driver"
    : restrictedActor && (parsed === "andrew" || parsed === "jaci" || parsed === "joel")
      ? parsed
      : parsed === "driver"
        ? "driver"
        : "general_leader";

  return {
    requestedRole: parsed,
    effectiveRole,
    canAccessRestricted: Boolean(restrictedActor),
    restrictedActor,
    isDriver,
    campEditScope: restrictedActor === "Andrew" ? "all_campers" : "read_only",
    appAreaScope: restrictedActor === "Andrew" ? "admin" : "camp_only",
    canPostTeamBulletin: restrictedActor === "Andrew",
    assignedTeamIds: []
  };
}

export function assertCampRestrictedAccess(context: CampAccessContext) {
  if (!context.canAccessRestricted) {
    return {
      allowed: false as const,
      status: 403,
      error: "Camp restricted medical and medication access is limited to Andrew, Jaci, and Joel."
    };
  }

  return { allowed: true as const, actor: context.restrictedActor ?? "Andrew" };
}

// Medical Command is a stricter capability than the normal restricted medication
// workflows: it is limited to Andrew ONLY. Jaci and Joel keep their existing
// restricted medication access but must never reach Medical Command. The check
// keys off the server-resolved restrictedActor, which is supplied by the
// authenticated Camp access resolver and is not spoofable by query params.
export function canAccessCampMedicalCommand(context: CampAccessContext): boolean {
  return context.restrictedActor === "Andrew";
}

export function assertCampMedicalCommandAccess(context: CampAccessContext) {
  if (!canAccessCampMedicalCommand(context)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Camp Medical Command access is limited to Andrew."
    };
  }

  return { allowed: true as const, actor: "Andrew" as const };
}

// Legacy Camp EMMA room-change command gate. The newer /api/camp/emma/actions
// route performs permission-aware checks per action, but this older confirm
// path remains Camp Admin only so it cannot become a broad mutation bypass.
export function canAccessCampEmmaOperationsCommand(context: CampAccessContext): boolean {
  return context.restrictedActor === "Andrew";
}

export function assertCampEmmaOperationsAccess(context: CampAccessContext) {
  if (!canAccessCampEmmaOperationsCommand(context)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Camp EMMA operational commands (like room changes) are limited to Camp Admins in the legacy command path."
    };
  }

  return { allowed: true as const, actor: "Andrew" as const };
}

export function assertCampAdminAccess(context: CampAccessContext) {
  if (context.restrictedActor !== "Andrew") {
    return {
      allowed: false as const,
      status: 403,
      error: "Camp roster imports and access management are limited to Camp Admins."
    };
  }

  return { allowed: true as const, actor: "Andrew" as const };
}

export function canAccessEmergeOperations(context: Pick<CampAccessContext, "appAreaScope">): boolean {
  return context.appAreaScope === "emerge_operations" || context.appAreaScope === "admin";
}

export function canEditAllCampers(context: Pick<CampAccessContext, "campEditScope">): boolean {
  return context.campEditScope === "all_campers";
}

export function canEditPartnerChurchCampers(context: Pick<CampAccessContext, "campEditScope" | "partnerChurchId">): boolean {
  return context.campEditScope === "partner_church_only" && Boolean(context.partnerChurchId?.trim());
}

export function assertAllCampersOperationalWriteAccess(context: CampAccessContext, label = "Camp operational editing") {
  if (!canEditAllCampers(context)) {
    return {
      allowed: false as const,
      status: 403,
      error: `${label} requires All Campers edit rights.`
    };
  }

  return { allowed: true as const };
}

export function assertCampBulletinPostAccess(context: CampAccessContext, teamId?: string) {
  if (!context.canPostTeamBulletin) {
    return {
      allowed: false as const,
      status: 403,
      error: "Team Bulletin posting is not enabled for this Camp leader."
    };
  }

  const assignedTeams = context.assignedTeamIds.filter(Boolean);
  const canPostBroadly = canEditAllCampers(context);
  if (!canPostBroadly && (!teamId || !assignedTeams.includes(teamId))) {
    return {
      allowed: false as const,
      status: 403,
      error: "Team Bulletin posting is limited to assigned teams."
    };
  }

  const normalizedContextChurch = normalizeScopeId(context.partnerChurchId);
  if (context.campEditScope === "partner_church_only" && !normalizedContextChurch) {
    return {
      allowed: false as const,
      status: 403,
      error: "Team Bulletin posting requires an assigned partner church scope."
    };
  }

  return { allowed: true as const, partnerChurchId: normalizedContextChurch || null };
}

export function normalizeScopeId(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

function restrictedActorForSession(session: AuthSession): CampRestrictedActor | undefined {
  const emailLocalPart = session.user.email.split("@")[0]?.toLowerCase() ?? "";
  const match = restrictedCampNames.find((name) => isRestrictedEmailLocalPart(emailLocalPart, name));
  if (match === "andrew") return "Andrew";
  if (match === "jaci") return "Jaci";
  if (match === "joel") return "Joel";
  return undefined;
}

function isRestrictedEmailLocalPart(localPart: string, actor: typeof restrictedCampNames[number]): boolean {
  return localPart === actor
    || localPart.startsWith(`${actor}.`)
    || localPart.startsWith(`${actor}-`)
    || localPart.startsWith(`${actor}_`);
}
