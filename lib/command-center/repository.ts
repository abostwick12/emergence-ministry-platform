// Personal Command Center data access.
//
// Follows the mock/real split used across the app (see
// lib/data/ministry-repository.ts and lib/camp/repository.ts):
// `shouldUseMock(session)` routes to the in-memory store for dev/mock
// sessions or when Supabase is not configured, otherwise reads/writes go to
// Supabase with RLS enforcing the Andrew-only policy from migration 023.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import * as mockStore from "@/lib/command-center/store";
import type {
  AiConversationMessage,
  BriefingItem,
  CaptureEntry,
  CommandCenterOverview,
  ConversationRole,
  JobApplication,
  JobApplicationStatus,
  PersonalDomain,
  PersonalIntegration,
  PersonalTask,
  PersonalTaskPriority,
  PersonalTaskStatus,
  SageMemory,
  SageMemoryType
} from "@/lib/command-center/types";

function shouldUseMock(session: AuthSession): boolean {
  return session.isMock || !isSupabaseConfigured();
}

// --- Row shapes -------------------------------------------------------

type TaskRow = {
  id: string;
  domain: PersonalDomain;
  title: string;
  description: string | null;
  status: PersonalTaskStatus;
  priority: PersonalTaskPriority;
  due_date: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function mapTaskRow(row: TaskRow): PersonalTask {
  return {
    id: row.id,
    domain: row.domain,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type IntegrationRow = {
  id: string;
  service: PersonalIntegration["service"];
  status: PersonalIntegration["status"];
  config: Record<string, unknown> | null;
  connected_at: string | null;
};

function mapIntegrationRow(row: IntegrationRow): PersonalIntegration {
  return {
    id: row.id,
    service: row.service,
    status: row.status,
    config: row.config ?? {},
    connectedAt: row.connected_at ?? undefined
  };
}

type JobApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  applied_date: string | null;
  contact_name: string | null;
  contact_notes: string | null;
  next_follow_up_date: string | null;
  compensation_notes: string | null;
  job_url: string | null;
  created_at: string;
  updated_at: string;
};

function mapJobApplicationRow(row: JobApplicationRow): JobApplication {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    appliedDate: row.applied_date ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactNotes: row.contact_notes ?? undefined,
    nextFollowUpDate: row.next_follow_up_date ?? undefined,
    compensationNotes: row.compensation_notes ?? undefined,
    jobUrl: row.job_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type CaptureRow = {
  id: string;
  raw_text: string;
  status: CaptureEntry["status"];
  routed_domain: PersonalDomain | null;
  routed_task_id: string | null;
  created_at: string;
};

function mapCaptureRow(row: CaptureRow): CaptureEntry {
  return {
    id: row.id,
    rawText: row.raw_text,
    status: row.status,
    routedDomain: row.routed_domain ?? undefined,
    routedTaskId: row.routed_task_id ?? undefined,
    createdAt: row.created_at
  };
}

type MemoryRow = {
  id: string;
  memory_type: SageMemoryType;
  content: string;
  domain: string | null;
  created_at: string;
  last_referenced_at: string | null;
};

function mapMemoryRow(row: MemoryRow): SageMemory {
  return {
    id: row.id,
    memoryType: row.memory_type,
    content: row.content,
    domain: row.domain ?? undefined,
    createdAt: row.created_at,
    lastReferencedAt: row.last_referenced_at ?? undefined
  };
}

type ConversationRow = {
  id: string;
  session_id: string;
  role: ConversationRole;
  content: string;
  created_at: string;
};

function mapConversationRow(row: ConversationRow): AiConversationMessage {
  return { id: row.id, sessionId: row.session_id, role: row.role, content: row.content, createdAt: row.created_at };
}

// --- Tasks -------------------------------------------------------------

export async function listPersonalTasks(
  session: AuthSession,
  filter?: { domain?: PersonalDomain; status?: PersonalTaskStatus }
): Promise<PersonalTask[]> {
  if (shouldUseMock(session)) return mockStore.listTasks(filter);

  const supabase = getSupabaseAuthClient(session.accessToken);
  let query = supabase.from("personal_tasks").select("*").order("created_at", { ascending: false });
  if (filter?.domain) query = query.eq("domain", filter.domain);
  if (filter?.status) query = query.eq("status", filter.status);
  const { data, error } = await query.returns<TaskRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTaskRow);
}

export async function createPersonalTask(
  session: AuthSession,
  input: Omit<PersonalTask, "id" | "createdAt" | "updatedAt">
): Promise<PersonalTask> {
  if (shouldUseMock(session)) return mockStore.createTask(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_tasks")
    .insert({
      domain: input.domain,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      due_date: input.dueDate ?? null,
      tags: input.tags
    })
    .select("*")
    .single<TaskRow>();
  if (error) throw new Error(error.message);
  return mapTaskRow(data);
}

export async function updatePersonalTask(
  session: AuthSession,
  id: string,
  input: Partial<PersonalTask>
): Promise<PersonalTask | null> {
  if (shouldUseMock(session)) return mockStore.updateTask(id, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const patch: Record<string, unknown> = {};
  if (input.domain !== undefined) patch.domain = input.domain;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.tags !== undefined) patch.tags = input.tags;

  const { data, error } = await supabase.from("personal_tasks").update(patch).eq("id", id).select("*").maybeSingle<TaskRow>();
  if (error) throw new Error(error.message);
  return data ? mapTaskRow(data) : null;
}

export async function deletePersonalTask(session: AuthSession, id: string): Promise<void> {
  if (shouldUseMock(session)) return mockStore.deleteTask(id);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.from("personal_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Briefing ------------------------------------------------------------

export async function getDailyBriefing(session: AuthSession): Promise<BriefingItem[]> {
  // Phase 1: static/mock content regardless of session, since the live
  // Firecrawl-backed feed is a Phase 2 addition (see docs/command-center plan).
  if (shouldUseMock(session)) return mockStore.getBriefing();
  return mockStore.getBriefing();
}

// --- Integrations ------------------------------------------------------------

export async function listIntegrations(session: AuthSession): Promise<PersonalIntegration[]> {
  if (shouldUseMock(session)) return mockStore.listIntegrations();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("personal_integrations").select("*").returns<IntegrationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIntegrationRow);
}

export async function updateIntegration(
  session: AuthSession,
  service: PersonalIntegration["service"],
  input: Partial<Pick<PersonalIntegration, "status" | "config" | "connectedAt">>
): Promise<PersonalIntegration | null> {
  if (shouldUseMock(session)) return mockStore.updateIntegration(service, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.config !== undefined) patch.config = input.config;
  if (input.connectedAt !== undefined) patch.connected_at = input.connectedAt;

  const { data, error } = await supabase
    .from("personal_integrations")
    .update(patch)
    .eq("service", service)
    .select("*")
    .maybeSingle<IntegrationRow>();
  if (error) throw new Error(error.message);
  return data ? mapIntegrationRow(data) : null;
}

// --- Conversations ------------------------------------------------------------

export async function saveConversationMessage(
  session: AuthSession,
  message: { sessionId: string; role: ConversationRole; content: string }
): Promise<AiConversationMessage> {
  if (shouldUseMock(session)) return mockStore.saveConversationMessage(message);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ session_id: message.sessionId, role: message.role, content: message.content })
    .select("*")
    .single<ConversationRow>();
  if (error) throw new Error(error.message);
  return mapConversationRow(data);
}

export async function getConversationHistory(session: AuthSession, sessionId: string): Promise<AiConversationMessage[]> {
  if (shouldUseMock(session)) return mockStore.getConversationHistory(sessionId);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<ConversationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapConversationRow);
}

// --- Memory ------------------------------------------------------------

export async function saveMemoryRecord(
  session: AuthSession,
  input: { memoryType: SageMemoryType; content: string; domain?: string }
): Promise<SageMemory> {
  if (shouldUseMock(session)) return mockStore.saveMemory(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("sage_memory")
    .insert({ memory_type: input.memoryType, content: input.content, domain: input.domain ?? null })
    .select("*")
    .single<MemoryRow>();
  if (error) throw new Error(error.message);
  return mapMemoryRow(data);
}

export async function listMemoryRecords(session: AuthSession): Promise<SageMemory[]> {
  if (shouldUseMock(session)) return mockStore.listMemories();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("sage_memory")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<MemoryRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMemoryRow);
}

// --- Quick Capture ------------------------------------------------------------

export async function createCaptureEntry(session: AuthSession, rawText: string): Promise<CaptureEntry> {
  if (shouldUseMock(session)) return mockStore.createCaptureEntry(rawText);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("capture_inbox")
    .insert({ raw_text: rawText })
    .select("*")
    .single<CaptureRow>();
  if (error) throw new Error(error.message);
  return mapCaptureRow(data);
}

export async function listUnprocessedCaptures(session: AuthSession): Promise<CaptureEntry[]> {
  if (shouldUseMock(session)) return mockStore.listUnprocessedCaptures();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("capture_inbox")
    .select("*")
    .eq("status", "unprocessed")
    .order("created_at", { ascending: false })
    .returns<CaptureRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCaptureRow);
}

