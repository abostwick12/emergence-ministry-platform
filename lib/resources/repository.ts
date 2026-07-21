import { randomUUID } from "crypto";

import { isSupabaseAdminConfigured, getSupabaseAdminClient, type AuthSession } from "@/lib/auth/server";
import { DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { validateResourceFile } from "@/lib/resources/file-validation";
import {
  assertKnownStaticParent,
  canReadResourceVisibility,
  inferExternalResourceType,
  isResourceManager,
  normalizeExternalUrl,
  normalizeNotificationIntent,
  normalizeResourceParentType,
  normalizeResourceType,
  normalizeResourceVisibility,
  parentResourceTitle,
  resourceBucketName,
  ResourceRegistryError
} from "@/lib/resources/registry";
import type {
  ResourceAttachment,
  ResourceAuditAction,
  ResourceNotificationIntent,
  ResourceParentType,
  ResourceType,
  ResourceVisibility
} from "@/lib/resources/types";

type ResourceAttachmentRow = {
  id: string;
  organization_id: string;
  parent_type: ResourceParentType;
  parent_id: string;
  title: string;
  description: string;
  resource_type: ResourceType;
  storage_bucket: string;
  storage_path: string | null;
  external_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  display_order: number | null;
  visibility: ResourceVisibility;
  is_featured: boolean | null;
  is_downloadable: boolean | null;
  opens_in_new_tab: boolean | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CreateResourceAttachmentInput = {
  description?: string;
  externalUrl?: string;
  file?: File;
  isDownloadable?: boolean;
  isFeatured?: boolean;
  notificationIntent?: string;
  opensInNewTab?: boolean;
  parentId: string;
  parentType: string;
  resourceType?: string;
  title?: string;
  visibility?: string;
};

export type UpdateResourceAttachmentInput = {
  description?: string;
  displayOrder?: number;
  isDownloadable?: boolean;
  isFeatured?: boolean;
  opensInNewTab?: boolean;
  title?: string;
  visibility?: string;
};

type ParentResolution = {
  organizationId: string;
  parentId: string;
  parentType: ResourceParentType;
};

type LocalResourceStore = {
  resourcesByParent: Map<string, ResourceAttachment[]>;
  dataUrlsByAttachmentId: Map<string, string>;
};

const localResourceStoreKey = Symbol.for("lead-emergence.resource-attachments");
const localStore =
  ((globalThis as typeof globalThis & { [localResourceStoreKey]?: LocalResourceStore })[localResourceStoreKey] ??= {
    resourcesByParent: new Map<string, ResourceAttachment[]>(),
    dataUrlsByAttachmentId: new Map<string, string>()
  });

export class ResourceAttachmentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "resource_attachment_error"
  ) {
    super(message);
  }
}

