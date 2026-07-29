import type { AuthSession } from "@/lib/auth/server";
import { howToReadModules } from "@/lib/scripture/how-to-read";
import {
  resourceNotificationIntents,
  resourceParentTypes,
  resourceTypes,
  resourceVisibilities,
  type ResourceNotificationIntent,
  type ResourceParentType,
  type ResourceType,
  type ResourceVisibility
} from "@/lib/resources/types";

const managerRoles = new Set(["admin"]);
const staffRoles = new Set(["admin", "staff"]);
const leaderRoles = new Set(["admin", "staff", "leader"]);
const studentReaderRoles = new Set(["admin", "staff", "leader", "student"]);
const parentReaderRoles = new Set(["admin", "staff", "parent"]);
const authenticatedReaderRoles = new Set(["admin", "staff", "leader", "student", "parent", "volunteer"]);
const ministryResourceManagerRoles = new Set(["admin", "staff", "leader"]);
const ministryOperationsManagedParents = new Set<ResourceParentType>([
  "event",
  "event_task",
  "volunteer_training",
  "volunteer_training_module",
  "weekly_leader_prep",
  "sermon",
  "leader_guide",
  "small_group_resource",
  "worship_plan",
  "communication_draft"
]);

export const resourceBucketName = "resource-attachments";

export const resourceVisibilityLabels: Record<ResourceVisibility, string> = {
  admin_only: "Admin Only",
  staff_admin: "Staff and Admin",
  volunteer_leaders: "Volunteer Leaders",
  assigned_leaders: "Assigned Leaders",
  students: "Students",
  parents: "Parents",
  authenticated: "Authenticated Users",
  public: "Public",
  inherit_parent: "Inherit From Parent"
};

export const resourceNotificationLabels: Record<ResourceNotificationIntent, string> = {
  none: "Do not notify",
  assigned_leaders: "Notify assigned leaders",
  all_volunteers: "Notify all volunteers",
  enrolled_students: "Notify enrolled students",
  registered_attendees: "Notify registered attendees",
  communication_draft: "Create communication draft"
};

export const parentResourceTitles: Partial<Record<ResourceParentType, string>> = {
  event: "Event Files",
  event_task: "Task Resources",
  how_to_read_section: "Supporting Resources",
  how_to_read_lesson: "Supporting Resources",
  journey_journal: "Journey Journal Resources",
  journey_journal_week: "Resources for This Week",
  journey_journal_day: "Resources for This Day",
  volunteer_training: "Training Materials",
  volunteer_training_module: "Training Materials",
  weekly_leader_prep: "Leader Prep Resources",
  sermon: "Message and Small-Group Resources",
  leader_guide: "Leader Guide Resources",
  small_group_resource: "Small-Group Resources",
  worship_plan: "Worship Plan Resources",
  communication_draft: "Communication Draft Resources"
};

export const inheritedVisibilityByParentType: Record<ResourceParentType, ResourceVisibility> = {
  event: "volunteer_leaders",
  event_task: "assigned_leaders",
  how_to_read_section: "students",
  how_to_read_lesson: "students",
  journey_journal: "students",
  journey_journal_week: "students",
  journey_journal_day: "students",
  volunteer_training: "volunteer_leaders",
  volunteer_training_module: "volunteer_leaders",
  weekly_leader_prep: "assigned_leaders",
  sermon: "volunteer_leaders",
  leader_guide: "assigned_leaders",
  small_group_resource: "volunteer_leaders",
  worship_plan: "volunteer_leaders",
  communication_draft: "staff_admin"
};

const knownStaticParentIds: Partial<Record<ResourceParentType, Set<string>>> = {
  how_to_read_section: new Set(["overview", "path", "media"]),
  how_to_read_lesson: new Set(howToReadModules.map((module) => module.id)),
  journey_journal: new Set(["overview", "student-question-flow"]),
  volunteer_training: new Set(["quarterly-training-center", "onboarding"]),
  volunteer_training_module: new Set(["train_safety", "train_followup", "train_discussion"])
};

export function isResourceParentType(value: string): value is ResourceParentType {
  return (resourceParentTypes as readonly string[]).includes(value);
}
export function isResourceType(value: string): value is ResourceType {
  return (resourceTypes as readonly string[]).includes(value);
}

export function isResourceVisibility(value: string): value is ResourceVisibility {
  return (resourceVisibilities as readonly string[]).includes(value);
}

