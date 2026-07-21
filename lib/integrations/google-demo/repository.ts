import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAdminClient, isSupabaseAdminConfigured, type AuthSession } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { validateResourceFile } from "@/lib/resources/file-validation";
import type { ResourceAttachment } from "@/lib/resources/types";
import {
  createGoogleDemoCalendarEvent,
  exchangeGoogleDemoCode,
  findGoogleDemoCalendar,
  findOrCreateGoogleDemoDriveFolder,
  getGoogleDemoAccountEmail,
  GOOGLE_DEMO_CALENDAR_NAME,
  GOOGLE_DEMO_DRIVE_ROOT_NAME,
  GoogleDemoConfigError,
  GoogleDemoSyncTokenExpiredError,
  listGoogleDemoCalendarEvents,
  listGoogleDemoDriveFilesInFolder,
  readGoogleDemoConfig,
  refreshGoogleDemoAccessToken,
  updateGoogleDemoCalendarEvent,
  uploadGoogleDemoDriveFile,
  type GoogleDemoCalendarEvent
} from "@/lib/integrations/google-demo/client";

const PROVIDER = "google_demo";
const PRIVATE_SCHEMA = "lead_emergence_private";

export type GoogleDemoDisplayStatus = "not_configured" | "storage_unavailable" | "disconnected" | "connected" | "error";

export type GoogleDemoStatus = {
  configured: boolean;
  storageConfigured: boolean;
  displayStatus: GoogleDemoDisplayStatus;
  connectionStatus: "connected" | "disconnected" | "error";
  connectedGoogleAccount?: string;
  selectedDemoCalendar?: string;
  selectedDemoCalendarId?: string;
  selectedDemoDriveFolder?: string;
  selectedDemoDriveFolderId?: string;
  lastCalendarSync?: string;
  lastDriveSync?: string;
  lastError?: string;
};

