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
import { FirecrawlConfigError, readFirecrawlConfig, scrapeUrl, summarizeMarkdown } from "@/lib/command-center/integrations/firecrawl";
import { BRIEFING_SOURCES } from "@/lib/command-center/integrations/firecrawl-sources";
import { listMondayBoardItems } from "@/lib/command-center/integrations/monday";
import type {
  BriefingItem,
  CaptureEntry,
  CommandCenterOverview,
  CreateAiConversationMessageInput,
  CreateJobApplicationInput,
  CreatePersonalTaskInput,
  CreateSageMemoryInput,
  AiConversationMessage,
  FeedRunLog,
  FeedRunStatus,
  JobApplication,
  JobApplicationStatus,
  KnowledgeItem,
  KnowledgeSource,
  KnowledgeSourceStatus,
  PersonalDomain,
  PersonalIntegration,
  PersonalTask,
  PersonalTaskPriority,
  PersonalTaskStatus,
  SageMemory,
  SageMemoryType,
  UpdateJobApplicationInput,
  UpdatePersonalTaskInput,
  WeeklyFeed,
  WeeklyFeedItemWithDetail
} from "@/lib/command-center/types";

const TASK_COLUMNS =
  "id, domain, title, description, status, priority, due_date, tags, monday_board_id, monday_item_id, created_at, updated_at";
const CAPTURE_COLUMNS = "id, raw_text, status, routed_domain, routed_task_id, created_at";
const AI_CONVERSATION_COLUMNS = "id, session_id, role, content, created_at";
const JOB_APPLICATION_COLUMNS =
  "id, company, role, status, applied_date, contact_name, contact_notes, next_follow_up_date, compensation_notes, job_url, created_at, updated_at";
const SAGE_MEMORY_COLUMNS = "id, memory_type, content, domain, created_at, last_referenced_at";

