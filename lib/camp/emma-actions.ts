import { randomUUID } from "crypto";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { restrictedNeedles } from "@/lib/camp/emma";
import { buildCampEmmaWelcomeGreeting } from "@/lib/camp/emma-greeting";
import {
  assertAllCampersOperationalWriteAccess,
  canEditAllCampers,
  canEditPartnerChurchCampers,
  normalizeScopeId,
  type CampAccessContext
} from "@/lib/camp/permissions";
import { assignCampStudent, getCampOverview, updateCampStaffMember } from "@/lib/camp/repository";
import * as mockStore from "@/lib/camp/store";
import type {
  CampEmmaActionAuditRecord,
  CampEmmaActionResponse,
  CampEmmaActionTargetType,
  CampEmmaActionType,
  CampEmmaEditableField,
  CampEmmaPendingAction,
  CampEmmaSafeTargetOption,
  CampOverviewPayload,
  CampStaffMember,
  CampStudentPublic,
  CampVisibleStudent
} from "@/lib/camp/types";

const PENDING_TTL_MS = 15 * 60 * 1000;
const DENIED_MESSAGE = "I can help you find that information, but your current access does not allow me to make that change.";
const FAILURE_MESSAGE = "I couldn't complete that change. Please try again or update it manually from the roster.";
const ACTIVE_TEAM_FALLBACKS = ["Blue", "Red", "Yellow", "Green", "Orange", "Purple"];

export type CampEmmaActionRequest = {
  campId?: string;
  originalCommandText?: string;
  actionType?: CampEmmaActionType;
  targetType?: CampEmmaActionTargetType;
  targetId?: string;
  proposedChange?: { fieldName?: CampEmmaEditableField; newValue?: string };
  pendingActionId?: string;
  confirmed?: boolean;
};

type ParsedWriteAction = {
  actionType: Exclude<CampEmmaActionType, "LIST_UNASSIGNED_CAMPERS" | "LIST_UNASSIGNED_LEADERS">;
  targetType: CampEmmaActionTargetType;
  targetNameQuery: string;
  fieldName: CampEmmaEditableField;
  newValue: string;
};

type ParsedListAction = {
  actionType: "LIST_UNASSIGNED_CAMPERS" | "LIST_UNASSIGNED_LEADERS";
};

type ParsedAction = ParsedWriteAction | ParsedListAction | { actionType: "UNSUPPORTED"; reason: "restricted" | "unknown" };

export { buildCampEmmaWelcomeGreeting };