type MinistryIntegrationRow = {
  ministry_id: string;
  provider: typeof PROVIDER;
  status: "connected" | "disconnected" | "error";
  config: Record<string, unknown> | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

type GoogleDemoTokenRow = {
  ministry_id: string;
  google_account_email: string;
  google_calendar_id: string;
  google_calendar_name: string;
  google_drive_folder_id: string;
  google_drive_folder_name: string;
  google_refresh_token_encrypted: string;
  calendar_sync_token: string | null;
  connected_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  ministry_id: string | null;
  title: string;
  description: string | null;
  ministry_area: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  owner: string | null;
  communication_owner: string | null;
  created_by: string | null;
  google_calendar_event_id: string | null;
  google_calendar_event_url: string | null;
  google_drive_folder_id: string | null;
  google_drive_folder_url: string | null;
};

type ResourceAttachmentRow = {
  id: string;
  organization_id: string;
  parent_type: "event";
  parent_id: string;
  title: string;
  description: string;
  resource_type: "google_drive";
  storage_bucket: string;
  storage_path: string | null;
  external_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  display_order: number | null;
  visibility: "inherit_parent";
  is_featured: boolean | null;
  is_downloadable: boolean | null;
  opens_in_new_tab: boolean | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export class GoogleDemoStorageUnavailableError extends Error {
  constructor() {
    super("Google demo storage is not configured. Apply the Google demo migration and configure Supabase server access.");
    this.name = "GoogleDemoStorageUnavailableError";
  }
}

export class GoogleDemoNotConnectedError extends Error {
  constructor() {
    super("Connect the Google demo integration before syncing.");
    this.name = "GoogleDemoNotConnectedError";
  }
}

function storageConfigured() {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

function adminClient(): SupabaseClient {
  if (!storageConfigured()) throw new GoogleDemoStorageUnavailableError();
  return getSupabaseAdminClient();
}

async function ministryIdFor(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) throw new GoogleDemoStorageUnavailableError();
  return ministryId;
}

export function encryptGoogleDemoRefreshToken(token: string, encryptionKey: string) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptGoogleDemoRefreshToken(value: string, encryptionKey: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored Google demo authorization is invalid.");
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

function baseStatus(): GoogleDemoStatus {
  const configured = readGoogleDemoConfig().configured;
  const hasStorage = storageConfigured();
  return {
    configured,
    storageConfigured: hasStorage,
    displayStatus: !configured ? "not_configured" : hasStorage ? "disconnected" : "storage_unavailable",
    connectionStatus: "disconnected"
  };
}

function mapStatus(row: MinistryIntegrationRow | null, token: GoogleDemoTokenRow | null): GoogleDemoStatus {
  const current = baseStatus();
  if (!current.configured || !current.storageConfigured || !row || !token) return current;
  const config = row.config ?? {};
  const displayStatus = row.status;
  return {
    ...current,
    displayStatus,
    connectionStatus: row.status,
    connectedGoogleAccount: token.google_account_email,
    selectedDemoCalendar: token.google_calendar_name,
    selectedDemoCalendarId: token.google_calendar_id,
    selectedDemoDriveFolder: token.google_drive_folder_name,
    selectedDemoDriveFolderId: token.google_drive_folder_id,
    lastCalendarSync: typeof config.lastCalendarSync === "string" ? config.lastCalendarSync : row.last_sync_at ?? undefined,
    lastDriveSync: typeof config.lastDriveSync === "string" ? config.lastDriveSync : undefined,
    lastError: row.last_error ?? undefined
  };
}

export async function getGoogleDemoStatus(session: AuthSession): Promise<GoogleDemoStatus> {
  const current = baseStatus();
  if (!current.configured || !current.storageConfigured || session.isMock || session.isGuest) return current;

  try {
    const ministryId = await ministryIdFor(session);
    const supabase = adminClient();
    const [integrationResult, tokenResult] = await Promise.all([
      supabase
        .from("ministry_integrations")
        .select("ministry_id,provider,status,config,connected_at,last_sync_at,last_error")
        .eq("ministry_id", ministryId)
        .eq("provider", PROVIDER)
        .maybeSingle<MinistryIntegrationRow>(),
      supabase
        .schema(PRIVATE_SCHEMA)
        .from("google_demo_tokens")
        .select("*")
        .eq("ministry_id", ministryId)
        .maybeSingle<GoogleDemoTokenRow>()
    ]);
    if (integrationResult.error || tokenResult.error) throw new Error(integrationResult.error?.message ?? tokenResult.error?.message);
    return mapStatus(integrationResult.data ?? null, tokenResult.data ?? null);
  } catch (error) {
    return { ...current, displayStatus: "error", connectionStatus: "error", lastError: safeGoogleDemoError(error) };
  }
}

export async function connectGoogleDemo(session: AuthSession, code: string) {
  const config = readGoogleDemoConfig();
  if (!config.configured || !config.encryptionKey) throw new GoogleDemoConfigError(config.missing);
  const tokens = await exchangeGoogleDemoCode({ code });
  if (!tokens.refreshToken) throw new Error("Google did not return a refresh token. Disconnect this app in Google Account access and connect again.");

  const [accountEmail, calendar, driveRoot] = await Promise.all([
    getGoogleDemoAccountEmail({ accessToken: tokens.accessToken }),
    findGoogleDemoCalendar({ accessToken: tokens.accessToken }),
    findOrCreateGoogleDemoDriveFolder({ accessToken: tokens.accessToken, name: GOOGLE_DEMO_DRIVE_ROOT_NAME })
  ]);
  if (!calendar) throw new Error(`Create a secondary Google Calendar named "${GOOGLE_DEMO_CALENDAR_NAME}" before connecting.`);

  const ministryId = await ministryIdFor(session);
  const now = new Date().toISOString();
  const supabase = adminClient();
  const tokenResult = await supabase.schema(PRIVATE_SCHEMA).from("google_demo_tokens").upsert(
    {
      ministry_id: ministryId,
      google_account_email: accountEmail,
      google_calendar_id: calendar.id,
      google_calendar_name: calendar.summary,
      google_drive_folder_id: driveRoot.id,
      google_drive_folder_name: driveRoot.name,
      google_refresh_token_encrypted: encryptGoogleDemoRefreshToken(tokens.refreshToken, config.encryptionKey),
      calendar_sync_token: null,
      connected_at: now,
      updated_at: now
    },
    { onConflict: "ministry_id" }
  );
  if (tokenResult.error) throw new Error(tokenResult.error.message);

  await upsertIntegrationMetadata(supabase, ministryId, {
    status: "connected",
    connected_at: now,
    last_error: null,
    config: {
      calendarName: calendar.summary,
      calendarId: calendar.id,
      driveRootName: driveRoot.name,
      driveRootId: driveRoot.id
    }
  });
}

export async function disconnectGoogleDemo(session: AuthSession) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const tokenResult = await supabase.schema(PRIVATE_SCHEMA).from("google_demo_tokens").delete().eq("ministry_id", ministryId);
  if (tokenResult.error) throw new Error(tokenResult.error.message);
  await upsertIntegrationMetadata(supabase, ministryId, {
    status: "disconnected",
    connected_at: null,
    last_error: null,
    config: {}
  });
}

export async function syncPlatformEventToGoogle(session: AuthSession, eventId: string) {
  if (session.isMock || session.isGuest || !storageConfigured()) return { synced: false as const, reason: "unavailable" };
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await getConnectedTokenRow(supabase, ministryId);
  if (!token) return { synced: false as const, reason: "disconnected" };
  const event = await loadEventForGoogleSync(supabase, ministryId, eventId);
  if (!event) return { synced: false as const, reason: "not_found" };

  try {
    const accessToken = await freshAccessToken(token);
    const googleEvent = event.google_calendar_event_id
      ? await updateGoogleDemoCalendarEvent({
          accessToken,
          calendarId: token.google_calendar_id,
          googleEventId: event.google_calendar_event_id,
          event: toGoogleEventInput(event)
        })
      : await createGoogleDemoCalendarEvent({
          accessToken,
          calendarId: token.google_calendar_id,
          event: toGoogleEventInput(event)
        });
    const folder = await ensureGoogleDriveFolderForEventRow(supabase, ministryId, token, event, accessToken);
    const patch: Record<string, string | null> = {
      google_calendar_event_id: googleEvent.id,
      google_calendar_event_url: googleEvent.htmlLink ?? null
    };
    if (folder.created) {
      patch.google_drive_folder_id = folder.id;
      patch.google_drive_folder_url = folder.webViewLink ?? null;
    }
    const updateResult = await supabase.from("events").update(patch).eq("ministry_id", ministryId).eq("id", eventId);
    if (updateResult.error) throw new Error(updateResult.error.message);
    await markIntegrationSync(supabase, ministryId, { calendar: true, drive: Boolean(folder) });
    return { synced: true as const, googleEventId: googleEvent.id, folderId: folder.id };
  } catch (error) {
    await markIntegrationError(supabase, ministryId, safeGoogleDemoError(error));
    return { synced: false as const, reason: safeGoogleDemoError(error) };
  }
}

export async function syncGoogleDemoFromGoogle(session: AuthSession) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await getConnectedTokenRow(supabase, ministryId);
  if (!token) throw new GoogleDemoNotConnectedError();
  const accessToken = await freshAccessToken(token);

  let result: Awaited<ReturnType<typeof listGoogleDemoCalendarEvents>>;
  try {
    result = await listGoogleDemoCalendarEvents({
      accessToken,
      calendarId: token.google_calendar_id,
      syncToken: token.calendar_sync_token
    });
  } catch (error) {
    if (!(error instanceof GoogleDemoSyncTokenExpiredError)) throw error;
    result = await listGoogleDemoCalendarEvents({ accessToken, calendarId: token.google_calendar_id });
  }

  let importedCount = 0;
  let updatedCount = 0;
  for (const googleEvent of result.events) {
    const existing = await findEventByGoogleId(supabase, ministryId, googleEvent.id);
    if (existing) {
      await updatePlatformEventFromGoogle(supabase, ministryId, existing.id, googleEvent);
      updatedCount += 1;
    } else {
      const inserted = await insertImportedGoogleEvent(supabase, session, ministryId, googleEvent);
      importedCount += inserted ? 1 : 0;
      if (inserted) await ensureGoogleDriveFolderForEvent(session, inserted.id);
    }
  }

  const syncTokenResult = await supabase
    .schema(PRIVATE_SCHEMA)
    .from("google_demo_tokens")
    .update({ calendar_sync_token: result.nextSyncToken ?? null })
    .eq("ministry_id", ministryId);
  if (syncTokenResult.error) throw new Error(syncTokenResult.error.message);
  await markIntegrationSync(supabase, ministryId, { calendar: true, drive: false });
  return { importedCount, updatedCount, syncedAt: new Date().toISOString() };
}

export async function syncGoogleDemoDriveFilesForEvent(session: AuthSession, eventId: string) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await getConnectedTokenRow(supabase, ministryId);
  if (!token) throw new GoogleDemoNotConnectedError();
  await ensureGoogleDriveFolderForEvent(session, eventId);
  const event = await loadEventForGoogleSync(supabase, ministryId, eventId);
  if (!event?.google_drive_folder_id) throw new Error("This event does not have a Google Drive folder yet.");

  const accessToken = await freshAccessToken(token);
  const files = await listGoogleDemoDriveFilesInFolder({ accessToken, folderId: event.google_drive_folder_id });
  const existingResult = await supabase
    .from("resource_attachments")
    .select("external_url")
    .eq("organization_id", ministryId)
    .eq("parent_type", "event")
    .eq("parent_id", eventId)
    .eq("resource_type", "google_drive")
    .returns<Array<{ external_url: string | null }>>();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existingUrls = new Set((existingResult.data ?? []).map((row) => row.external_url).filter((url): url is string => Boolean(url)));
  const rows = files
    .filter((file) => file.mimeType !== "application/vnd.google-apps.folder" && file.webViewLink && !existingUrls.has(file.webViewLink))
    .map((file, index) => ({
      organization_id: ministryId,
      parent_type: "event",
      parent_id: eventId,
      title: file.name,
      description: "Synced from the event's Google Drive folder.",
      resource_type: "google_drive",
      storage_bucket: "resource-attachments",
      external_url: file.webViewLink,
      display_order: index + existingUrls.size,
      visibility: "inherit_parent",
      is_featured: false,
      is_downloadable: true,
      opens_in_new_tab: true,
      uploaded_by: session.user.id
    }));
  if (rows.length) {
    const insertResult = await supabase.from("resource_attachments").insert(rows);
    if (insertResult.error) throw new Error(insertResult.error.message);
  }
  await markIntegrationSync(supabase, ministryId, { calendar: false, drive: true });
  return { syncedCount: rows.length, filesSeen: files.length };
}