export function shouldUseMock(session: AuthSession): boolean {
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
  monday_board_id: string | null;
  monday_item_id: string | null;
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
    mondayBoardId: row.monday_board_id ?? undefined,
    mondayItemId: row.monday_item_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type IntegrationRow = {
  id: string;
  service: PersonalIntegration["service"];
  status: PersonalIntegration["status"];
  config: Record<string, unknown> | null;
};

function mapIntegrationRow(row: IntegrationRow): PersonalIntegration {
  return {
    id: row.id,
    service: row.service,
    status: row.status,
    config: row.config ?? {}
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

type SageMemoryRow = {
  id: string;
  memory_type: SageMemoryType;
  content: string;
  domain: PersonalDomain | null;
  created_at: string;
  last_referenced_at: string | null;
};

function mapSageMemoryRow(row: SageMemoryRow): SageMemory {
  return {
    id: row.id,
    memoryType: row.memory_type,
    content: row.content,
    domain: row.domain ?? undefined,
    createdAt: row.created_at,
    lastReferencedAt: row.last_referenced_at ?? undefined
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

type AiConversationRow = {
  id: string;
  session_id: string;
  role: AiConversationMessage["role"];
  content: string;
  created_at: string;
};

function mapAiConversationRow(row: AiConversationRow): AiConversationMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
}

// --- Tasks -------------------------------------------------------------

export async function listPersonalTasks(
  session: AuthSession,
  filter?: { domain?: PersonalDomain; status?: PersonalTaskStatus }
): Promise<PersonalTask[]> {
  if (shouldUseMock(session)) return mockStore.listTasks(filter);

  const supabase = getSupabaseAuthClient(session.accessToken);
  let query = supabase.from("personal_tasks").select(TASK_COLUMNS).order("created_at", { ascending: false });
  if (filter?.domain) query = query.eq("domain", filter.domain);
  if (filter?.status) query = query.eq("status", filter.status);
  const { data, error } = await query.returns<TaskRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTaskRow);
}

export async function createPersonalTask(
  session: AuthSession,
  input: CreatePersonalTaskInput
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
      tags: input.tags,
      monday_board_id: input.mondayBoardId ?? null,
      monday_item_id: input.mondayItemId ?? null
    })
    .select(TASK_COLUMNS)
    .single<TaskRow>();
  if (error) throw new Error(error.message);
  return mapTaskRow(data);
}

export async function updatePersonalTask(
  session: AuthSession,
  id: string,
  input: UpdatePersonalTaskInput
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

  const { data, error } = await supabase
    .from("personal_tasks")
    .update(patch)
    .eq("id", id)
    .select(TASK_COLUMNS)
    .maybeSingle<TaskRow>();
  if (error) throw new Error(error.message);
  return data ? mapTaskRow(data) : null;
}

export async function deletePersonalTask(session: AuthSession, id: string): Promise<void> {
  if (shouldUseMock(session)) return mockStore.deleteTask(id);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.from("personal_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type MondaySyncResult = {
  importedCount: number;
  skippedCount: number;
  importedTasks: PersonalTask[];
};

// One-directional sync, Monday.com -> Command Center only (the direction
// Andrew approved; personal_tasks are never written back to Monday.com --
// there is still no mutation call anywhere in lib/command-center/integrations/monday.ts).
// Andrew-triggered only, one board at a time. Re-running this is safe: each
// Monday item is imported at most once, deduped by mondayItemId, so a
// second sync only picks up items that are new since the last run and
// never touches a task Andrew has already started working from in the
// Command Center.
export async function syncMondayBoardTasks(
  session: AuthSession,
  params: { boardId: string; domain: PersonalDomain }
): Promise<MondaySyncResult> {
  const items = await listMondayBoardItems({ boardId: params.boardId });

  const existingTasks = await listPersonalTasks(session);
  const alreadyImported = new Set(existingTasks.map((task) => task.mondayItemId).filter((id): id is string => Boolean(id)));
  const newItems = items.filter((item) => !alreadyImported.has(item.id));

  const importedTasks: PersonalTask[] = [];
  for (const item of newItems) {
    const description = item.columns.map((column) => column.text).filter(Boolean).join(", ") || undefined;
    const task = await createPersonalTask(session, {
      domain: params.domain,
      title: item.name,
      description,
      status: "todo",
      priority: "medium",
      tags: [],
      mondayBoardId: params.boardId,
      mondayItemId: item.id
    });
    importedTasks.push(task);
  }

  await updateIntegration(session, "monday", { status: "connected", config: {} });

  return { importedCount: importedTasks.length, skippedCount: items.length - importedTasks.length, importedTasks };
}

// --- Briefing ------------------------------------------------------------

type BriefingCacheRow = { items: BriefingItem[] };

export async function getDailyBriefing(session: AuthSession): Promise<BriefingItem[]> {
  if (shouldUseMock(session)) return mockStore.getBriefing();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const cacheDate = new Date().toISOString().slice(0, 10);

  const { data: today, error: todayError } = await supabase
    .from("daily_briefing_cache")
    .select("items")
    .eq("cache_date", cacheDate)
    .maybeSingle<BriefingCacheRow>();
  if (todayError) throw new Error(todayError.message);
  if (today?.items?.length) return today.items;

  // Never fetch live here -- refreshDailyBriefing is the only path that
  // calls Firecrawl, and only when Andrew explicitly triggers it. Fall back
  // to the most recent cached day, then to static starter content, so the
  // feed is never blank before the first manual refresh.
  const { data: latest, error: latestError } = await supabase
    .from("daily_briefing_cache")
    .select("items")
    .order("cache_date", { ascending: false })
    .limit(1)
    .maybeSingle<BriefingCacheRow>();
  if (latestError) throw new Error(latestError.message);
  if (latest?.items?.length) return latest.items;

  return mockStore.getBriefing();
}

// Manual, Andrew-triggered refresh of the curated resource feed. Scrapes
// each entry in BRIEFING_SOURCES independently -- one failed source never
// blocks the others -- and caches the result under today's date so
// getDailyBriefing never needs to call Firecrawl itself.
export async function refreshDailyBriefing(session: AuthSession): Promise<BriefingItem[]> {
  const config = readFirecrawlConfig();
  if (!config.configured) throw new FirecrawlConfigError(config.missing);

  const results = await Promise.allSettled(
    BRIEFING_SOURCES.map(async (entry): Promise<BriefingItem> => {
      const scraped = await scrapeUrl({ url: entry.url });
      return {
        id: `brief_${crypto.randomUUID()}`,
        title: scraped.title,
        url: entry.url,
        summary: summarizeMarkdown(scraped.markdown),
        source: entry.source,
        category: entry.category
      };
    })
  );

  const items = results
    .filter((result): result is PromiseFulfilledResult<BriefingItem> => result.status === "fulfilled")
    .map((result) => result.value);

  // Never cache a total wipeout: getDailyBriefing's "most recent cached day"
  // fallback would otherwise pick up an empty row and permanently shadow the
  // last good cache. Partial failures (some sources succeed) are fine.
  if (items.length === 0) {
    throw new Error("All Firecrawl sources failed to scrape.");
  }

  if (shouldUseMock(session)) {
    mockStore.setBriefing(items);
    return items;
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const cacheDate = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("daily_briefing_cache")
    .upsert({ cache_date: cacheDate, items, generated_at: new Date().toISOString() }, { onConflict: "cache_date" });
  if (error) throw new Error(error.message);

  await updateIntegration(session, "firecrawl", { status: "connected", config: {} });

  return items;
}

// --- SAGE Conversation ------------------------------------------------------------

export async function appendConversationMessage(
  session: AuthSession,
  input: CreateAiConversationMessageInput
): Promise<AiConversationMessage> {
  if (shouldUseMock(session)) return mockStore.appendConversationMessage(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content
    })
    .select(AI_CONVERSATION_COLUMNS)
    .single<AiConversationRow>();
  if (error) throw new Error(error.message);
  return mapAiConversationRow(data);
}

export async function listConversationMessages(
  session: AuthSession,
  sessionId: string,
  limit = 40
): Promise<AiConversationMessage[]> {
  if (shouldUseMock(session)) return mockStore.listConversationMessages(sessionId, limit);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("ai_conversations")
    .select(AI_CONVERSATION_COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AiConversationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAiConversationRow).reverse();
}

// --- Integrations ------------------------------------------------------------

export async function listIntegrations(session: AuthSession): Promise<PersonalIntegration[]> {
  if (shouldUseMock(session)) return mockStore.listIntegrations();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_integrations")
    .select("id, service, status, config")
    .returns<IntegrationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIntegrationRow);
}

export async function getIntegration(
  session: AuthSession,
  service: PersonalIntegration["service"]
): Promise<PersonalIntegration | null> {
  if (shouldUseMock(session)) return mockStore.getIntegration(service);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_integrations")
    .select("id, service, status, config")
    .eq("service", service)
    .maybeSingle<IntegrationRow>();
  if (error) throw new Error(error.message);
  return data ? mapIntegrationRow(data) : null;
}

// Persists integration status/config (e.g. OAuth tokens) server-side only.
// Callers must never return `config` back to the client; only status and
// catalog metadata (lib/command-center/integrations-meta.ts) are safe to
// expose over the API.
export async function updateIntegration(
  session: AuthSession,
  service: PersonalIntegration["service"],
  input: { status: PersonalIntegration["status"]; config: Record<string, unknown> }
): Promise<PersonalIntegration | null> {
  if (shouldUseMock(session)) return mockStore.updateIntegration(service, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_integrations")
    .update({ status: input.status, config: input.config })
    .eq("service", service)
    .select("id, service, status, config")
    .maybeSingle<IntegrationRow>();
  if (error) throw new Error(error.message);
  return data ? mapIntegrationRow(data) : null;
}

// --- Quick Capture ------------------------------------------------------------

export async function createCaptureEntry(session: AuthSession, rawText: string): Promise<CaptureEntry> {
  if (shouldUseMock(session)) return mockStore.createCaptureEntry(rawText);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("capture_inbox")
    .insert({ raw_text: rawText })
    .select(CAPTURE_COLUMNS)
    .single<CaptureRow>();
  if (error) throw new Error(error.message);
  return mapCaptureRow(data);
}

export async function listUnprocessedCaptures(session: AuthSession): Promise<CaptureEntry[]> {
  if (shouldUseMock(session)) return mockStore.listUnprocessedCaptures();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("capture_inbox")
    .select(CAPTURE_COLUMNS)
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
    .select(CAPTURE_COLUMNS)
    .maybeSingle<CaptureRow>();
  if (error) throw new Error(error.message);
  return data ? mapCaptureRow(data) : null;
}

// --- Job Applications ------------------------------------------------------------

export async function listJobApplications(
  session: AuthSession,
  filter?: { status?: JobApplicationStatus }
): Promise<JobApplication[]> {
  if (shouldUseMock(session)) return mockStore.listJobApplications(filter);

  const supabase = getSupabaseAuthClient(session.accessToken);
  let query = supabase.from("job_applications").select(JOB_APPLICATION_COLUMNS).order("created_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  const { data, error } = await query.returns<JobApplicationRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapJobApplicationRow);
}

export async function createJobApplication(
  session: AuthSession,
  input: CreateJobApplicationInput
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
    .select(JOB_APPLICATION_COLUMNS)
    .single<JobApplicationRow>();
  if (error) throw new Error(error.message);
  return mapJobApplicationRow(data);
}

export async function updateJobApplication(
  session: AuthSession,
  id: string,
  input: UpdateJobApplicationInput
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
    .select(JOB_APPLICATION_COLUMNS)
    .maybeSingle<JobApplicationRow>();
  if (error) throw new Error(error.message);
  return data ? mapJobApplicationRow(data) : null;
}

// --- SAGE Memory ------------------------------------------------------------
//
// Andrew-authored notes SAGE can draw on across conversations (schema from
// migration 023/024). Andrew adds and removes entries from
// /command-center/memory; there is no write path anywhere that lets SAGE
// chat create, update, or delete a memory entry itself -- matching the
// "no automatic memory saving" guardrail already in the SAGE prompts.

export async function listSageMemory(session: AuthSession): Promise<SageMemory[]> {
  if (shouldUseMock(session)) return mockStore.listSageMemory();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("sage_memory")
    .select(SAGE_MEMORY_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<SageMemoryRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSageMemoryRow);
}

export async function createSageMemory(session: AuthSession, input: CreateSageMemoryInput): Promise<SageMemory> {
  if (shouldUseMock(session)) return mockStore.createSageMemory(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("sage_memory")
    .insert({ memory_type: input.memoryType, content: input.content, domain: input.domain ?? null })
    .select(SAGE_MEMORY_COLUMNS)
    .single<SageMemoryRow>();
  if (error) throw new Error(error.message);
  return mapSageMemoryRow(data);
}

export async function deleteSageMemory(session: AuthSession, id: string): Promise<void> {
  if (shouldUseMock(session)) return mockStore.deleteSageMemory(id);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.from("sage_memory").delete().eq("id", id);
  if (error) throw new Error(error.message);
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

// --- SAGE Weekly Intelligence Feed ------------------------------------------
// See lib/command-center/weekly-feed/ for the ingestion/analysis/generation
// pipeline that calls these. Table names are personal_knowledge_* /
// personal_weekly_* (migration 031) to avoid colliding with the unrelated
// Student Portal Scripture RAG spine's public.knowledge_sources table.

const KNOWLEDGE_SOURCE_COLUMNS =
  "id, google_drive_file_id, file_name, file_path, source_type, title, source_name, author_or_host, url, date_found, imported_at, last_modified_at, content_hash, status, error_message, created_at, updated_at";
const KNOWLEDGE_ITEM_COLUMNS =
  "id, source_id, summary, key_takeaways, topic_tags, relevance_score, ministry_application, command_center_application, theological_or_discipleship_connection, career_readiness_connection, caveats, created_at, updated_at";
const WEEKLY_FEED_COLUMNS =
  "id, week_start, week_end, title, executive_summary, top_topics, app_platform_implications, ministry_implications, suggested_action_items, created_at, created_by";
const WEEKLY_FEED_ITEM_COLUMNS = "id, weekly_feed_id, knowledge_item_id, rank, section, reason_included, recommended_action, confidence_note, created_at";
const FEED_RUN_LOG_COLUMNS =
  "id, run_started_at, run_completed_at, triggered_by, status, files_scanned, files_imported, files_skipped, errors_count, error_details, model_used, duration_ms, created_at";

type KnowledgeSourceRow = {
  id: string;
  google_drive_file_id: string;
  file_name: string;
  file_path: string;
  source_type: KnowledgeSource["sourceType"];
  title: string;
  source_name: string | null;
  author_or_host: string | null;
  url: string | null;
  date_found: string | null;
  imported_at: string;
  last_modified_at: string | null;
  content_hash: string;
  status: KnowledgeSourceStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapKnowledgeSourceRow(row: KnowledgeSourceRow): KnowledgeSource {
  return {
    id: row.id,
    googleDriveFileId: row.google_drive_file_id,
    fileName: row.file_name,
    filePath: row.file_path,
    sourceType: row.source_type,
    title: row.title,
    sourceName: row.source_name ?? undefined,
    authorOrHost: row.author_or_host ?? undefined,
    url: row.url ?? undefined,
    dateFound: row.date_found ?? undefined,
    importedAt: row.imported_at,
    lastModifiedAt: row.last_modified_at ?? undefined,
    contentHash: row.content_hash,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getKnowledgeSourceByDriveFileId(session: AuthSession, googleDriveFileId: string): Promise<KnowledgeSource | null> {
  if (shouldUseMock(session)) return mockStore.getKnowledgeSourceByDriveFileId(googleDriveFileId);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_knowledge_sources")
    .select(KNOWLEDGE_SOURCE_COLUMNS)
    .eq("google_drive_file_id", googleDriveFileId)
    .maybeSingle<KnowledgeSourceRow>();
  if (error) throw new Error(error.message);
  return data ? mapKnowledgeSourceRow(data) : null;
}

export type UpsertKnowledgeSourceInput = {
  googleDriveFileId: string;
  fileName: string;
  filePath: string;
  sourceType: KnowledgeSource["sourceType"];
  title: string;
  sourceName?: string;
  authorOrHost?: string;
  url?: string;
  dateFound?: string;
  lastModifiedAt?: string;
  contentHash: string;
};

// Creates or updates a source by its unique Drive file ID. Always resets
// status to "new" -- ingest.ts only calls this for files whose content hash
// has changed (or is brand new), so a re-import should surface again for
// review rather than staying silently archived/skipped from a prior week.
export async function upsertKnowledgeSource(session: AuthSession, input: UpsertKnowledgeSourceInput): Promise<KnowledgeSource> {
  if (shouldUseMock(session)) return mockStore.upsertKnowledgeSource(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_knowledge_sources")
    .upsert(
      {
        google_drive_file_id: input.googleDriveFileId,
        file_name: input.fileName,
        file_path: input.filePath,
        source_type: input.sourceType,
        title: input.title,
        source_name: input.sourceName ?? null,
        author_or_host: input.authorOrHost ?? null,
        url: input.url ?? null,
        date_found: input.dateFound ?? null,
        last_modified_at: input.lastModifiedAt ?? null,
        content_hash: input.contentHash,
        status: "new",
        error_message: null
      },
      { onConflict: "google_drive_file_id" }
    )
    .select(KNOWLEDGE_SOURCE_COLUMNS)
    .single<KnowledgeSourceRow>();
  if (error) throw new Error(error.message);
  return mapKnowledgeSourceRow(data);
}

export async function markKnowledgeSourceError(session: AuthSession, id: string, message: string): Promise<void> {
  if (shouldUseMock(session)) return mockStore.markKnowledgeSourceError(id, message);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.from("personal_knowledge_sources").update({ error_message: message }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateKnowledgeSourceStatus(
  session: AuthSession,
  id: string,
  status: KnowledgeSourceStatus
): Promise<KnowledgeSource | null> {
  if (shouldUseMock(session)) return mockStore.updateKnowledgeSourceStatus(id, status);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_knowledge_sources")
    .update({ status })
    .eq("id", id)
    .select(KNOWLEDGE_SOURCE_COLUMNS)
    .maybeSingle<KnowledgeSourceRow>();
  if (error) throw new Error(error.message);
  return data ? mapKnowledgeSourceRow(data) : null;
}

export async function listKnowledgeSources(
  session: AuthSession,
  filter?: { sourceType?: KnowledgeSource["sourceType"]; status?: KnowledgeSourceStatus }
): Promise<KnowledgeSource[]> {
  if (shouldUseMock(session)) return mockStore.listKnowledgeSources(filter);

  const supabase = getSupabaseAuthClient(session.accessToken);
  let query = supabase.from("personal_knowledge_sources").select(KNOWLEDGE_SOURCE_COLUMNS).order("date_found", { ascending: false });
  if (filter?.sourceType) query = query.eq("source_type", filter.sourceType);
  if (filter?.status) query = query.eq("status", filter.status);
  const { data, error } = await query.returns<KnowledgeSourceRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapKnowledgeSourceRow);
}

type KnowledgeItemRow = {
  id: string;
  source_id: string;
  summary: string;
  key_takeaways: string | null;
  topic_tags: string[] | null;
  relevance_score: number | null;
  ministry_application: string | null;
  command_center_application: string | null;
  theological_or_discipleship_connection: string | null;
  career_readiness_connection: string | null;
  caveats: string | null;
  created_at: string;
  updated_at: string;
};

function mapKnowledgeItemRow(row: KnowledgeItemRow): KnowledgeItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    summary: row.summary,
    keyTakeaways: row.key_takeaways ?? undefined,
    topicTags: row.topic_tags ?? [],
    relevanceScore: row.relevance_score ?? undefined,
    ministryApplication: row.ministry_application ?? undefined,
    commandCenterApplication: row.command_center_application ?? undefined,
    theologicalOrDiscipleshipConnection: row.theological_or_discipleship_connection ?? undefined,
    careerReadinessConnection: row.career_readiness_connection ?? undefined,
    caveats: row.caveats ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type CreateKnowledgeItemInput = {
  sourceId: string;
  summary: string;
  keyTakeaways?: string;
  topicTags: string[];
  relevanceScore?: number;
  ministryApplication?: string;
  commandCenterApplication?: string;
  theologicalOrDiscipleshipConnection?: string;
  careerReadinessConnection?: string;
  caveats?: string;
};

export async function createKnowledgeItem(session: AuthSession, input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
  if (shouldUseMock(session)) return mockStore.createKnowledgeItem(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_knowledge_items")
    .insert({
      source_id: input.sourceId,
      summary: input.summary,
      key_takeaways: input.keyTakeaways ?? null,
      topic_tags: input.topicTags,
      relevance_score: input.relevanceScore ?? null,
      ministry_application: input.ministryApplication ?? null,
      command_center_application: input.commandCenterApplication ?? null,
      theological_or_discipleship_connection: input.theologicalOrDiscipleshipConnection ?? null,
      career_readiness_connection: input.careerReadinessConnection ?? null,
      caveats: input.caveats ?? null
    })
    .select(KNOWLEDGE_ITEM_COLUMNS)
    .single<KnowledgeItemRow>();
  if (error) throw new Error(error.message);
  return mapKnowledgeItemRow(data);
}

type WeeklyFeedRow = {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  executive_summary: string;
  top_topics: string[] | null;
  app_platform_implications: string | null;
  ministry_implications: string | null;
  suggested_action_items: string | null;
  created_at: string;
  created_by: string | null;
};

function mapWeeklyFeedRow(row: WeeklyFeedRow): WeeklyFeed {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    title: row.title,
    executiveSummary: row.executive_summary,
    topTopics: row.top_topics ?? [],
    appPlatformImplications: row.app_platform_implications ?? undefined,
    ministryImplications: row.ministry_implications ?? undefined,
    suggestedActionItems: row.suggested_action_items ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined
  };
}

export type CreateWeeklyFeedInput = {
  weekStart: string;
  weekEnd: string;
  title: string;
  executiveSummary: string;
  topTopics: string[];
  appPlatformImplications?: string;
  ministryImplications?: string;
  suggestedActionItems?: string;
  createdBy?: string;
};

export async function createWeeklyFeed(session: AuthSession, input: CreateWeeklyFeedInput): Promise<WeeklyFeed> {
  if (shouldUseMock(session)) return mockStore.createWeeklyFeed(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_weekly_feeds")
    .upsert(
      {
        week_start: input.weekStart,
        week_end: input.weekEnd,
        title: input.title,
        executive_summary: input.executiveSummary,
        top_topics: input.topTopics,
        app_platform_implications: input.appPlatformImplications ?? null,
        ministry_implications: input.ministryImplications ?? null,
        suggested_action_items: input.suggestedActionItems ?? null,
        created_by: input.createdBy ?? null
      },
      { onConflict: "week_start" }
    )
    .select(WEEKLY_FEED_COLUMNS)
    .single<WeeklyFeedRow>();
  if (error) throw new Error(error.message);
  return mapWeeklyFeedRow(data);
}

export type CreateWeeklyFeedItemInput = {
  weeklyFeedId: string;
  knowledgeItemId: string;
  rank: number;
  section: string;
  reasonIncluded?: string;
  recommendedAction?: string;
  confidenceNote?: string;
};

export async function replaceWeeklyFeedItems(session: AuthSession, weeklyFeedId: string, items: CreateWeeklyFeedItemInput[]): Promise<void> {
  if (shouldUseMock(session)) return mockStore.replaceWeeklyFeedItems(weeklyFeedId, items);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error: deleteError } = await supabase.from("personal_weekly_feed_items").delete().eq("weekly_feed_id", weeklyFeedId);
  if (deleteError) throw new Error(deleteError.message);
  if (items.length === 0) return;

  const { error } = await supabase.from("personal_weekly_feed_items").insert(
    items.map((item) => ({
      weekly_feed_id: item.weeklyFeedId,
      knowledge_item_id: item.knowledgeItemId,
      rank: item.rank,
      section: item.section,
      reason_included: item.reasonIncluded ?? null,
      recommended_action: item.recommendedAction ?? null,
      confidence_note: item.confidenceNote ?? null
    }))
  );
  if (error) throw new Error(error.message);
}

type WeeklyFeedItemRow = {
  id: string;
  weekly_feed_id: string;
  knowledge_item_id: string;
  rank: number;
  section: string;
  reason_included: string | null;
  recommended_action: string | null;
  confidence_note: string | null;
  created_at: string;
};

export async function getLatestWeeklyFeedWithItems(
  session: AuthSession
): Promise<{ feed: WeeklyFeed; items: WeeklyFeedItemWithDetail[] } | null> {
  if (shouldUseMock(session)) return mockStore.getLatestWeeklyFeedWithItems();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data: feedRow, error: feedError } = await supabase
    .from("personal_weekly_feeds")
    .select(WEEKLY_FEED_COLUMNS)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<WeeklyFeedRow>();
  if (feedError) throw new Error(feedError.message);
  if (!feedRow) return null;
  const feed = mapWeeklyFeedRow(feedRow);

  const { data: itemRows, error: itemsError } = await supabase
    .from("personal_weekly_feed_items")
    .select(WEEKLY_FEED_ITEM_COLUMNS)
    .eq("weekly_feed_id", feed.id)
    .order("rank", { ascending: true })
    .returns<WeeklyFeedItemRow[]>();
  if (itemsError) throw new Error(itemsError.message);

  const knowledgeItemIds = (itemRows ?? []).map((row) => row.knowledge_item_id);
  const { data: knowledgeItemRows, error: knowledgeItemsError } = await supabase
    .from("personal_knowledge_items")
    .select(KNOWLEDGE_ITEM_COLUMNS)
    .in("id", knowledgeItemIds.length > 0 ? knowledgeItemIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<KnowledgeItemRow[]>();
  if (knowledgeItemsError) throw new Error(knowledgeItemsError.message);
  const knowledgeItemsById = new Map((knowledgeItemRows ?? []).map((row) => [row.id, mapKnowledgeItemRow(row)]));

  const sourceIds = Array.from(knowledgeItemsById.values()).map((item) => item.sourceId);
  const { data: sourceRows, error: sourcesError } = await supabase
    .from("personal_knowledge_sources")
    .select(KNOWLEDGE_SOURCE_COLUMNS)
    .in("id", sourceIds.length > 0 ? sourceIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<KnowledgeSourceRow[]>();
  if (sourcesError) throw new Error(sourcesError.message);
  const sourcesById = new Map((sourceRows ?? []).map((row) => [row.id, mapKnowledgeSourceRow(row)]));

  const items: WeeklyFeedItemWithDetail[] = (itemRows ?? []).flatMap((row) => {
    const knowledgeItem = knowledgeItemsById.get(row.knowledge_item_id);
    const source = knowledgeItem ? sourcesById.get(knowledgeItem.sourceId) : undefined;
    if (!knowledgeItem || !source) return [];
    return [
      {
        id: row.id,
        weeklyFeedId: row.weekly_feed_id,
        knowledgeItemId: row.knowledge_item_id,
        rank: row.rank,
        section: row.section,
        reasonIncluded: row.reason_included ?? undefined,
        recommendedAction: row.recommended_action ?? undefined,
        confidenceNote: row.confidence_note ?? undefined,
        createdAt: row.created_at,
        knowledgeItem,
        source
      }
    ];
  });

  return { feed, items };
}

type FeedRunLogRow = {
  id: string;
  run_started_at: string;
  run_completed_at: string | null;
  triggered_by: string;
  status: FeedRunStatus;
  files_scanned: number;
  files_imported: number;
  files_skipped: number;
  errors_count: number;
  error_details: string[] | null;
  model_used: string | null;
  duration_ms: number | null;
  created_at: string;
};

function mapFeedRunLogRow(row: FeedRunLogRow): FeedRunLog {
  return {
    id: row.id,
    runStartedAt: row.run_started_at,
    runCompletedAt: row.run_completed_at ?? undefined,
    triggeredBy: row.triggered_by,
    status: row.status,
    filesScanned: row.files_scanned,
    filesImported: row.files_imported,
    filesSkipped: row.files_skipped,
    errorsCount: row.errors_count,
    errorDetails: row.error_details ?? [],
    modelUsed: row.model_used ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    createdAt: row.created_at
  };
}

export async function createFeedRunLog(session: AuthSession, triggeredBy: string): Promise<FeedRunLog> {
  if (shouldUseMock(session)) return mockStore.createFeedRunLog(triggeredBy);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("personal_feed_run_logs")
    .insert({ triggered_by: triggeredBy, status: "running" })
    .select(FEED_RUN_LOG_COLUMNS)
    .single<FeedRunLogRow>();
  if (error) throw new Error(error.message);
  return mapFeedRunLogRow(data);
}

export type CompleteFeedRunLogInput = {
  status: FeedRunStatus;
  filesScanned: number;
  filesImported: number;
  filesSkipped: number;
  errorsCount: number;
  errorDetails: string[];
  modelUsed?: string;
  durationMs: number;
};

export async function completeFeedRunLog(session: AuthSession, id: string, input: CompleteFeedRunLogInput): Promise<void> {
  if (shouldUseMock(session)) return mockStore.completeFeedRunLog(id, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase
    .from("personal_feed_run_logs")
    .update({
      run_completed_at: new Date().toISOString(),
      status: input.status,
      files_scanned: input.filesScanned,
      files_imported: input.filesImported,
      files_skipped: input.filesSkipped,
      errors_count: input.errorsCount,
      error_details: input.errorDetails,
      model_used: input.modelUsed ?? null,
      duration_ms: input.durationMs
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
