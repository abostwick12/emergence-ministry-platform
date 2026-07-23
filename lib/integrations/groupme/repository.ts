import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAdminClient, isSupabaseAdminConfigured, type AuthSession } from "@/lib/auth/server";
import {
  GroupMeApiError,
  GroupMeConfigError,
  listGroupMeGroups,
  listGroupMeMessages,
  readGroupMeConfig,
  sendGroupMeMessage,
  type GroupMeGroup,
  type GroupMeMessage
} from "@/lib/integrations/groupme/client";
import { resolveMinistryScope } from "@/lib/ministry/scope";

const PROVIDER = "groupme";
const PRIVATE_SCHEMA = "lead_emergence_private";

export type GroupMeDisplayStatus = "not_configured" | "storage_unavailable" | "disconnected" | "connected" | "error";

export type GroupMeStatus = {
  configured: boolean;
  storageConfigured: boolean;
  displayStatus: GroupMeDisplayStatus;
  connectedAt?: string;
  connectedGroupCount: number;
  message: string;
};

type GroupMeTokenRow = {
  ministry_id: string;
  access_token_ciphertext: string;
  connected_at: string;
};

type PlatformGroupRow = {
  id: string;
  name: string;
  group_me_group_id: string | null;
  group_me_group_name: string | null;
};

export class GroupMeStorageUnavailableError extends Error {
  constructor() {
    super("GroupMe storage is not configured. Apply the Volunteer Hub GroupMe migration and configure Supabase server access.");
    this.name = "GroupMeStorageUnavailableError";
  }
}

export class GroupMeNotConnectedError extends Error {
  constructor() {
    super("Connect GroupMe before loading or sending messages.");
    this.name = "GroupMeNotConnectedError";
  }
}

export class GroupMeGroupNotLinkedError extends Error {
  constructor() {
    super("Choose a GroupMe conversation for this small group before sending messages.");
    this.name = "GroupMeGroupNotLinkedError";
  }
}

function storageConfigured() {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

function adminClient(): SupabaseClient {
  if (!storageConfigured()) throw new GroupMeStorageUnavailableError();
  return getSupabaseAdminClient();
}

async function ministryIdFor(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) throw new GroupMeStorageUnavailableError();
  return ministryId;
}