export async function createGoogleDriveBackedEventResource(session: AuthSession, input: {
  eventId: string;
  title?: string;
  description?: string;
  file: File;
}) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await getConnectedTokenRow(supabase, ministryId);
  if (!token) return null;
  await ensureGoogleDriveFolderForEvent(session, input.eventId);
  const event = await loadEventForGoogleSync(supabase, ministryId, input.eventId);
  if (!event?.google_drive_folder_id) return null;

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const validated = validateResourceFile({ bytes, filename: input.file.name, declaredMimeType: input.file.type });
  const accessToken = await freshAccessToken(token);
  const googleFile = await uploadGoogleDemoDriveFile({
    accessToken,
    folderId: event.google_drive_folder_id,
    name: validated.originalFilename,
    mimeType: validated.mimeType,
    bytes
  });
  if (!googleFile.webViewLink) throw new Error("Google Drive did not return a file link.");

  const resource = {
    organization_id: ministryId,
    parent_type: "event",
    parent_id: input.eventId,
    title: normalizedText(input.title, titleFromFilename(validated.originalFilename), 140),
    description: normalizedText(input.description, "Uploaded to the event Google Drive folder.", 500),
    resource_type: "google_drive",
    storage_bucket: "resource-attachments",
    external_url: googleFile.webViewLink,
    original_filename: validated.originalFilename,
    mime_type: validated.mimeType,
    file_size_bytes: validated.fileSizeBytes,
    display_order: 0,
    visibility: "inherit_parent",
    is_featured: false,
    is_downloadable: true,
    opens_in_new_tab: true,
    uploaded_by: session.user.id
  };
  const result = await supabase.from("resource_attachments").insert(resource).select("*").single<ResourceAttachmentRow>();
  if (result.error) throw new Error(result.error.message);
  await markIntegrationSync(supabase, ministryId, { calendar: false, drive: true });
  return result.data ? toResourceAttachment(result.data) : null;
}