export async function handleCampEmmaAction(
  session: AuthSession,
  context: CampAccessContext,
  request: CampEmmaActionRequest
): Promise<CampEmmaActionResponse> {
  if (request.pendingActionId && request.confirmed === true) {
    return confirmPendingAction(session, context, request.pendingActionId);
  }
  if (request.pendingActionId && request.confirmed === false) {
    return cancelPendingAction(session, request.pendingActionId);
  }

  const overview = await getCampOverview(session, context);
  const campId = request.campId?.trim() || await resolveCampId(session);
  const originalCommandText = (request.originalCommandText ?? "").trim().slice(0, 500);
  const parsed = request.actionType && request.targetId && request.proposedChange?.fieldName
    ? parsedFromExplicitRequest(request)
    : parseEmmaCampCommand(originalCommandText);

  if (parsed.actionType === "UNSUPPORTED") {
    const message = parsed.reason === "restricted"
      ? "EMMA can't make medical, medication, insurance, contact, guardian, or sensitive-care changes."
      : "I couldn't understand that as a safe Camp action. Please rephrase or update it manually.";
    await auditEmmaAction(session, campId, {
      actorName: session.user.fullName,
      originalCommandText,
      confirmationRequired: false,
      status: "failed",
      errorMessage: message
    });
    return { status: "failed", message };
  }

  if (parsed.actionType === "LIST_UNASSIGNED_CAMPERS") {
    return {
      status: "completed",
      message: "Here are the campers who still need a team.",
      items: overview.students
        .filter((student) => !student.teamId)
        .map((student) => safeStudentOption(student))
    };
  }

  if (parsed.actionType === "LIST_UNASSIGNED_LEADERS") {
    return {
      status: "completed",
      message: "Here are the leaders who still need a team.",
      items: overview.staff
        .filter((staff) => !staff.teamId)
        .map((staff) => safeStaffOption(staff))
    };
  }

  const writeAction = parsed as ParsedWriteAction;
  const validation = validateProposedValue(writeAction, overview);
  if (!validation.allowed) {
    await auditEmmaAction(session, campId, {
      actorName: session.user.fullName,
      actionType: writeAction.actionType,
      targetType: writeAction.targetType,
      fieldName: writeAction.fieldName,
      newValue: writeAction.newValue,
      originalCommandText,
      confirmationRequired: false,
      status: "failed",
      errorMessage: validation.message
    });
    return { status: "failed", message: validation.message };
  }

  const scopedTargets = scopedTargetOptions(writeAction.targetType, overview, context);
  const matches = matchTargetsByName(scopedTargets, writeAction.targetNameQuery);
  if (matches.length === 0) {
    await auditEmmaAction(session, campId, {
      actorName: session.user.fullName,
      actionType: writeAction.actionType,
      targetType: writeAction.targetType,
      fieldName: writeAction.fieldName,
      newValue: validation.newValue,
      originalCommandText,
      confirmationRequired: false,
      status: "failed",
      errorMessage: "Target not found."
    });
    return { status: "failed", message: `I couldn't find ${writeAction.targetNameQuery} in the Camp records you can access.` };
  }

  if (matches.length > 1) {
    return {
      status: "clarification_required",
      message: `I found more than one ${writeAction.targetNameQuery}. Which one do you mean?`,
      options: matches,
      actionType: writeAction.actionType,
      targetType: writeAction.targetType,
      proposedChange: { fieldName: writeAction.fieldName, newValue: validation.newValue },
      originalCommandText
    };
  }

  const target = matches[0];
  const permission = validateEmmaActionPermission(context, target, writeAction);
  if (!permission.allowed) {
    await auditEmmaAction(session, campId, {
      actorName: session.user.fullName,
      actionType: writeAction.actionType,
      targetType: writeAction.targetType,
      targetId: target.targetId,
      targetName: target.targetName,
      fieldName: writeAction.fieldName,
      oldValue: currentFieldValue(target, writeAction.fieldName),
      newValue: validation.newValue,
      originalCommandText,
      confirmationRequired: false,
      status: "denied",
      errorMessage: permission.message
    });
    return { status: "denied", message: DENIED_MESSAGE };
  }

  const oldValue = currentFieldValue(target, writeAction.fieldName);
  const pending = await createPendingEmmaAction(session, {
    id: randomUUID(),
    campId,
    actorUserId: session.user.id,
    targetType: writeAction.targetType,
    targetId: target.targetId,
    targetName: target.targetName,
    actionType: writeAction.actionType,
    fieldName: writeAction.fieldName,
    oldValue,
    newValue: validation.newValue,
    originalCommandText,
    expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
    status: "pending"
  });

  await auditEmmaAction(session, campId, {
    actorName: session.user.fullName,
    targetType: pending.targetType,
    targetId: pending.targetId,
    targetName: pending.targetName,
    actionType: pending.actionType,
    fieldName: pending.fieldName,
    oldValue: pending.oldValue,
    newValue: pending.newValue,
    originalCommandText: pending.originalCommandText,
    confirmationRequired: true,
    pendingActionId: pending.id,
    status: "proposed"
  });

  return {
    status: "confirmation_required",
    pendingActionId: pending.id,
    message: `I found ${pending.targetName}.`,
    summary: {
      targetName: pending.targetName,
      targetType: pending.targetType,
      field: pending.fieldName,
      oldValue: pending.oldValue,
      newValue: pending.newValue
    }
  };
}