export async function resolveCaptureEntry(
  session: AuthSession,
  id: string,
  input: { status: CaptureEntry["status"]; routedDomain?: PersonalDomain; routedTaskId?: string }
): Promise<CaptureEntry | null> {
  if (shouldUseMock(session))
    return mockStore.resolveCaptureEntry(id, { status: input.status, routedDomain: input.routedDomain, routedTaskId: input.routedTaskId });

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("capture_inbox")
    .update({ status: input.status, routed_domain: input.routedDomain ?? null, routed_task_id: input.routedTaskId ?? null })
    .eq("id", id)
    .select("*")
    .maybeSingle<CaptureRow>();
  if (error) throw new Error(error.message);
  return data ? mapCaptureRow(data) : null;
}

// --- Job Applications ------------------------------------------------------------

export async function listJobApplications(session: AuthSession): Promise<JobApplication[]> {
  if (shouldUseMock(session)) return mockStore.listJobApplications();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<JobApplicationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapJobApplicationRow);
}

export async function createJobApplication(
  session: AuthSession,
  input: Omit<JobApplication, "id" | "createdAt" | "updatedAt">
): Promise<JobApplication> {
  if (shouldUseMock(session)) return mockStore.createJobApplication(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      company: input.company,
      role: input.role,
      status: input.status,
      applied_date: input.appliedDate ?? null,
      contact_name: input.contactName ?? null,
      contact_notes: input.contactNotes ?? null,
      next_follow_up_date: input.nextFollowUpDate ?? null,
      compensation_notes: input.compensationNotes ?? null,
      job_url: input.jobUrl ?? null
    })
    .select("*")
    .single<JobApplicationRow>();
  if (error) throw new Error(error.message);
  return mapJobApplicationRow(data);
}