export async function ensureGoogleDriveFolderForEvent(session: AuthSession, eventId: string) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await getConnectedTokenRow(supabase, ministryId);
  if (!token) throw new GoogleDemoNotConnectedError();
  const event = await loadEventForGoogleSync(supabase, ministryId, eventId);
  if (!event) throw new Error("Event not found.");
  const accessToken = await freshAccessToken(token);
  const folder = await ensureGoogleDriveFolderForEventRow(supabase, ministryId, token, event, accessToken);
  if (folder.created) await markIntegrationSync(supabase, ministryId, { calendar: false, drive: true });
  return folder;
}

async function ensureGoogleDriveFolderForEventRow(
  supabase: SupabaseClient,
  ministryId: string,
  token: GoogleDemoTokenRow,
  event: EventRow,
  accessToken: string
) {
  if (event.google_drive_folder_id) {
    return {
      id: event.google_drive_folder_id,
      webViewLink: event.google_drive_folder_url ?? undefined,
      created: false
    };
  }
  const folder = await findOrCreateGoogleDemoDriveFolder({
    accessToken,
    name: event.title,
    parentId: token.google_drive_folder_id
  });
  const updateResult = await supabase
    .from("events")
    .update({
      google_drive_folder_id: folder.id,
      google_drive_folder_url: folder.webViewLink ?? null
    })
    .eq("ministry_id", ministryId)
    .eq("id", event.id);
  if (updateResult.error) throw new Error(updateResult.error.message);
  return { id: folder.id, webViewLink: folder.webViewLink, created: true };
}