export function parseEmmaCampCommand(commandText: string): ParsedAction {
  const text = commandText.trim().slice(0, 500);
  const normalized = text.toLowerCase();
  if (!text) return { actionType: "UNSUPPORTED", reason: "unknown" };
  if (restrictedNeedles.some((needle) => normalized.includes(needle))) {
    return { actionType: "UNSUPPORTED", reason: "restricted" };
  }

  if (/\b(unassigned campers|campers.*(need|needs|without|not assigned).*team|who still needs a team|who is unassigned)\b/i.test(text)) {
    return { actionType: "LIST_UNASSIGNED_CAMPERS" };
  }
  if (/\b(unassigned leaders|leaders.*(need|needs|without|not assigned).*team|which leaders are not assigned)\b/i.test(text)) {
    return { actionType: "LIST_UNASSIGNED_LEADERS" };
  }

  const room = parseRoomCommand(text);
  if (room) return room;

  const leaderTeam = parseTeamCommand(text, "leader");
  if (leaderTeam) return leaderTeam;

  const camperTeam = parseTeamCommand(text, "camper");
  if (camperTeam) return camperTeam;

  return { actionType: "UNSUPPORTED", reason: "unknown" };
}

async function confirmPendingAction(
  session: AuthSession,
  context: CampAccessContext,
  pendingActionId: string
): Promise<CampEmmaActionResponse> {
  const pending = await getPendingEmmaAction(session, pendingActionId);
  if (!pending || pending.actorUserId !== session.user.id) {
    return { status: "failed", message: "I couldn't complete that change. Please try again or update it manually from the roster." };
  }

  if (pending.status !== "pending" || Date.parse(pending.expiresAt) <= Date.now()) {
    await markPendingEmmaAction(session, pending.id, { status: "expired" });
    await auditEmmaAction(session, pending.campId, {
      actorName: session.user.fullName,
      ...auditFieldsFromPending(pending),
      confirmationRequired: true,
      pendingActionId: pending.id,
      status: "failed",
      errorMessage: "Pending action expired."
    });
    return { status: "failed", message: "That proposed change expired. Please ask EMMA to prepare it again." };
  }

  const overview = await getCampOverview(session, context);
  const target = findTargetById(pending, overview);
  if (!target) return failPending(session, pending, "Target no longer exists.");

  const permission = validateEmmaActionPermission(context, target, pending);
  if (!permission.allowed) {
    await auditEmmaAction(session, pending.campId, {
      actorName: session.user.fullName,
      ...auditFieldsFromPending(pending),
      confirmationRequired: true,
      pendingActionId: pending.id,
      status: "denied",
      errorMessage: permission.message
    });
    return { status: "denied", message: DENIED_MESSAGE };
  }

  if (currentFieldValue(target, pending.fieldName) !== pending.oldValue) {
    return failPending(session, pending, "Target changed before confirmation.");
  }

  try {
    const write = await writePendingChange(session, context, pending, overview);
    if (!write.allowed) {
      await auditEmmaAction(session, pending.campId, {
        actorName: session.user.fullName,
        ...auditFieldsFromPending(pending),
        confirmationRequired: true,
        pendingActionId: pending.id,
        status: write.status === 403 ? "denied" : "failed",
        errorMessage: write.error
      });
      return write.status === 403 ? { status: "denied", message: DENIED_MESSAGE } : { status: "failed", message: FAILURE_MESSAGE };
    }

    const confirmedAt = new Date().toISOString();
    await markPendingEmmaAction(session, pending.id, { status: "completed", confirmedAt });
    await auditEmmaAction(session, pending.campId, {
      actorName: session.user.fullName,
      ...auditFieldsFromPending(pending),
      confirmationRequired: true,
      pendingActionId: pending.id,
      confirmedAt,
      status: "completed"
    }, true);

    return { status: "completed", message: successMessage(pending) };
  } catch (error) {
    console.error("[camp-emma-actions] failed to confirm pending action", error);
    await auditEmmaAction(session, pending.campId, {
      actorName: session.user.fullName,
      ...auditFieldsFromPending(pending),
      confirmationRequired: true,
      pendingActionId: pending.id,
      status: "failed",
      errorMessage: "Database write failed."
    });
    return { status: "failed", message: FAILURE_MESSAGE };
  }
}