export async function updateJobApplication(
  session: AuthSession,
  id: string,
  input: Partial<JobApplication>
): Promise<JobApplication | null> {
  if (shouldUseMock(session)) return mockStore.updateJobApplication(id, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const patch: Record<string, unknown> = {};
  if (input.company !== undefined) patch.company = input.company;
  if (input.role !== undefined) patch.role = input.role;
  if (input.status !== undefined) patch.status = input.status;
  if (input.appliedDate !== undefined) patch.applied_date = input.appliedDate;
  if (input.contactName !== undefined) patch.contact_name = input.contactName;
  if (input.contactNotes !== undefined) patch.contact_notes = input.contactNotes;
  if (input.nextFollowUpDate !== undefined) patch.next_follow_up_date = input.nextFollowUpDate;
  if (input.compensationNotes !== undefined) patch.compensation_notes = input.compensationNotes;
  if (input.jobUrl !== undefined) patch.job_url = input.jobUrl;

  const { data, error } = await supabase
    .from("job_applications")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle<JobApplicationRow>();
  if (error) throw new Error(error.message);
  return data ? mapJobApplicationRow(data) : null;
}

// --- Overview ------------------------------------------------------------

export async function getOverview(session: AuthSession): Promise<CommandCenterOverview> {
  if (shouldUseMock(session)) return mockStore.buildOverview();

  const [tasks, briefingItems, integrations, jobApplications, unprocessedCaptures] = await Promise.all([
    listPersonalTasks(session),
    getDailyBriefing(session),
    listIntegrations(session),
    listJobApplications(session),
    listUnprocessedCaptures(session)
  ]);

  return mockStore.computeOverviewFromParts({
    tasks,
    briefingItems,
    integrations,
    jobApplications,
    unprocessedCaptureCount: unprocessedCaptures.length
  });
}