export async function listResourceAttachments(
  session: AuthSession | null,
  input: { parentType: string; parentId: string; includeArchived?: boolean }
): Promise<ResourceAttachment[]> {
  const parent = await resolveResourceParent(session, input.parentType, input.parentId);

  if (!shouldUseLiveResources(session)) {
    return listLocalResources(session, parent, input.includeArchived);
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("resource_attachments")
    .select("*")
    .eq("organization_id", parent.organizationId)
    .eq("parent_type", parent.parentType)
    .eq("parent_id", parent.parentId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!input.includeArchived) query = query.is("archived_at", null);

  const result = await query.returns<ResourceAttachmentRow[]>();
  if (isMissingResourceTableError(result.error)) {
    return listLocalResources(session, parent, input.includeArchived);
  }
  throwIfResourceError(result.error, "Resources could not be loaded.");

  return (result.data ?? [])
    .map((row) => toResourceAttachment(row, "live"))
    .filter((resource) => canReadResourceVisibility(session, resource.visibility, resource.parentType));
}

export async function createResourceAttachment(session: AuthSession, input: CreateResourceAttachmentInput) {
  assertCanManageResources(session);
  const parent = await resolveResourceParent(session, input.parentType, input.parentId, { requireWritableScope: true });
  const notificationIntent = normalizeNotificationIntent(input.notificationIntent);

  if (input.file) {
    return createUploadedResource(session, parent, input, notificationIntent);
  }

  return createExternalResource(session, parent, input, notificationIntent);
}

export async function updateResourceAttachment(session: AuthSession, attachmentId: string, input: UpdateResourceAttachmentInput) {
  assertCanManageResources(session);
  const current = await getResourceAttachmentForManagement(session, attachmentId);
  const patch = normalizeUpdateInput(input);
  if (!Object.keys(patch).length) return current;

  const action: ResourceAuditAction =
    "display_order" in patch
      ? "resource_reordered"
      : "visibility" in patch && Object.keys(patch).length === 1
      ? "visibility_changed"
      : "metadata_edited";

  if (current.source === "local") {
    const updated = { ...current, ...toLocalPatch(patch), updatedAt: new Date().toISOString() };
    replaceLocalResource(updated);
    return updated;
  }

  const result = await getSupabaseAdminClient()
    .from("resource_attachments")
    .update(patch)
    .eq("id", attachmentId)
    .select("*")
    .single<ResourceAttachmentRow>();
  throwIfResourceError(result.error, "Resource could not be updated.");
  if (!result.data) throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
  const updated = toResourceAttachment(result.data, "live");
  await insertResourceAudit(session, updated, action, { before: summarizeResource(current), after: summarizeResource(updated) });
  return updated;
}

export async function archiveResourceAttachment(session: AuthSession, attachmentId: string, restore = false) {
  assertCanManageResources(session);
  const current = await getResourceAttachmentForManagement(session, attachmentId, { includeArchived: true });
  const archivedAt = restore ? undefined : new Date().toISOString();

  if (current.source === "local") {
    const updated = { ...current, archivedAt, updatedAt: new Date().toISOString() };
    replaceLocalResource(updated);
    return updated;
  }

  const result = await getSupabaseAdminClient()
    .from("resource_attachments")
    .update({ archived_at: archivedAt ?? null })
    .eq("id", attachmentId)
    .select("*")
    .single<ResourceAttachmentRow>();
  throwIfResourceError(result.error, "Resource could not be archived.");
  if (!result.data) throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
  const updated = toResourceAttachment(result.data, "live");
  await insertResourceAudit(session, updated, restore ? "resource_restored" : "resource_archived", {
    before: summarizeResource(current),
    after: summarizeResource(updated)
  });
  return updated;
}

export async function permanentlyDeleteResourceAttachment(session: AuthSession, attachmentId: string) {
  assertCanManageResources(session);
  const current = await getResourceAttachmentForManagement(session, attachmentId, { includeArchived: true });

  if (current.source === "local") {
    removeLocalResource(current);
    return { ok: true };
  }

  await insertResourceAudit(session, current, "resource_permanently_deleted", { deleted: summarizeResource(current) });

  const deleteResult = await getSupabaseAdminClient().from("resource_attachments").delete().eq("id", attachmentId);
  throwIfResourceError(deleteResult.error, "Resource could not be permanently deleted.");

  if (current.storagePath) {
    const storage = await getSupabaseAdminClient().storage.from(resourceBucketName).remove([current.storagePath]);
    throwIfResourceError(storage.error, "Resource file could not be removed from storage.");
  }

  return { ok: true };
}

export async function replaceResourceAttachmentFile(session: AuthSession, attachmentId: string, file: File) {
  assertCanManageResources(session);
  const current = await getResourceAttachmentForManagement(session, attachmentId, { includeArchived: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateResourceFile({ bytes, filename: file.name, declaredMimeType: file.type });
  const storagePath = buildStoragePath({
    attachmentId: current.id,
    filename: validated.safeFilename,
    organizationId: current.organizationId,
    parentId: current.parentId,
    parentType: current.parentType
  });

  if (current.source === "local" || !shouldUseLiveResources(session)) {
    const updated: ResourceAttachment = {
      ...current,
      externalUrl: undefined,
      fileSizeBytes: validated.fileSizeBytes,
      mimeType: validated.mimeType,
      originalFilename: validated.originalFilename,
      resourceType: validated.resourceType,
      storageBucket: resourceBucketName,
      storagePath,
      updatedAt: new Date().toISOString()
    };
    localStore.dataUrlsByAttachmentId.set(current.id, `data:${validated.mimeType};base64,${bytes.toString("base64")}`);
    replaceLocalResource(updated);
    return updated;
  }

  const supabase = getSupabaseAdminClient();
  const upload = await supabase.storage.from(resourceBucketName).upload(storagePath, bytes, {
    contentType: validated.mimeType,
    upsert: false
  });
  throwIfResourceError(upload.error, "Replacement file could not be uploaded.");

  const result = await supabase
    .from("resource_attachments")
    .update({
      external_url: null,
      file_size_bytes: validated.fileSizeBytes,
      mime_type: validated.mimeType,
      original_filename: validated.originalFilename,
      resource_type: validated.resourceType,
      storage_bucket: resourceBucketName,
      storage_path: storagePath
    })
    .eq("id", attachmentId)
    .select("*")
    .single<ResourceAttachmentRow>();

  if (result.error || !result.data) {
    await supabase.storage.from(resourceBucketName).remove([storagePath]);
    throwIfResourceError(result.error, "Replacement file could not be saved.");
    throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
  }

  if (current.storagePath && current.storagePath !== storagePath) {
    await supabase.storage.from(resourceBucketName).remove([current.storagePath]);
  }

  const updated = toResourceAttachment(result.data, "live");
  await insertResourceAudit(session, updated, "file_replaced", {
    before: summarizeResource(current),
    after: summarizeResource(updated)
  });
  return updated;
}

export async function getResourceAttachmentOpenUrl(session: AuthSession | null, attachmentId: string, options: { download?: boolean } = {}) {
  const resource = await getResourceAttachmentForRead(session, attachmentId);
  if (resource.archivedAt) throw new ResourceAttachmentError("Resource has been archived.", 404, "archived");

  if (!canReadResourceVisibility(session, resource.visibility, resource.parentType)) {
    throw new ResourceAttachmentError("You do not have access to this resource.", 403, "not_allowed");
  }

  if (resource.externalUrl) {
    return { expiresIn: null, url: resource.externalUrl };
  }

  if (resource.source === "local") {
    const dataUrl = localStore.dataUrlsByAttachmentId.get(resource.id);
    if (!dataUrl) throw new ResourceAttachmentError("Preview file storage is not available.", 404, "file_not_found");
    return { expiresIn: null, url: dataUrl };
  }

  if (!resource.storagePath) throw new ResourceAttachmentError("Resource file is missing.", 404, "file_not_found");

  const signed = await getSupabaseAdminClient()
    .storage
    .from(resourceBucketName)
    .createSignedUrl(resource.storagePath, 300, options.download ? { download: resource.originalFilename ?? true } : undefined);
  throwIfResourceError(signed.error, "Resource could not be opened.");
  if (!signed.data?.signedUrl) throw new ResourceAttachmentError("Resource could not be opened.", 500, "signed_url_missing");
  return { expiresIn: 300, url: signed.data.signedUrl };
}

export function canManageResourceAttachments(session: AuthSession | null) {
  return isResourceManager(session);
}

export function resourceStorageReady(session: AuthSession | null) {
  return shouldUseLiveResources(session);
}

export function resetLocalResourceAttachmentsForTests() {
  localStore.resourcesByParent.clear();
  localStore.dataUrlsByAttachmentId.clear();
}

async function createExternalResource(
  session: AuthSession,
  parent: ParentResolution,
  input: CreateResourceAttachmentInput,
  notificationIntent: ResourceNotificationIntent
) {
  const externalUrl = normalizeExternalUrl(input.externalUrl);
  const resourceType = normalizeResourceType(input.resourceType, inferExternalResourceType(externalUrl));
  const now = new Date().toISOString();
  const title = normalizedText(input.title, titleFromUrl(externalUrl), 140);
  const resource: ResourceAttachment = {
    id: randomUUID(),
    organizationId: parent.organizationId,
    parentId: parent.parentId,
    parentType: parent.parentType,
    title,
    description: normalizedText(input.description, "", 500),
    resourceType,
    storageBucket: resourceBucketName,
    externalUrl,
    displayOrder: await nextDisplayOrder(session, parent),
    visibility: normalizeResourceVisibility(input.visibility),
    isFeatured: Boolean(input.isFeatured),
    isDownloadable: input.isDownloadable ?? true,
    opensInNewTab: input.opensInNewTab ?? true,
    uploadedBy: session.user.id,
    createdAt: now,
    updatedAt: now,
    source: shouldUseLiveResources(session) ? "live" : "local"
  };

  if (!shouldUseLiveResources(session)) {
    addLocalResource(resource);
    return resource;
  }

  const result = await getSupabaseAdminClient()
    .from("resource_attachments")
    .insert(toInsertRow(resource))
    .select("*")
    .single<ResourceAttachmentRow>();
  throwIfResourceError(result.error, "External link could not be saved.");
  if (!result.data) throw new ResourceAttachmentError("External link was not saved.", 500, "missing_saved_resource");
  const saved = toResourceAttachment(result.data, "live");
  await insertResourceAudit(session, saved, "external_link_added", { notificationIntent, resource: summarizeResource(saved) });
  return saved;
}

async function createUploadedResource(
  session: AuthSession,
  parent: ParentResolution,
  input: CreateResourceAttachmentInput,
  notificationIntent: ResourceNotificationIntent
) {
  if (!input.file) throw new ResourceAttachmentError("File is required.", 400, "missing_file");
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const validated = validateResourceFile({ bytes, filename: input.file.name, declaredMimeType: input.file.type });
  const attachmentId = randomUUID();
  const storagePath = buildStoragePath({
    attachmentId,
    filename: validated.safeFilename,
    organizationId: parent.organizationId,
    parentId: parent.parentId,
    parentType: parent.parentType
  });
  const now = new Date().toISOString();
  const resource: ResourceAttachment = {
    id: attachmentId,
    organizationId: parent.organizationId,
    parentId: parent.parentId,
    parentType: parent.parentType,
    title: normalizedText(input.title, titleFromFilename(validated.safeFilename), 140),
    description: normalizedText(input.description, "", 500),
    resourceType: validated.resourceType,
    storageBucket: resourceBucketName,
    storagePath,
    originalFilename: validated.originalFilename,
    mimeType: validated.mimeType,
    fileSizeBytes: validated.fileSizeBytes,
    displayOrder: await nextDisplayOrder(session, parent),
    visibility: normalizeResourceVisibility(input.visibility),
    isFeatured: Boolean(input.isFeatured),
    isDownloadable: input.isDownloadable ?? true,
    opensInNewTab: input.opensInNewTab ?? true,
    uploadedBy: session.user.id,
    createdAt: now,
    updatedAt: now,
    source: shouldUseLiveResources(session) ? "live" : "local"
  };

  if (!shouldUseLiveResources(session)) {
    localStore.dataUrlsByAttachmentId.set(resource.id, `data:${validated.mimeType};base64,${bytes.toString("base64")}`);
    addLocalResource(resource);
    return resource;
  }

  const supabase = getSupabaseAdminClient();
  const upload = await supabase.storage.from(resourceBucketName).upload(storagePath, bytes, {
    contentType: validated.mimeType,
    upsert: false
  });
  throwIfResourceError(upload.error, "File could not be uploaded.");

  const result = await supabase.from("resource_attachments").insert(toInsertRow(resource)).select("*").single<ResourceAttachmentRow>();
  if (result.error || !result.data) {
    await supabase.storage.from(resourceBucketName).remove([storagePath]);
    throwIfResourceError(result.error, "File record could not be saved.");
    throw new ResourceAttachmentError("File record was not saved.", 500, "missing_saved_resource");
  }

  const saved = toResourceAttachment(result.data, "live");
  await insertResourceAudit(session, saved, "resource_uploaded", { notificationIntent, resource: summarizeResource(saved) });
  return saved;
}

async function getResourceAttachmentForRead(session: AuthSession | null, attachmentId: string) {
  const live = shouldUseLiveResources(session);
  if (!live) {
    const local = findLocalResource(attachmentId);
    if (!local) throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
    return local;
  }

  const result = await getSupabaseAdminClient().from("resource_attachments").select("*").eq("id", attachmentId).single<ResourceAttachmentRow>();
  if (isMissingResourceTableError(result.error)) {
    const local = findLocalResource(attachmentId);
    if (!local) throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
    return local;
  }
  throwIfResourceError(result.error, "Resource could not be loaded.");
  if (!result.data) throw new ResourceAttachmentError("Resource not found.", 404, "not_found");
  return toResourceAttachment(result.data, "live");
}

async function getResourceAttachmentForManagement(session: AuthSession, attachmentId: string, options: { includeArchived?: boolean } = {}) {
  const resource = await getResourceAttachmentForRead(session, attachmentId);
  if (!options.includeArchived && resource.archivedAt) throw new ResourceAttachmentError("Resource has been archived.", 404, "archived");
  if (!isResourceManager(session)) throw new ResourceAttachmentError("Only admins can manage resources.", 403, "not_allowed");
  return resource;
}

async function resolveResourceParent(
  session: AuthSession | null,
  rawParentType: string,
  rawParentId: string,
  options: { requireWritableScope?: boolean } = {}
): Promise<ParentResolution> {
  const parentType = normalizeResourceParentType(rawParentType);
  const parentId = rawParentId.trim();
  if (!parentId) throw new ResourceAttachmentError("Parent record is required.", 400, "missing_parent");

  if (parentType === "event" || parentType === "event_task") {
    if (!session) throw new ResourceAttachmentError("Authentication is required for this resource.", 401, "unauthorized");
    if (!shouldUseLiveResources(session)) {
      return { organizationId: (await resolveMinistryScope(session)) ?? DEFAULT_MINISTRY_ID, parentId, parentType };
    }

    const table = parentType === "event" ? "events" : "tasks";
    const result = await getSupabaseAdminClient()
      .from(table)
      .select("id,ministry_id")
      .eq("id", parentId)
      .maybeSingle<{ id: string; ministry_id: string | null }>();
    throwIfResourceError(result.error, "Parent record could not be verified.");
    if (!result.data) throw new ResourceAttachmentError("The linked parent record could not be found.", 404, "parent_not_found");
    return {
      organizationId: result.data.ministry_id ?? (await requiredMinistryId(session)),
      parentId,
      parentType
    };
  }

  assertKnownStaticParent(parentType, parentId);
  return {
    organizationId: await staticResourceOrganizationId(session, options),
    parentId,
    parentType
  };
}

async function staticResourceOrganizationId(session: AuthSession | null, options: { requireWritableScope?: boolean }) {
  if (!session || session.isGuest || session.isMock) return DEFAULT_MINISTRY_ID;

  const ministryId = await resolveMinistryScope(session);
  if (ministryId) return ministryId;
  if (!options.requireWritableScope) return DEFAULT_MINISTRY_ID;

  throw new ResourceAttachmentError("Resource storage needs this account to have a ministry profile.", 409, "missing_ministry");
}

async function requiredMinistryId(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (ministryId) return ministryId;
  throw new ResourceAttachmentError("Resource storage needs this account to have a ministry profile.", 409, "missing_ministry");
}

async function nextDisplayOrder(session: AuthSession, parent: ParentResolution) {
  if (!shouldUseLiveResources(session)) {
    const values = localResourcesForParent(parent).map((resource) => resource.displayOrder);
    return values.length ? Math.max(...values) + 1 : 0;
  }

  const result = await getSupabaseAdminClient()
    .from("resource_attachments")
    .select("display_order")
    .eq("organization_id", parent.organizationId)
    .eq("parent_type", parent.parentType)
    .eq("parent_id", parent.parentId)
    .order("display_order", { ascending: false })
    .limit(1)
    .returns<Array<{ display_order: number | null }>>();
  if (result.error) return 0;
  return (result.data?.[0]?.display_order ?? -1) + 1;
}

async function insertResourceAudit(
  session: AuthSession,
  resource: Pick<ResourceAttachment, "id" | "organizationId" | "parentId" | "parentType">,
  action: ResourceAuditAction,
  changedValues: Record<string, unknown>
) {
  if (!shouldUseLiveResources(session)) return;
  const result = await getSupabaseAdminClient().from("resource_attachment_audit").insert({
    action,
    actor_user_id: session.user.id,
    changed_values: changedValues,
    organization_id: resource.organizationId,
    parent_id: resource.parentId,
    parent_type: resource.parentType,
    resource_attachment_id: resource.id
  });
  throwIfResourceError(result.error, "Resource audit entry could not be saved.");
}

function normalizeUpdateInput(input: UpdateResourceAttachmentInput) {
  const patch: Record<string, boolean | number | string | null> = {};
  if (input.title !== undefined) patch.title = normalizedText(input.title, "", 140);
  if (input.description !== undefined) patch.description = normalizedText(input.description, "", 500);
  if (input.visibility !== undefined) patch.visibility = normalizeResourceVisibility(input.visibility);
  if (input.displayOrder !== undefined) patch.display_order = Math.max(0, Math.min(Math.trunc(input.displayOrder), 9999));
  if (input.isFeatured !== undefined) patch.is_featured = Boolean(input.isFeatured);
  if (input.isDownloadable !== undefined) patch.is_downloadable = Boolean(input.isDownloadable);
  if (input.opensInNewTab !== undefined) patch.opens_in_new_tab = Boolean(input.opensInNewTab);
  return patch;
}

function toLocalPatch(patch: Record<string, boolean | number | string | null>): Partial<ResourceAttachment> {
  return {
    ...(typeof patch.title === "string" ? { title: patch.title } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(typeof patch.visibility === "string" ? { visibility: patch.visibility as ResourceVisibility } : {}),
    ...(typeof patch.display_order === "number" ? { displayOrder: patch.display_order } : {}),
    ...(typeof patch.is_featured === "boolean" ? { isFeatured: patch.is_featured } : {}),
    ...(typeof patch.is_downloadable === "boolean" ? { isDownloadable: patch.is_downloadable } : {}),
    ...(typeof patch.opens_in_new_tab === "boolean" ? { opensInNewTab: patch.opens_in_new_tab } : {})
  };
}

function toInsertRow(resource: ResourceAttachment) {
  return {
    id: resource.id,
    organization_id: resource.organizationId,
    parent_id: resource.parentId,
    parent_type: resource.parentType,
    title: resource.title,
    description: resource.description,
    resource_type: resource.resourceType,
    storage_bucket: resource.storageBucket,
    storage_path: resource.storagePath ?? null,
    external_url: resource.externalUrl ?? null,
    original_filename: resource.originalFilename ?? null,
    mime_type: resource.mimeType ?? null,
    file_size_bytes: resource.fileSizeBytes ?? null,
    display_order: resource.displayOrder,
    visibility: resource.visibility,
    is_featured: resource.isFeatured,
    is_downloadable: resource.isDownloadable,
    opens_in_new_tab: resource.opensInNewTab,
    uploaded_by: resource.uploadedBy ?? null
  };
}

function toResourceAttachment(row: ResourceAttachmentRow, source: ResourceAttachment["source"]): ResourceAttachment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    parentId: row.parent_id,
    parentType: row.parent_type,
    title: row.title,
    description: row.description,
    resourceType: row.resource_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path ?? undefined,
    externalUrl: row.external_url ?? undefined,
    originalFilename: row.original_filename ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    displayOrder: row.display_order ?? 0,
    visibility: row.visibility,
    isFeatured: Boolean(row.is_featured),
    isDownloadable: row.is_downloadable ?? true,
    opensInNewTab: row.opens_in_new_tab ?? true,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    source
  };
}

function listLocalResources(session: AuthSession | null, parent: ParentResolution, includeArchived = false) {
  return localResourcesForParent(parent)
    .filter((resource) => includeArchived || !resource.archivedAt)
    .filter((resource) => canReadResourceVisibility(session, resource.visibility, resource.parentType))
    .sort((first, second) => first.displayOrder - second.displayOrder || first.createdAt.localeCompare(second.createdAt));
}

function addLocalResource(resource: ResourceAttachment) {
  const resources = localResourcesForParent(resource);
  resources.push(resource);
  localStore.resourcesByParent.set(localParentKey(resource), resources);
}

function replaceLocalResource(resource: ResourceAttachment) {
  const resources = localResourcesForParent(resource).map((item) => (item.id === resource.id ? resource : item));
  localStore.resourcesByParent.set(localParentKey(resource), resources);
}

function removeLocalResource(resource: ResourceAttachment) {
  localStore.resourcesByParent.set(
    localParentKey(resource),
    localResourcesForParent(resource).filter((item) => item.id !== resource.id)
  );
  localStore.dataUrlsByAttachmentId.delete(resource.id);
}

function findLocalResource(attachmentId: string) {
  const resourceSets = Array.from(localStore.resourcesByParent.values());
  for (let index = 0; index < resourceSets.length; index += 1) {
    const resources = resourceSets[index];
    const resource = resources.find((item: ResourceAttachment) => item.id === attachmentId);
    if (resource) return resource;
  }
  return undefined;
}

function localResourcesForParent(parent: Pick<ResourceAttachment, "organizationId" | "parentId" | "parentType">) {
  return [...(localStore.resourcesByParent.get(localParentKey(parent)) ?? [])];
}

function localParentKey(parent: Pick<ResourceAttachment, "organizationId" | "parentId" | "parentType">) {
  return `${parent.organizationId}:${parent.parentType}:${parent.parentId}`;
}

function buildStoragePath(input: { attachmentId: string; filename: string; organizationId: string; parentId: string; parentType: ResourceParentType }) {
  return [
    "organizations",
    input.organizationId,
    "resources",
    input.parentType,
    encodePathSegment(input.parentId),
    input.attachmentId,
    input.filename
  ].join("/");
}

function encodePathSegment(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "record";
}

function normalizedText(value: string | undefined, fallback: string, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.slice(0, maxLength);
}

function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return parentResourceTitle("communication_draft", "External Resource");
  }
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Resource";
}