async function getConnectedTokenRow(supabase: SupabaseClient, ministryId: string) {
  const [integrationResult, tokenResult] = await Promise.all([
    supabase
      .from("ministry_integrations")
      .select("status")
      .eq("ministry_id", ministryId)
      .eq("provider", PROVIDER)
      .maybeSingle<{ status: string }>(),
    supabase.schema(PRIVATE_SCHEMA).from("google_demo_tokens").select("*").eq("ministry_id", ministryId).maybeSingle<GoogleDemoTokenRow>()
  ]);
  if (integrationResult.error || tokenResult.error) throw new Error(integrationResult.error?.message ?? tokenResult.error?.message);
  if (integrationResult.data?.status !== "connected" || !tokenResult.data) return null;
  return tokenResult.data;
}

async function freshAccessToken(token: GoogleDemoTokenRow) {
  const config = readGoogleDemoConfig();
  if (!config.configured || !config.encryptionKey) throw new GoogleDemoConfigError(config.missing);
  const refreshToken = decryptGoogleDemoRefreshToken(token.google_refresh_token_encrypted, config.encryptionKey);
  return (await refreshGoogleDemoAccessToken({ refreshToken })).accessToken;
}

async function loadEventForGoogleSync(supabase: SupabaseClient, ministryId: string, eventId: string) {
  const result = await supabase
    .from("events")
    .select(
      "id,ministry_id,title,description,ministry_area,start_date,end_date,start_time,end_time,location,owner,communication_owner,created_by,google_calendar_event_id,google_calendar_event_url,google_drive_folder_id,google_drive_folder_url"
    )
    .eq("ministry_id", ministryId)
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? null;
}

function toGoogleEventInput(event: EventRow) {
  return {
    title: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    startTime: fromDateAndTime(event.start_date, event.start_time),
    endTime: fromDateAndTime(event.end_date ?? event.start_date, event.end_time ?? event.start_time),
    platformEventId: event.id
  };
}

async function findEventByGoogleId(supabase: SupabaseClient, ministryId: string, googleEventId: string) {
  const result = await supabase
    .from("events")
    .select("id")
    .eq("ministry_id", ministryId)
    .eq("google_calendar_event_id", googleEventId)
    .maybeSingle<{ id: string }>();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? null;
}

async function updatePlatformEventFromGoogle(supabase: SupabaseClient, ministryId: string, eventId: string, googleEvent: GoogleDemoCalendarEvent) {
  const start = googleEvent.start ? new Date(googleEvent.start) : null;
  const end = googleEvent.end ? new Date(googleEvent.end) : start;
  const patch: Record<string, string | null> = {
    title: googleEvent.summary,
    location: googleEvent.location ?? null,
    google_calendar_event_url: googleEvent.htmlLink ?? null
  };
  if (start) {
    patch.start_date = toDateOnly(start);
    patch.start_time = toTimeOnly(start);
  }
  if (end) {
    patch.end_date = toDateOnly(end);
    patch.end_time = toTimeOnly(end);
  }
  const result = await supabase.from("events").update(patch).eq("ministry_id", ministryId).eq("id", eventId);
  if (result.error) throw new Error(result.error.message);
}

