import type { AuthSession } from "@/lib/auth/server";
import { campAccessLabels, parseCampAccessRole } from "@/lib/camp/access";
import type { CampAccessRole } from "@/lib/camp/types";

const restrictedCampNames = ["andrew", "jaci", "joel"] as const;

export type CampRestrictedActor = "Andrew" | "Jaci" | "Joel";

export type CampAccessContext = {
  requestedRole: CampAccessRole;
  effectiveRole: CampAccessRole;
  canAccessRestricted: boolean;
  restrictedActor?: CampRestrictedActor;
  isDriver: boolean;
};

export function resolveCampAccessContext(session: AuthSession, requestedRole: string | null): CampAccessContext {
  const parsed = parseCampAccessRole(requestedRole) ?? "general_leader";

  if (session.isMock) {
    return {
      requestedRole: parsed,
      effectiveRole: parsed,
      canAccessRestricted: parsed === "andrew" || parsed === "jaci" || parsed === "joel",
      restrictedActor: parsed === "andrew" || parsed === "jaci" || parsed === "joel" ? campAccessLabels[parsed] as CampRestrictedActor : undefined,
      isDriver: parsed === "driver"
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
    isDriver
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
// keys off the server-resolved restrictedActor (email-derived in production,
// not spoofable by the ?role= query param), so no schema change is required.
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
