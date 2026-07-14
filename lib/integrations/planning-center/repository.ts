import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
  type AuthSession
} from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import {
  isPlanningCenterTokenExpired,
  listPlanningCenterAttendance,
  listPlanningCenterPeople,
  readPlanningCenterConfig,
  refreshPlanningCenterAccessToken,
  type PlanningCenterAttendanceRef,
  type PlanningCenterPersonRef,
  type PlanningCenterTokens
} from "@/lib/integrations/planning-center/client";

const PROVIDER = "planning_center";
const PRIVATE_SCHEMA = "lead_emergence_private";

export type PlanningCenterConnectionStatus = "disconnected" | "connected" | "error";
export type PlanningCenterDisplayStatus = "not_configured" | "storage_unavailable" | "disconnected" | "connected" | "error";

export type PlanningCenterStatus = {
  configured: boolean;
  storageConfigured: boolean;
  status: PlanningCenterConnectionStatus;
  displayStatus: PlanningCenterDisplayStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  peopleCount: number;
  attendanceCount: number;
};

export type PlanningCenterSyncResult = {
  status: "succeeded";
  peopleCount: number;
  attendanceCount: number;
  syncedAt: string;
};

type MinistryIntegrationRow = {
  ministry_id: string;
  provider: typeof PROVIDER;
  status: PlanningCenterConnectionStatus;
  config: Record<string, unknown>;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

type PlanningCenterTokenRow = {
  ministry_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string | null;
};

export class PlanningCenterStorageUnavailableError extends Error {
  constructor() {
    super("Planning Center storage is not configured. Apply the migration and configure SUPABASE_SERVICE_ROLE_KEY.");
    this.name = "PlanningCenterStorageUnavailableError";
  }
}

export class PlanningCenterNotConnectedError extends Error {
  constructor() {
    super("Planning Center is not connected.");
    this.name = "PlanningCenterNotConnectedError";
  }
}

export class PlanningCenterConnectionInvalidError extends Error {
  constructor() {
    super("Planning Center connection is invalid. Reconnect from Settings.");
    this.name = "PlanningCenterConnectionInvalidError";
  }
}

export class PlanningCenterConnectionExpiredError extends Error {
  constructor() {
    super("Planning Center connection expired. Reconnect from Settings.");
    this.name = "PlanningCenterConnectionExpiredError";
  }
}

function storageConfigured() {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

function adminClient(): SupabaseClient {
  if (!storageConfigured()) throw new PlanningCenterStorageUnavailableError();
  return getSupabaseAdminClient();
}

async function ministryIdFor(session: AuthSession): Promise<string> {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) throw new PlanningCenterStorageUnavailableError();
  return ministryId;
}

function baseStatus(): PlanningCenterStatus {
  const configured = readPlanningCenterConfig().configured;
  const hasStorage = storageConfigured();
  return {
    configured,
    storageConfigured: hasStorage,
    status: "disconnected",
    displayStatus: !configured ? "not_configured" : hasStorage ? "disconnected" : "storage_unavailable",
    peopleCount: 0,
    attendanceCount: 0
  };
}

function mapStatus(row: MinistryIntegrationRow | null, peopleCount: number, attendanceCount: number): PlanningCenterStatus {
  const current = baseStatus();
  if (!current.configured || !current.storageConfigured || !row) {
    return current;
  }
  return {
    ...current,
    status: row.status,
    displayStatus: row.status,
    connectedAt: row.connected_at ?? undefined,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastError: row.last_error ?? undefined,
    peopleCount,
    attendanceCount
  };
}

function safeSetupError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/relation .* does not exist/i.test(message) || /schema .* does not exist/i.test(message)) {
    return "Planning Center tables are not migrated yet.";
  }
  return "Planning Center status is temporarily unavailable.";
}