export function isResourceNotificationIntent(value: string): value is ResourceNotificationIntent {
  return (resourceNotificationIntents as readonly string[]).includes(value);
}

export function normalizeResourceParentType(value: string): ResourceParentType {
  const normalized = value.trim();
  if (!isResourceParentType(normalized) || looksRestrictedParentType(normalized)) {
    throw new ResourceRegistryError("This record type is not enabled for general resource attachments.", 400, "unsupported_parent_type");
  }
  return normalized;
}

export function normalizeResourceVisibility(value: string | undefined): ResourceVisibility {
  const normalized = value?.trim() || "inherit_parent";
  if (isResourceVisibility(normalized)) return normalized;
  throw new ResourceRegistryError("Choose a supported resource visibility.", 400, "unsupported_visibility");
}

export function normalizeResourceType(value: string | undefined, fallback: ResourceType = "external_link"): ResourceType {
  const normalized = value?.trim() || fallback;
  if (isResourceType(normalized)) return normalized;
  throw new ResourceRegistryError("Choose a supported resource type.", 400, "unsupported_resource_type");
}

export function normalizeNotificationIntent(value: string | undefined): ResourceNotificationIntent {
  const normalized = value?.trim() || "none";
  if (isResourceNotificationIntent(normalized)) return normalized;
  throw new ResourceRegistryError("Choose a supported notification option.", 400, "unsupported_notification");
}

export function normalizeExternalUrl(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) throw new ResourceRegistryError("External link URL is required.", 400, "missing_external_url");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ResourceRegistryError("Add a valid http or https URL.", 400, "invalid_external_url");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ResourceRegistryError("External links must use http or https.", 400, "invalid_external_url");
  }

  return parsed.toString();
}

export function inferExternalResourceType(url: string): ResourceType {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("drive.google.com") || hostname.includes("docs.google.com")) return "google_drive";
  return "external_link";
}

export function assertKnownStaticParent(parentType: ResourceParentType, parentId: string) {
  const known = knownStaticParentIds[parentType];
  if (!known) return;
  if (known.has(parentId)) return;
  if (parentType === "journey_journal_day" && isSafeParentId(parentId)) return;
  if (parentType === "journey_journal_week" && isSafeParentId(parentId)) return;
  throw new ResourceRegistryError("The linked parent record could not be found.", 404, "parent_not_found");
}

export function isResourceManager(session: AuthSession | null | undefined, parentType?: string | null) {
  if (!session || session.isGuest) return false;
  const role = normalizeSessionRole(session);
  if (managerRoles.has(role)) return true;
  if (!parentType || !isResourceParentType(parentType)) return false;
  return ministryOperationsManagedParents.has(parentType) && ministryResourceManagerRoles.has(role);
}

export function canReadResourceVisibility(
  session: AuthSession | null | undefined,
  visibility: ResourceVisibility,
  parentType: ResourceParentType
) {
  const effectiveVisibility = visibility === "inherit_parent" ? inheritedVisibilityByParentType[parentType] : visibility;
  if (effectiveVisibility === "public") return true;
  if (!session || session.isGuest) return false;

  const role = normalizeSessionRole(session);
  if (managerRoles.has(role)) return true;
  if (effectiveVisibility === "staff_admin") return staffRoles.has(role);
  if (effectiveVisibility === "admin_only") return managerRoles.has(role);
  if (effectiveVisibility === "volunteer_leaders" || effectiveVisibility === "assigned_leaders") return leaderRoles.has(role);
  if (effectiveVisibility === "students") return studentReaderRoles.has(role);
  if (effectiveVisibility === "parents") return parentReaderRoles.has(role);
  if (effectiveVisibility === "authenticated") return authenticatedReaderRoles.has(role);
  return false;
}

export function parentResourceTitle(parentType: ResourceParentType, fallback = "Resources") {
  return parentResourceTitles[parentType] ?? fallback;
}

export function normalizeSessionRole(session: AuthSession) {
  return session.user.role.trim().toLowerCase();
}

function looksRestrictedParentType(value: string) {
  return /(medical|medication|counseling|pastoral|confidential|restricted)/i.test(value);
}

function isSafeParentId(value: string) {
  return /^[a-z0-9][a-z0-9:_-]{0,120}$/i.test(value);
}

export class ResourceRegistryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "resource_registry_error"
  ) {
    super(message);
  }
}