async function cancelPendingAction(session: AuthSession, pendingActionId: string): Promise<CampEmmaActionResponse> {
  const pending = await getPendingEmmaAction(session, pendingActionId);
  if (!pending || pending.actorUserId !== session.user.id || pending.status !== "pending") {
    return { status: "cancelled", message: "No problem - I cancelled that change." };
  }
  const cancelledAt = new Date().toISOString();
  await markPendingEmmaAction(session, pending.id, { status: "cancelled", cancelledAt });
  await auditEmmaAction(session, pending.campId, {
    actorName: session.user.fullName,
    ...auditFieldsFromPending(pending),
    confirmationRequired: true,
    pendingActionId: pending.id,
    status: "cancelled"
  });
  return { status: "cancelled", message: "No problem - I cancelled that change." };
}

async function writePendingChange(
  session: AuthSession,
  context: CampAccessContext,
  pending: CampEmmaPendingAction,
  overview: CampOverviewPayload
): Promise<{ allowed: true } | { allowed: false; status: number; error: string }> {
  if (pending.actionType === "UPDATE_CAMPER_ROOM") {
    const result = await assignCampStudent(session, context, { studentId: pending.targetId, cabin: pending.newValue });
    return result.allowed ? { allowed: true } : result;
  }
  if (pending.actionType === "ASSIGN_CAMPER_TEAM") {
    const team = findTeam(overview, pending.newValue);
    if (!team) return { allowed: false, status: 400, error: "I couldn't find that team. Please choose one of the active camp teams." };
    const result = await assignCampStudent(session, context, { studentId: pending.targetId, teamId: team.id });
    return result.allowed ? { allowed: true } : result;
  }
  if (pending.actionType === "ASSIGN_LEADER_TEAM") {
    const staff = overview.staff.find((candidate) => candidate.id === pending.targetId);
    const team = findTeam(overview, pending.newValue);
    if (!staff || !team) return { allowed: false, status: 404, error: "Active Camp leader or team not found." };
    const result = await updateCampStaffMember(session, context, { ...staff, id: staff.id, teamId: team.id });
    return result.allowed ? { allowed: true } : result;
  }
  return { allowed: false, status: 400, error: "Unsupported EMMA action." };
}

function parsedFromExplicitRequest(request: CampEmmaActionRequest): ParsedAction {
  if (
    request.actionType !== "ASSIGN_CAMPER_TEAM"
    && request.actionType !== "ASSIGN_LEADER_TEAM"
    && request.actionType !== "UPDATE_CAMPER_ROOM"
  ) {
    return { actionType: "UNSUPPORTED", reason: "unknown" };
  }
  const targetType = request.targetType ?? (request.actionType === "ASSIGN_LEADER_TEAM" ? "leader" : "camper");
  return {
    actionType: request.actionType,
    targetType,
    targetNameQuery: request.targetId ?? "",
    fieldName: request.proposedChange?.fieldName ?? (request.actionType === "UPDATE_CAMPER_ROOM" ? "room" : "team"),
    newValue: request.proposedChange?.newValue ?? ""
  };
}

function parseRoomCommand(text: string): ParsedWriteAction | null {
  const patterns = [
    /^(?:change|update|move)\s+(.+?)'?\s*s?\s+room\s+to\s+(.+)$/i,
    /^(?:change|update|move)\s+(.+?)\s+to\s+(?:room|cabin)\s+(.+)$/i,
    /^(?:change|update)\s+(.+?)'?\s*s?\s+cabin\s+to\s+(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return {
      actionType: "UPDATE_CAMPER_ROOM",
      targetType: "camper",
      targetNameQuery: cleanName(match[1]),
      fieldName: "room",
      newValue: cleanupValue(match[2])
    };
  }
  return null;
}