export async function getPlanningCenterStatus(session: AuthSession): Promise<PlanningCenterStatus> {
  const current = baseStatus();
  if (!current.configured || !current.storageConfigured || session.isMock) return current;

  try {
    const ministryId = await ministryIdFor(session);
    const supabase = adminClient();
    const [{ data: integration, error: integrationError }, peopleResult, attendanceResult] = await Promise.all([
      supabase
        .from("ministry_integrations")
        .select("ministry_id,provider,status,config,connected_at,last_sync_at,last_error")
        .eq("ministry_id", ministryId)
        .eq("provider", PROVIDER)
        .maybeSingle<MinistryIntegrationRow>(),
      supabase
        .from("planning_center_people_refs")
        .select("id", { count: "exact", head: true })
        .eq("ministry_id", ministryId),
      supabase
        .from("planning_center_attendance_refs")
        .select("id", { count: "exact", head: true })
        .eq("ministry_id", ministryId)
    ]);

    if (integrationError) throw new Error(integrationError.message);
    if (peopleResult.error) throw new Error(peopleResult.error.message);
    if (attendanceResult.error) throw new Error(attendanceResult.error.message);

    return mapStatus(integration ?? null, peopleResult.count ?? 0, attendanceResult.count ?? 0);
  } catch (error) {
    return { ...current, status: "error", displayStatus: "error", lastError: safeSetupError(error) };
  }
}

export async function connectPlanningCenter(session: AuthSession, tokens: PlanningCenterTokens): Promise<void> {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const now = new Date().toISOString();

  const tokenResult = await supabase
    .schema(PRIVATE_SCHEMA)
    .from("planning_center_tokens")
    .upsert(
      {
        ministry_id: ministryId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? null,
        expires_at: tokens.expiresAt,
        scope: tokens.scope ?? null,
        updated_at: now
      },
      { onConflict: "ministry_id" }
    );
  if (tokenResult.error) throw new Error(tokenResult.error.message);

  await upsertIntegrationMetadata(supabase, ministryId, {
    status: "connected",
    connected_at: now,
    last_error: null,
    config: { source: "oauth", readOnly: true }
  });
}

export async function disconnectPlanningCenter(session: AuthSession): Promise<void> {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();

  const tokenResult = await supabase.schema(PRIVATE_SCHEMA).from("planning_center_tokens").delete().eq("ministry_id", ministryId);
  if (tokenResult.error) throw new Error(tokenResult.error.message);

  await upsertIntegrationMetadata(supabase, ministryId, {
    status: "disconnected",
    connected_at: null,
    last_error: null,
    config: { source: "oauth", readOnly: true }
  });
}

async function upsertIntegrationMetadata(
  supabase: SupabaseClient,
  ministryId: string,
  patch: Partial<MinistryIntegrationRow> & { status: PlanningCenterConnectionStatus }
) {
  const result = await supabase
    .from("ministry_integrations")
    .upsert(
      {
        ministry_id: ministryId,
        provider: PROVIDER,
        ...patch
      },
      { onConflict: "ministry_id,provider" }
    );
  if (result.error) throw new Error(result.error.message);
}

async function loadTokenRow(supabase: SupabaseClient, ministryId: string): Promise<PlanningCenterTokenRow | null> {
  const { data, error } = await supabase
    .schema(PRIVATE_SCHEMA)
    .from("planning_center_tokens")
    .select("ministry_id,access_token,refresh_token,expires_at,scope")
    .eq("ministry_id", ministryId)
    .maybeSingle<PlanningCenterTokenRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getValidPlanningCenterAccessToken(session: AuthSession): Promise<string> {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await loadTokenRow(supabase, ministryId);
  if (!token) throw new PlanningCenterNotConnectedError();
  if (!token.access_token || !token.expires_at) throw new PlanningCenterConnectionInvalidError();

  if (!isPlanningCenterTokenExpired(token.expires_at)) return token.access_token;
  if (!token.refresh_token) throw new PlanningCenterConnectionExpiredError();

  const refreshed = await refreshPlanningCenterAccessToken({ refreshToken: token.refresh_token });
  const result = await supabase
    .schema(PRIVATE_SCHEMA)
    .from("planning_center_tokens")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken ?? token.refresh_token,
      expires_at: refreshed.expiresAt,
      scope: refreshed.scope ?? token.scope,
      updated_at: new Date().toISOString()
    })
    .eq("ministry_id", ministryId);
  if (result.error) throw new Error(result.error.message);
  return refreshed.accessToken;
}