async function insertImportedGoogleEvent(
  supabase: SupabaseClient,
  session: AuthSession,
  ministryId: string,
  googleEvent: GoogleDemoCalendarEvent
) {
  if (!googleEvent.start) return null;
  const start = new Date(googleEvent.start);
  const end = googleEvent.end ? new Date(googleEvent.end) : start;
  const result = await supabase
    .from("events")
    .insert({
      ministry_id: ministryId,
      title: googleEvent.summary,
      ministry_area: "other",
      description: "Imported from Google Calendar. Planning details incomplete.",
      vision: "",
      start_date: toDateOnly(start),
      end_date: toDateOnly(end),
      start_time: toTimeOnly(start),
      end_time: toTimeOnly(end),
      location: googleEvent.location ?? null,
      owner: session.user.id,
      status: "planning",
      priority: "normal",
      budget_actual: 0,
      communication_owner: session.user.id,
      created_by: session.user.id,
      google_calendar_event_id: googleEvent.id,
      google_calendar_event_url: googleEvent.htmlLink ?? null,
      google_import_status: "planning_details_incomplete"
    })
    .select("id")
    .single<{ id: string }>();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? null;
}

async function upsertIntegrationMetadata(
  supabase: SupabaseClient,
  ministryId: string,
  input: {
    status: "connected" | "disconnected" | "error";
    connected_at: string | null;
    last_error: string | null;
    config: Record<string, unknown>;
  }
) {
  const result = await supabase.from("ministry_integrations").upsert(
    {
      ministry_id: ministryId,
      provider: PROVIDER,
      status: input.status,
      connected_at: input.connected_at,
      last_error: input.last_error,
      config: input.config
    },
    { onConflict: "ministry_id,provider" }
  );
  if (result.error) throw new Error(result.error.message);
}

async function markIntegrationSync(supabase: SupabaseClient, ministryId: string, input: { calendar: boolean; drive: boolean }) {
  const now = new Date().toISOString();
  const current = await supabase
    .from("ministry_integrations")
    .select("config")
    .eq("ministry_id", ministryId)
    .eq("provider", PROVIDER)
    .maybeSingle<{ config: Record<string, unknown> | null }>();
  if (current.error) throw new Error(current.error.message);
  const config = { ...(current.data?.config ?? {}) };
  if (input.calendar) config.lastCalendarSync = now;
  if (input.drive) config.lastDriveSync = now;
  const result = await supabase
    .from("ministry_integrations")
    .update({ status: "connected", last_sync_at: now, last_error: null, config })
    .eq("ministry_id", ministryId)
    .eq("provider", PROVIDER);
  if (result.error) throw new Error(result.error.message);
}

async function markIntegrationError(supabase: SupabaseClient, ministryId: string, message: string) {
  const result = await supabase
    .from("ministry_integrations")
    .update({ status: "error", last_error: message })
    .eq("ministry_id", ministryId)
    .eq("provider", PROVIDER);
  if (result.error) throw new Error(result.error.message);
}

function safeGoogleDemoError(error: unknown) {
  if (
    error instanceof GoogleDemoConfigError ||
    error instanceof GoogleDemoStorageUnavailableError ||
    error instanceof GoogleDemoNotConnectedError
  ) {
    return error.message;
  }
  if (error instanceof Error && /Create a secondary Google Calendar|refresh token|not have a Google Drive folder/i.test(error.message)) {
    return error.message;
  }
  return "Google demo sync failed. Reconnect the account or try again.";
}

export function redactGoogleDemoError(error: unknown) {
  return safeGoogleDemoError(error);
}

function fromDateAndTime(date?: string | null, time?: string | null) {
  if (!date) return new Date().toISOString();
  return new Date(`${date}T${normalizeTime(time)}`).toISOString();
}

function normalizeTime(value?: string | null) {
  if (!value) return "12:00:00";
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeOnly(date: Date) {
  return date.toISOString().slice(11, 16);
}

function normalizedText(value: string | undefined, fallback: string, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.slice(0, maxLength);
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Resource";
}

function toResourceAttachment(row: ResourceAttachmentRow): ResourceAttachment {
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
    source: "live"
  };
}