function parseTeamCommand(text: string, mode: CampEmmaActionTargetType): ParsedWriteAction | null {
  const leaderPrefix = mode === "leader" ? "(?:leader\\s+)?(.+?)(?:\\s+as\\s+a\\s+leader)?" : "(.+?)";
  const patterns = [
    new RegExp(`^(?:move|put|add|assign)\\s+${leaderPrefix}\\s+(?:to|on)\\s+(?:team\\s+)?(.+?)(?:\\s+team)?$`, "i")
  ];
  const containsLeader = /\bleader\b/i.test(text);
  if (mode === "leader" && !containsLeader) return null;
  if (mode === "camper" && containsLeader) return null;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return {
      actionType: mode === "leader" ? "ASSIGN_LEADER_TEAM" : "ASSIGN_CAMPER_TEAM",
      targetType: mode,
      targetNameQuery: cleanName(match[1]),
      fieldName: "team",
      newValue: cleanupValue(match[2])
    };
  }
  return null;
}

function validateProposedValue(parsed: ParsedWriteAction, overview: CampOverviewPayload): { allowed: true; newValue: string } | { allowed: false; message: string } {
  if (parsed.fieldName === "team") {
    const team = findTeam(overview, parsed.newValue);
    if (!team) return { allowed: false, message: "I couldn't find that team. Please choose one of the active camp teams." };
    return { allowed: true, newValue: team.name || team.color };
  }

  const room = parsed.newValue.trim();
  if (!room) return { allowed: false, message: "A room or cabin value is required." };
  if (room.length > 50) return { allowed: false, message: "Room value is too long." };
  if (/<\/?[a-z][\s\S]*>|javascript:|script\b/i.test(room)) {
    return { allowed: false, message: "That room value is not allowed." };
  }
  return { allowed: true, newValue: room };
}

function validateEmmaActionPermission(
  context: CampAccessContext,
  target: CampEmmaSafeTargetOption,
  action: Pick<ParsedWriteAction | CampEmmaPendingAction, "actionType" | "targetType">
): { allowed: true } | { allowed: false; message: string } {
  if (action.actionType === "ASSIGN_LEADER_TEAM") {
    const access = assertAllCampersOperationalWriteAccess(context, "Camp leader team assignment");
    return access.allowed ? { allowed: true } : { allowed: false, message: access.error };
  }

  if (canEditAllCampers(context)) return { allowed: true };
  if (!canEditPartnerChurchCampers(context)) return { allowed: false, message: "Camp roster editing requires assigned edit rights." };

  const scopedChurch = normalizeScopeId(context.partnerChurchId);
  const targetChurch = normalizeScopeId((target as CampEmmaSafeTargetOption & { sourceChurch?: string }).sourceChurch);
  const rosterType = (target as CampEmmaSafeTargetOption & { rosterType?: string }).rosterType;
  if (scopedChurch && targetChurch === scopedChurch && rosterType === "partner") return { allowed: true };
  return { allowed: false, message: "Partner Church Only edit rights are limited to campers from the assigned partner church." };
}

function scopedTargetOptions(targetType: CampEmmaActionTargetType, overview: CampOverviewPayload, context: CampAccessContext): CampEmmaSafeTargetOption[] {
  if (targetType === "leader") return overview.staff.map((staff) => safeStaffOption(staff));

  const students = canEditPartnerChurchCampers(context) && !canEditAllCampers(context)
    ? overview.students.filter((student) => normalizeScopeId(student.sourceChurch) === normalizeScopeId(context.partnerChurchId) && student.rosterType === "partner")
    : overview.students;

  return students.map((student) => ({
    ...safeStudentOption(student),
    sourceChurch: student.sourceChurch,
    rosterType: student.rosterType
  }));
}

function matchTargetsByName(targets: CampEmmaSafeTargetOption[], query: string): CampEmmaSafeTargetOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const byId = targets.find((target) => target.targetId === query);
  if (byId) return [byId];
  const exact = targets.filter((target) => target.targetName.trim().toLowerCase() === normalizedQuery);
  if (exact.length) return exact;
  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
  return targets.filter((target) => {
    const name = target.targetName.trim().toLowerCase();
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (queryParts.length === 1) return nameParts.some((part) => part === normalizedQuery);
    return queryParts.every((part) => nameParts.some((namePart) => namePart === part || namePart.startsWith(part)));
  });
}

