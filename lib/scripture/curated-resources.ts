import { randomUUID } from "crypto";

import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import {
  studentCuratedResourceKinds,
  studentCuratedResourceStages,
  type StudentCuratedResource,
  type StudentCuratedResourceKind,
  type StudentCuratedResourceStage,
  type StudentCuratedResourceState
} from "@/lib/scripture/curated-resource-shared";

export type UpsertStudentCuratedResourceInput = {
  kind?: string;
  journeyStage?: string;
  title?: string;
  summary?: string;
  body?: string;
  scriptureReferences?: string[] | string;
  themes?: string[] | string;
  questionPatterns?: string[] | string;
  practicePrompt?: string;
  href?: string;
  sortOrder?: number | string;
  isActive?: boolean | string;
};

type StudentCuratedResourceRow = {
  id: string;
  kind: StudentCuratedResourceKind;
  journey_stage: StudentCuratedResourceStage | null;
  title: string;
  summary: string;
  body: string;
  scripture_references: string[] | null;
  themes: string[] | null;
  question_patterns: string[] | null;
  practice_prompt: string | null;
  href: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ResourceStore = Map<string, StudentCuratedResource[]>;

const LEADER_ROLES = new Set(["admin", "leader", "staff"]);
const localCuratedResourceKey = Symbol.for("lead-emergence.student-curated-resources");
const localResources =
  ((globalThis as typeof globalThis & { [localCuratedResourceKey]?: ResourceStore })[localCuratedResourceKey] ??=
    new Map<string, StudentCuratedResource[]>());

export class StudentCuratedResourceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "curated_resource_error"
  ) {
    super(message);
  }
}

export async function getStudentCuratedResourceState(
  session: AuthSession,
  options: { includeInactive?: boolean } = {}
): Promise<StudentCuratedResourceState> {
  const resources = await listStudentCuratedResources(session, options);
  return {
    readiness: {
      storage: shouldUseLocalCuratedResources(session) ? "local" : "live",
      message: shouldUseLocalCuratedResources(session)
        ? "Student-facing resources are saved in this local dev session."
        : "Student-facing resources are connected to live storage."
    },
    resources,
    stats: {
      total: resources.length,
      active: resources.filter((resource) => resource.isActive).length,
      drafted: resources.filter((resource) => !resource.isActive).length
    }
  };
}