export function encryptGroupMeToken(token: string, encryptionKey: string) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptGroupMeToken(value: string, encryptionKey: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored GroupMe authorization is invalid.");
  const key = createHash("sha256").update(encryptionKey, "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

export async function getGroupMeStatus(session: AuthSession): Promise<GroupMeStatus> {
  const config = readGroupMeConfig();
  const hasStorage = storageConfigured();
  if (!config.configured) {
    return {
      configured: false,
      storageConfigured: hasStorage,
      displayStatus: "not_configured",
      connectedGroupCount: 0,
      message: "GroupMe OAuth is not configured for this environment."
    };
  }
  if (!hasStorage || session.isMock) {
    return {
      configured: true,
      storageConfigured: hasStorage,
      displayStatus: session.isMock ? "disconnected" : "storage_unavailable",
      connectedGroupCount: 0,
      message: session.isMock ? "Demo messages stay inside this workspace." : "Apply the GroupMe migration before connecting a conversation."
    };
  }

  try {
    const ministryId = await ministryIdFor(session);
    const supabase = adminClient();
    const [token, groups] = await Promise.all([
      supabase
        .schema(PRIVATE_SCHEMA)
        .from("groupme_tokens")
        .select("ministry_id,access_token_ciphertext,connected_at")
        .eq("ministry_id", ministryId)
        .maybeSingle<GroupMeTokenRow>(),
      supabase
        .from("volunteer_hub_small_groups")
        .select("id", { count: "exact", head: true })
        .eq("ministry_id", ministryId)
        .eq("group_me_connected", true)
    ]);
    if (token.error || groups.error) throw new Error(token.error?.message ?? groups.error?.message);
    if (!token.data) {
      return {
        configured: true,
        storageConfigured: true,
        displayStatus: "disconnected",
        connectedGroupCount: groups.count ?? 0,
        message: "Connect the ministry GroupMe account, then link each small group to its conversation."
      };
    }
    return {
      configured: true,
      storageConfigured: true,
      displayStatus: "connected",
      connectedAt: token.data.connected_at,
      connectedGroupCount: groups.count ?? 0,
      message: `${groups.count ?? 0} small group conversation${groups.count === 1 ? " is" : "s are"} linked.`
    };
  } catch {
    return {
      configured: true,
      storageConfigured: true,
      displayStatus: "error",
      connectedGroupCount: 0,
      message: "GroupMe status is temporarily unavailable."
    };
  }
}

export async function connectGroupMe(session: AuthSession, accessToken: string, source: "oauth" | "manual_token" = "oauth") {
  const token = accessToken.trim();
  if (!token) throw new GroupMeNotConnectedError();
  const config = readGroupMeConfig();
  if (!config.configured || !config.encryptionKey) throw new GroupMeConfigError(config.missing);
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const availableGroups = await listGroupMeGroups({ accessToken: token });
  const now = new Date().toISOString();
  const encrypted = encryptGroupMeToken(token, config.encryptionKey);
  const result = await supabase.schema(PRIVATE_SCHEMA).from("groupme_tokens").upsert({
    ministry_id: ministryId,
    access_token_ciphertext: encrypted,
    connected_at: now,
    updated_at: now
  }, { onConflict: "ministry_id" });
  if (result.error) throw new Error(result.error.message);
  await upsertIntegrationMetadata(supabase, ministryId, "connected", now, source);
  return { groupCount: availableGroups.length };
}

export async function disconnectGroupMe(session: AuthSession) {
  const ministryId = await ministryIdFor(session);
  const supabase = adminClient();
  const token = await supabase.schema(PRIVATE_SCHEMA).from("groupme_tokens").delete().eq("ministry_id", ministryId);
  if (token.error) throw new Error(token.error.message);
  await supabase
    .from("volunteer_hub_small_groups")
    .update({ group_me_connected: false, group_me_group_id: null, group_me_group_name: null })
    .eq("ministry_id", ministryId);
  await upsertIntegrationMetadata(supabase, ministryId, "disconnected", null, "oauth");
}

export async function listAvailableGroupMeGroups(session: AuthSession): Promise<GroupMeGroup[]> {
  return listGroupMeGroups({ accessToken: await getAccessToken(session) });
}

export async function linkVolunteerGroupToGroupMe(session: AuthSession, platformGroupId: string, groupMeGroupId: string) {
  const ministryId = await ministryIdFor(session);
  const group = (await listAvailableGroupMeGroups(session)).find((candidate) => candidate.id === groupMeGroupId);
  if (!group) throw new Error("The selected GroupMe conversation is not available to the connected account.");
  const result = await adminClient()
    .from("volunteer_hub_small_groups")
    .update({ group_me_connected: true, group_me_group_id: group.id, group_me_group_name: group.name })
    .eq("ministry_id", ministryId)
    .eq("id", platformGroupId);
  if (result.error) throw new Error(result.error.message);
  await insertAudit(session, ministryId, "Linked GroupMe conversation", group.name);
  return group;
}

export async function getVolunteerGroupMeMessages(session: AuthSession, platformGroupId: string): Promise<GroupMeMessage[]> {
  const group = await loadPlatformGroup(session, platformGroupId);
  if (!group.group_me_group_id) throw new GroupMeGroupNotLinkedError();
  return listGroupMeMessages({ accessToken: await getAccessToken(session), groupId: group.group_me_group_id, limit: 60 });
}

export async function sendVolunteerGroupMeMessage(session: AuthSession, input: {
  platformGroupId: string;
  body: string;
  resourceId?: string;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Message body is required.");
  const ministryId = await ministryIdFor(session);
  const group = await loadPlatformGroup(session, input.platformGroupId);
  if (!group.group_me_group_id) throw new GroupMeGroupNotLinkedError();
  const sourceGuid = randomUUID();
  const sent = await sendGroupMeMessage({
    accessToken: await getAccessToken(session),
    groupId: group.group_me_group_id,
    text: body,
    sourceGuid
  });
  const senderName = session.user.fullName || session.user.email;
  const stored = await adminClient().from("volunteer_hub_chat_previews").insert({
    ministry_id: ministryId,
    group_id: input.platformGroupId,
    sender_user_id: session.user.id,
    sender_name: senderName,
    body,
    resource_id: input.resourceId ?? null,
    preview_only: false,
    external_message_id: sent.id,
    source_guid: sent.sourceGuid
  });
  if (stored.error) throw new Error(stored.error.message);
  await insertAudit(session, ministryId, "Sent GroupMe message", group.name);
  return sent;
}

async function getAccessToken(session: AuthSession) {
  const config = readGroupMeConfig();
  if (!config.configured || !config.encryptionKey) throw new GroupMeConfigError(config.missing);
  const ministryId = await ministryIdFor(session);
  const result = await adminClient()
    .schema(PRIVATE_SCHEMA)
    .from("groupme_tokens")
    .select("ministry_id,access_token_ciphertext,connected_at")
    .eq("ministry_id", ministryId)
    .maybeSingle<GroupMeTokenRow>();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new GroupMeNotConnectedError();
  return decryptGroupMeToken(result.data.access_token_ciphertext, config.encryptionKey);
}

async function loadPlatformGroup(session: AuthSession, platformGroupId: string) {
  const ministryId = await ministryIdFor(session);
  const result = await adminClient()
    .from("volunteer_hub_small_groups")
    .select("id,name,group_me_group_id,group_me_group_name")
    .eq("ministry_id", ministryId)
    .eq("id", platformGroupId)
    .maybeSingle<PlatformGroupRow>();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Small group not found.");
  return result.data;
}

async function upsertIntegrationMetadata(
  supabase: SupabaseClient,
  ministryId: string,
  status: "connected" | "disconnected",
  connectedAt: string | null,
  source: "oauth" | "manual_token"
) {
  const result = await supabase.from("ministry_integrations").upsert({
    ministry_id: ministryId,
    provider: PROVIDER,
    status,
    connected_at: connectedAt,
    last_error: null,
    config: { source, sendMode: "manual_review" }
  }, { onConflict: "ministry_id,provider" });
  if (result.error) throw new Error(result.error.message);
}

async function insertAudit(session: AuthSession, ministryId: string, action: string, target: string) {
  const result = await adminClient().from("volunteer_hub_audit_entries").insert({
    ministry_id: ministryId,
    actor_user_id: session.user.id,
    actor_name: session.user.fullName || session.user.email,
    action,
    target
  });
  if (result.error) throw new Error(result.error.message);
}

export function redactGroupMeError(error: unknown) {
  if (
    error instanceof GroupMeApiError ||
    error instanceof GroupMeConfigError ||
    error instanceof GroupMeNotConnectedError ||
    error instanceof GroupMeGroupNotLinkedError ||
    error instanceof GroupMeStorageUnavailableError
  ) return error.message;
  if (error instanceof Error && /Message body|1,000 characters|Small group not found|selected GroupMe conversation/i.test(error.message)) return error.message;
  return "GroupMe action failed. Reconnect the account or try again.";
}