function findTargetById(pending: CampEmmaPendingAction, overview: CampOverviewPayload): CampEmmaSafeTargetOption | undefined {
  if (pending.targetType === "leader") {
    const staff = overview.staff.find((item) => item.id === pending.targetId);
    return staff ? safeStaffOption(staff) : undefined;
  }
  const student = overview.students.find((item) => item.id === pending.targetId);
  return student ? safeStudentOption(student) : undefined;
}

function currentFieldValue(target: CampEmmaSafeTargetOption, fieldName: CampEmmaEditableField): string {
  return fieldName === "team" ? target.currentTeam ?? "Unassigned" : target.currentRoom ?? "";
}

function safeStudentOption(student: CampVisibleStudent | CampStudentPublic): CampEmmaSafeTargetOption {
  return {
    targetId: student.id,
    targetName: student.name,
    targetType: "camper",
    grade: "grade" in student ? student.grade : undefined,
    currentTeam: "teamName" in student ? student.teamName || "Unassigned" : student.teamId || "Unassigned",
    currentRoom: "cabin" in student ? student.cabin || "" : ""
  };
}

function safeStaffOption(staff: CampStaffMember): CampEmmaSafeTargetOption {
  return {
    targetId: staff.id,
    targetName: staff.name,
    targetType: "leader",
    currentTeam: staff.teamName || "Unassigned"
  };
}

function findTeam(overview: CampOverviewPayload, rawValue: string) {
  const normalized = normalizeTeamLookup(rawValue);
  return overview.teams.find((team) => normalizeTeamLookup(team.name) === normalized || normalizeTeamLookup(team.color) === normalized)
    ?? ACTIVE_TEAM_FALLBACKS.map((color) => ({ id: `team-${color.toLowerCase()}`, name: color, color, leader: "" })).find((team) => normalizeTeamLookup(team.name) === normalized);
}

function successMessage(pending: CampEmmaPendingAction): string {
  if (pending.actionType === "UPDATE_CAMPER_ROOM") return `Done - ${pending.targetName}'s room has been updated to ${pending.newValue}.`;
  if (pending.actionType === "ASSIGN_LEADER_TEAM") return `Done - ${pending.targetName} has been moved to ${pending.newValue} Team.`;
  return `Done - ${pending.targetName} has been moved to ${pending.newValue} Team.`;
}

function auditFieldsFromPending(pending: CampEmmaPendingAction) {
  return {
    targetType: pending.targetType,
    targetId: pending.targetId,
    targetName: pending.targetName,
    actionType: pending.actionType,
    fieldName: pending.fieldName,
    oldValue: pending.oldValue,
    newValue: pending.newValue,
    originalCommandText: pending.originalCommandText
  };
}

async function failPending(session: AuthSession, pending: CampEmmaPendingAction, errorMessage: string): Promise<CampEmmaActionResponse> {
  await auditEmmaAction(session, pending.campId, {
    actorName: session.user.fullName,
    ...auditFieldsFromPending(pending),
    confirmationRequired: true,
    pendingActionId: pending.id,
    status: "failed",
    errorMessage
  });
  return { status: "failed", message: FAILURE_MESSAGE };
}

async function createPendingEmmaAction(session: AuthSession, pending: CampEmmaPendingAction): Promise<CampEmmaPendingAction> {
  if (session.isMock || !isSupabaseConfigured()) return mockStore.createCampEmmaPendingAction(pending);
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_emma_pending_actions")
    .insert({
      id: pending.id,
      camp_id: pending.campId,
      actor_user_id: pending.actorUserId,
      target_type: pending.targetType,
      target_id: pending.targetId,
      target_name: pending.targetName,
      action_type: pending.actionType,
      field_name: pending.fieldName,
      old_value: pending.oldValue,
      new_value: pending.newValue,
      original_command_text: pending.originalCommandText,
      expires_at: pending.expiresAt,
      status: pending.status
    })
    .select("created_at")
    .single<{ created_at: string }>();
  if (error) throw error;
  return { ...pending, createdAt: data?.created_at ?? pending.createdAt };
}