export async function listStudentCuratedResources(session: AuthSession, options: { includeInactive?: boolean } = {}) {
  if (shouldUseLocalCuratedResources(session)) {
    const resources = await getLocalResources(session);
    return filterAndSortResources(resources, options.includeInactive);
  }

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    let query = supabase
      .from("student_curated_resources")
      .select(
        "id,kind,journey_stage,title,summary,body,scripture_references,themes,question_patterns,practice_prompt,href,sort_order,is_active,created_at,updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(80);

    if (!options.includeInactive) query = query.eq("is_active", true);
    const result = await query.returns<StudentCuratedResourceRow[]>();
    if (result.error) throw result.error;
    return filterAndSortResources((result.data ?? []).map(toCuratedResource), options.includeInactive);
  } catch (error) {
    console.warn("[scripture] curated resource query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return filterAndSortResources(await getLocalResources(session), options.includeInactive);
  }
}

export async function createStudentCuratedResource(session: AuthSession, input: UpsertStudentCuratedResourceInput) {
  assertCuratedResourceLeader(session);
  const normalized = normalizeCuratedResourceInput(input);

  if (shouldUseLocalCuratedResources(session)) {
    const resources = await getLocalResources(session);
    const now = new Date().toISOString();
    const resource: StudentCuratedResource = {
      id: `local_${randomUUID()}`,
      ...normalized,
      createdAt: now,
      updatedAt: now
    };
    resources.unshift(resource);
    await setLocalResources(session, resources);
    return resource;
  }

  const ministryId = await resolveMinistryScope(session);
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_curated_resources")
    .insert({
      ...ministryScopeColumns(ministryId),
      kind: normalized.kind,
      journey_stage: normalized.journeyStage,
      title: normalized.title,
      summary: normalized.summary,
      body: normalized.body,
      scripture_references: normalized.scriptureReferences,
      themes: normalized.themes,
      question_patterns: normalized.questionPatterns,
      practice_prompt: normalized.practicePrompt || null,
      href: normalized.href || null,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
      created_by_user_id: session.user.id
    })
    .select(
      "id,kind,journey_stage,title,summary,body,scripture_references,themes,question_patterns,practice_prompt,href,sort_order,is_active,created_at,updated_at"
    )
    .single<StudentCuratedResourceRow>();
  throwIfResourceError(result.error, "The resource could not be saved.");
  if (!result.data) throw new StudentCuratedResourceError("The resource was not saved.", 500, "missing_saved_resource");
  return toCuratedResource(result.data);
}

export async function updateStudentCuratedResource(session: AuthSession, id: string, input: UpsertStudentCuratedResourceInput) {
  assertCuratedResourceLeader(session);
  const normalized = normalizeCuratedResourceInput(input);

  if (shouldUseLocalCuratedResources(session)) {
    const resources = await getLocalResources(session);
    const current = resources.find((resource) => resource.id === id);
    if (!current) throw new StudentCuratedResourceError("Resource not found.", 404, "not_found");
    const updated: StudentCuratedResource = {
      ...current,
      ...normalized,
      updatedAt: new Date().toISOString()
    };
    await setLocalResources(
      session,
      resources.map((resource) => (resource.id === id ? updated : resource))
    );
    return updated;
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_curated_resources")
    .update({
      kind: normalized.kind,
      journey_stage: normalized.journeyStage,
      title: normalized.title,
      summary: normalized.summary,
      body: normalized.body,
      scripture_references: normalized.scriptureReferences,
      themes: normalized.themes,
      question_patterns: normalized.questionPatterns,
      practice_prompt: normalized.practicePrompt || null,
      href: normalized.href || null,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive
    })
    .eq("id", id)
    .select(
      "id,kind,journey_stage,title,summary,body,scripture_references,themes,question_patterns,practice_prompt,href,sort_order,is_active,created_at,updated_at"
    )
    .single<StudentCuratedResourceRow>();
  throwIfResourceError(result.error, "The resource could not be updated.");
  if (!result.data) throw new StudentCuratedResourceError("Resource not found.", 404, "not_found");
  return toCuratedResource(result.data);
}

export async function archiveStudentCuratedResource(session: AuthSession, id: string) {
  assertCuratedResourceLeader(session);

  if (shouldUseLocalCuratedResources(session)) {
    const resources = await getLocalResources(session);
    const current = resources.find((resource) => resource.id === id);
    if (!current) throw new StudentCuratedResourceError("Resource not found.", 404, "not_found");
    const updated = { ...current, isActive: false, updatedAt: new Date().toISOString() };
    await setLocalResources(
      session,
      resources.map((resource) => (resource.id === id ? updated : resource))
    );
    return updated;
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_curated_resources")
    .update({ is_active: false })
    .eq("id", id)
    .select(
      "id,kind,journey_stage,title,summary,body,scripture_references,themes,question_patterns,practice_prompt,href,sort_order,is_active,created_at,updated_at"
    )
    .single<StudentCuratedResourceRow>();
  throwIfResourceError(result.error, "The resource could not be archived.");
  if (!result.data) throw new StudentCuratedResourceError("Resource not found.", 404, "not_found");
  return toCuratedResource(result.data);
}

export function resetLocalStudentCuratedResourcesForTests() {
  localResources.clear();
}

function shouldUseLocalCuratedResources(session: AuthSession) {
  return session.isMock || !session.accessToken || !isSupabaseConfigured();
}

async function getLocalResources(session: AuthSession) {
  const key = await localResourceKey(session);
  const resources = localResources.get(key);
  if (resources) return resources;
  const seeded = seedCuratedResources();
  localResources.set(key, seeded);
  return seeded;
}

async function setLocalResources(session: AuthSession, resources: StudentCuratedResource[]) {
  localResources.set(await localResourceKey(session), resources);
}

async function localResourceKey(session: AuthSession) {
  return (await resolveMinistryScope(session)) ?? "local-ministry";
}

function seedCuratedResources(): StudentCuratedResource[] {
  const now = new Date("2026-07-11T00:00:00.000Z").toISOString();
  return [
    {
      id: "launch-curated-garden-trust",
      kind: "practice",
      journeyStage: "practice",
      title: "Walk the garden slowly",
      summary: "A short creation walk for questions about trust, choice, and the garden.",
      body: "Take a quiet walk. Notice created things before you try to solve the question. Then read Genesis 2-3 and ask what God gives before the command appears.",
      scriptureReferences: ["Genesis 2", "Genesis 3"],
      themes: ["garden", "creation", "trust", "choice"],
      questionPatterns: ["tree", "eden", "evil", "choice", "garden"],
      practicePrompt: "Name three gifts in creation before naming the problem you are trying to solve.",
      href: "/student/scripture/resources",
      sortOrder: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "launch-curated-lament-prayer",
      kind: "prayer",
      journeyStage: "reflect",
      title: "Pray without rushing grief",
      summary: "A guided lament rhythm for suffering, anxiety, and unanswered questions.",
      body: "Read Psalm 13 slowly. Let the questions stay honest, then name one thing you can still ask God to hold with you.",
      scriptureReferences: ["Psalm 13", "Romans 8:18"],
      themes: ["lament", "suffering", "anxiety", "hope"],
      questionPatterns: ["pain", "suffering", "anxiety", "grief", "pointless"],
      practicePrompt: "Breathe, tell God the truth in one sentence, then sit quietly for one minute before writing anything else.",
      href: "/student/scripture/resources",
      sortOrder: 20,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "launch-curated-context-tool",
      kind: "reading_tool",
      journeyStage: "read",
      title: "Read around the question",
      summary: "A context tool for any passage that feels confusing or too familiar.",
      body: "Read the paragraph before and after the passage. Write one sentence about what is happening before you decide what it means for you.",
      scriptureReferences: [],
      themes: ["context", "reading", "questions", "study"],
      questionPatterns: ["what does", "why did", "confusing", "mean"],
      practicePrompt: "Start with what the passage says, then what it reveals, then what response it invites.",
      href: "/student/scripture/how-to-read",
      sortOrder: 30,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function normalizeCuratedResourceInput(input: UpsertStudentCuratedResourceInput) {
  return {
    kind: normalizeKind(input.kind),
    journeyStage: normalizeStage(input.journeyStage),
    title: requiredText(input.title, "Title", 120),
    summary: requiredText(input.summary, "Short summary", 260),
    body: requiredText(input.body, "Full details", 1400),
    scriptureReferences: normalizeList(input.scriptureReferences).slice(0, 10),
    themes: normalizeList(input.themes).slice(0, 14),
    questionPatterns: normalizeList(input.questionPatterns).slice(0, 14),
    practicePrompt: optionalText(input.practicePrompt, 360),
    href: optionalText(input.href, 500),
    sortOrder: normalizeSortOrder(input.sortOrder),
    isActive: normalizeBoolean(input.isActive)
  };
}

function normalizeKind(value: string | undefined): StudentCuratedResourceKind {
  const kind = (value ?? "guide").trim() as StudentCuratedResourceKind;
  if (studentCuratedResourceKinds.includes(kind)) return kind;
  throw new StudentCuratedResourceError("Resource type is not supported.", 400, "invalid_kind");
}

function normalizeStage(value: string | undefined): StudentCuratedResourceStage {
  const stage = (value ?? "read").trim() as StudentCuratedResourceStage;
  if (studentCuratedResourceStages.includes(stage)) return stage;
  throw new StudentCuratedResourceError("Journey phase is not supported.", 400, "invalid_stage");
}

function requiredText(value: string | undefined, label: string, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new StudentCuratedResourceError(`${label} is required.`, 400, "missing_required_text");
  if (normalized.length > maxLength) throw new StudentCuratedResourceError(`${label} must be ${maxLength} characters or fewer.`, 400, "text_too_long");
  return normalized;
}

function optionalText(value: string | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new StudentCuratedResourceError(`Text must be ${maxLength} characters or fewer.`, 400, "text_too_long");
  return normalized;
}

function normalizeList(value: string[] | string | undefined) {
  const items = Array.isArray(value) ? value : (value ?? "").split(/[,\n]/g);
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeSortOrder(value: number | string | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 999));
}

function normalizeBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on";
  return true;
}

function filterAndSortResources(resources: StudentCuratedResource[], includeInactive = false) {
  return resources
    .filter((resource) => includeInactive || resource.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt));
}

function toCuratedResource(row: StudentCuratedResourceRow): StudentCuratedResource {
  return {
    id: row.id,
    kind: row.kind,
    journeyStage: row.journey_stage ?? "read",
    title: row.title,
    summary: row.summary,
    body: row.body,
    scriptureReferences: row.scripture_references ?? [],
    themes: row.themes ?? [],
    questionPatterns: row.question_patterns ?? [],
    practicePrompt: row.practice_prompt ?? "",
    href: row.href ?? "",
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ministryScopeColumns(ministryId: string | undefined) {
  return ministryId ? { ministry_id: ministryId } : {};
}

function assertCuratedResourceLeader(session: AuthSession) {
  if (!LEADER_ROLES.has((session.user.role ?? "").trim().toLowerCase())) {
    throw new StudentCuratedResourceError("Only leaders can manage student resources.", 403, "not_allowed");
  }
}

function throwIfResourceError(error: { message?: string } | null | undefined, fallback: string): asserts error is null | undefined {
  if (error) throw new StudentCuratedResourceError(error.message || fallback, 500, "storage_error");
}