export async function syncPlanningCenterReferences(session: AuthSession): Promise<PlanningCenterSyncResult> {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const startedAt = new Date().toISOString();

  try {
    const accessToken = await getValidPlanningCenterAccessToken(session);
    const [people, attendance] = await Promise.all([
      listPlanningCenterPeople({ accessToken, maxPages: 3 }),
      listPlanningCenterAttendance({ accessToken, maxPages: 3 })
    ]);

    await upsertPeopleRefs(supabase, ministryId, people);
    await upsertAttendanceRefs(supabase, ministryId, attendance);

    const completedAt = new Date().toISOString();
    await insertSyncRun(supabase, {
      ministryId,
      status: "succeeded",
      peopleCount: people.length,
      attendanceCount: attendance.length,
      startedAt,
      completedAt
    });
    await upsertIntegrationMetadata(supabase, ministryId, {
      status: "connected",
      last_sync_at: completedAt,
      last_error: null,
      config: { source: "oauth", readOnly: true }
    });

    return { status: "succeeded", peopleCount: people.length, attendanceCount: attendance.length, syncedAt: completedAt };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = redactProviderError(error);
    await insertSyncRun(supabase, {
      ministryId,
      status: "failed",
      peopleCount: 0,
      attendanceCount: 0,
      error: message,
      startedAt,
      completedAt
    }).catch(() => undefined);
    await upsertIntegrationMetadata(supabase, ministryId, {
      status: "error",
      last_error: message,
      config: { source: "oauth", readOnly: true }
    }).catch(() => undefined);
    throw error;
  }
}

async function upsertPeopleRefs(supabase: SupabaseClient, ministryId: string, people: PlanningCenterPersonRef[]) {
  if (people.length === 0) return;
  const syncedAt = new Date().toISOString();
  const result = await supabase.from("planning_center_people_refs").upsert(
    people.map((person) => ({
      ministry_id: ministryId,
      external_person_id: person.externalPersonId,
      display_name: person.displayName,
      household_external_id: person.householdExternalId ?? null,
      grade: person.grade ?? null,
      age_band: person.ageBand ?? null,
      source_updated_at: person.sourceUpdatedAt ?? null,
      last_synced_at: syncedAt
    })),
    { onConflict: "ministry_id,external_person_id" }
  );
  if (result.error) throw new Error(result.error.message);
}

async function upsertAttendanceRefs(supabase: SupabaseClient, ministryId: string, attendance: PlanningCenterAttendanceRef[]) {
  if (attendance.length === 0) return;
  const syncedAt = new Date().toISOString();
  const result = await supabase.from("planning_center_attendance_refs").upsert(
    attendance.map((item) => ({
      ministry_id: ministryId,
      external_check_in_id: item.externalCheckInId,
      external_person_id: item.externalPersonId ?? null,
      external_event_id: item.externalEventId ?? null,
      session_label: item.sessionLabel ?? null,
      location_label: item.locationLabel ?? null,
      checked_in_at: item.checkedInAt ?? null,
      last_synced_at: syncedAt
    })),
    { onConflict: "ministry_id,external_check_in_id" }
  );
  if (result.error) throw new Error(result.error.message);
}

async function insertSyncRun(
  supabase: SupabaseClient,
  input: {
    ministryId: string;
    status: "succeeded" | "failed";
    peopleCount: number;
    attendanceCount: number;
    error?: string;
    startedAt: string;
    completedAt: string;
  }
) {
  const result = await supabase.from("planning_center_sync_runs").insert({
    ministry_id: input.ministryId,
    status: input.status,
    people_count: input.peopleCount,
    attendance_count: input.attendanceCount,
    error: input.error ?? null,
    started_at: input.startedAt,
    completed_at: input.completedAt
  });
  if (result.error) throw new Error(result.error.message);
}

export function redactProviderError(error: unknown): string {
  if (
    error instanceof PlanningCenterNotConnectedError ||
    error instanceof PlanningCenterConnectionInvalidError ||
    error instanceof PlanningCenterConnectionExpiredError ||
    error instanceof PlanningCenterStorageUnavailableError
  ) {
    return error.message;
  }
  if (error instanceof Error && /Planning Center API request failed: \d{3}/.test(error.message)) {
    return error.message;
  }
  if (error instanceof Error && /Planning Center token/.test(error.message)) {
    return error.message;
  }
  return "Planning Center sync failed. Reconnect from Settings or try again later.";
}