async function getPendingEmmaAction(session: AuthSession, id: string): Promise<CampEmmaPendingAction | undefined> {
  if (session.isMock || !isSupabaseConfigured()) return mockStore.getCampEmmaPendingAction(id);
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_emma_pending_actions")
    .select("*")
    .eq("id", id)
    .maybeSingle<Record<string, string | null>>();
  if (error || !data) return undefined;
  return {
    id: data.id!,
    campId: data.camp_id!,
    actorUserId: data.actor_user_id!,
    targetType: data.target_type as CampEmmaActionTargetType,
    targetId: data.target_id!,
    targetName: data.target_name!,
    actionType: data.action_type as CampEmmaActionType,
    fieldName: data.field_name as CampEmmaEditableField,
    oldValue: data.old_value ?? "",
    newValue: data.new_value ?? "",
    originalCommandText: data.original_command_text ?? "",
    expiresAt: data.expires_at!,
    createdAt: data.created_at!,
    confirmedAt: data.confirmed_at ?? undefined,
    cancelledAt: data.cancelled_at ?? undefined,
    status: data.status as CampEmmaPendingAction["status"]
  };
}

async function markPendingEmmaAction(session: AuthSession, id: string, patch: Partial<CampEmmaPendingAction>) {
  if (session.isMock || !isSupabaseConfigured()) {
    mockStore.updateCampEmmaPendingAction(id, patch);
    return;
  }
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.from("camp_emma_pending_actions").update({
    status: patch.status,
    confirmed_at: patch.confirmedAt ?? null,
    cancelled_at: patch.cancelledAt ?? null
  }).eq("id", id);
  if (error) throw error;
}

async function auditEmmaAction(
  session: AuthSession,
  campId: string,
  input: Omit<CampEmmaActionAuditRecord, "id" | "campId" | "actorUserId" | "createdAt">,
  mustSucceed = false
) {
  const audit: CampEmmaActionAuditRecord = {
    id: randomUUID(),
    campId,
    actorUserId: session.user.id,
    createdAt: new Date().toISOString(),
    ...input
  };
  if (session.isMock || !isSupabaseConfigured()) {
    mockStore.recordCampEmmaActionAudit(audit);
    return audit;
  }
  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const { data, error } = await supabase
      .from("camp_emma_actions_audit")
      .insert({
        id: audit.id,
        camp_id: audit.campId,
        actor_user_id: audit.actorUserId,
        actor_name: audit.actorName,
        target_type: audit.targetType ?? null,
        target_id: audit.targetId ?? null,
        target_name: audit.targetName ?? null,
        action_type: audit.actionType ?? null,
        field_name: audit.fieldName ?? null,
        old_value: audit.oldValue ?? null,
        new_value: audit.newValue ?? null,
        original_command_text: audit.originalCommandText,
        confirmation_required: audit.confirmationRequired,
        pending_action_id: audit.pendingActionId ?? null,
        confirmed_at: audit.confirmedAt ?? null,
        status: audit.status,
        error_message: audit.errorMessage ?? null
      })
      .select("created_at")
      .single<{ created_at: string }>();
    return { ...audit, createdAt: data?.created_at ?? audit.createdAt };
  } catch (error) {
    console.error("[camp-emma-actions] audit write failed", error);
    if (mustSucceed) throw error;
    return audit;
  }
}

async function resolveCampId(session: AuthSession): Promise<string> {
  if (session.isMock || !isSupabaseConfigured()) return "mock-camp-oakwood";
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_sessions")
    .select("id")
    .eq("slug", "oakwood-2026")
    .maybeSingle<{ id: string }>();
  if (error || !data) throw error ?? new Error("Active Camp session not found.");
  return data.id;
}

function cleanName(value: string): string {
  return value.replace(/\b(team|room|cabin)\b/gi, "").trim().replace(/\s+/g, " ");
}

function cleanupValue(value: string): string {
  return value.trim().replace(/[.?!]+$/g, "").replace(/\s+/g, " ");
}

function normalizeTeamLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[.?!]+$/g, "").replace(/\s+team$/i, "").replace(/^team\s+/i, "");
}