function summarizeResource(resource: ResourceAttachment) {
  return {
    id: resource.id,
    title: resource.title,
    visibility: resource.visibility,
    displayOrder: resource.displayOrder,
    resourceType: resource.resourceType,
    storagePath: resource.storagePath,
    externalUrl: resource.externalUrl
  };
}

function shouldUseLiveResources(session: AuthSession | null) {
  return Boolean(isSupabaseAdminConfigured() && !session?.isMock);
}

function assertCanManageResources(session: AuthSession) {
  if (!isResourceManager(session)) {
    throw new ResourceAttachmentError("Only admins can manage resources.", 403, "not_allowed");
  }
}

function throwIfResourceError(error: { message?: string; code?: string } | null | undefined, fallback: string): asserts error is null | undefined {
  if (!error) return;
  if (isMissingResourceTableError(error)) {
    throw new ResourceAttachmentError("Resource attachments storage is not configured yet.", 503, "storage_not_ready");
  }
  throw new ResourceAttachmentError(error.message || fallback, 500, "storage_error");
}

function isMissingResourceTableError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /resource_attachments|resource_attachment_audit|schema cache|does not exist|could not find the table/i.test(error.message ?? "");
}

export function resourceAttachmentErrorResponse(error: unknown) {
  if (error instanceof ResourceAttachmentError || error instanceof ResourceRegistryError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  if (error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number") {
    return {
      error: error.message,
      code: "resource_error",
      status: (error as { status: number }).status
    };
  }
  return { error: "Resource request could not be completed.", code: "resource_error", status: 500 };
}
