export const resourceParentTypes = [
  "event",
  "event_task",
  "how_to_read_section",
  "how_to_read_lesson",
  "journey_journal",
  "journey_journal_week",
  "journey_journal_day",
  "volunteer_training",
  "volunteer_training_module",
  "weekly_leader_prep",
  "sermon",
  "leader_guide",
  "small_group_resource",
  "worship_plan",
  "communication_draft",
  "content_draft"
] as const;

export const resourceTypes = [
  "document",
  "pdf",
  "image",
  "audio",
  "video",
  "slides",
  "spreadsheet",
  "form",
  "external_link",
  "google_drive",
  "youtube",
  "other"
] as const;

export const resourceVisibilities = [
  "admin_only",
  "staff_admin",
  "volunteer_leaders",
  "assigned_leaders",
  "students",
  "parents",
  "authenticated",
  "public",
  "inherit_parent"
] as const;

export const resourceNotificationIntents = [
  "none",
  "assigned_leaders",
  "all_volunteers",
  "enrolled_students",
  "registered_attendees",
  "communication_draft"
] as const;

export const resourceAuditActions = [
  "resource_uploaded",
  "external_link_added",
  "metadata_edited",
  "file_replaced",
  "visibility_changed",
  "resource_reordered",
  "resource_archived",
  "resource_restored",
  "resource_permanently_deleted"
] as const;

export type ResourceParentType = (typeof resourceParentTypes)[number];
export type ResourceType = (typeof resourceTypes)[number];
export type ResourceVisibility = (typeof resourceVisibilities)[number];
export type ResourceNotificationIntent = (typeof resourceNotificationIntents)[number];
export type ResourceAuditAction = (typeof resourceAuditActions)[number];

export type ResourceAttachment = {
  id: string;
  organizationId: string;
  parentType: ResourceParentType;
  parentId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  storageBucket: string;
  storagePath?: string;
  externalUrl?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  displayOrder: number;
  visibility: ResourceVisibility;
  isFeatured: boolean;
  isDownloadable: boolean;
  opensInNewTab: boolean;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  source: "live" | "local";
};
export type ResourceAttachmentListPayload = {
  canManage: boolean;
  resources: ResourceAttachment[];
  storageReady: boolean;
};
