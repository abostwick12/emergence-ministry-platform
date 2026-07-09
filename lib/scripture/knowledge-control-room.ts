import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";

export const knowledgeSourceKinds = ["own_voice", "scholar_reference", "app_resource", "curated_note"] as const;
export const knowledgeHemispheres = ["own_voice", "scholar", "platform"] as const;
export const knowledgeVisibilities = ["student_visible", "leader_only", "private_review", "scholar_citation_only"] as const;

export type KnowledgeSourceKind = (typeof knowledgeSourceKinds)[number];
export type KnowledgeHemisphere = (typeof knowledgeHemispheres)[number];
export type KnowledgeVisibility = (typeof knowledgeVisibilities)[number];

export type KnowledgeSourceChunkPreview = {
  id: string;
  title: string;
  body: string;
  studentSummary: string;
  topicTags: string[];
  concepts: string[];
  scriptureReferences: string[];
  visibility: KnowledgeVisibility;
  chunkIndex: number;
};

export type KnowledgeSourceControlItem = {
  id: string;
  title: string;
  sourceKind: KnowledgeSourceKind;
  hemisphere: KnowledgeHemisphere;
  visibility: KnowledgeVisibility;
  sourceUri: string;
  citation: string;
  summary: string;
  tags: string[];
  chunkCount: number;
  chunks: KnowledgeSourceChunkPreview[];
  updatedAt: string;
  createdAt: string;
};

export type KnowledgeControlRoomState = {
  readiness: {
    liveStorage: boolean;
    message: string;
  };
  sources: KnowledgeSourceControlItem[];
  stats: {
    totalSources: number;
    reviewSources: number;
    studentVisibleSources: number;
    chunkCount: number;
  };
};

export type CreateKnowledgeSourceInput = {
  title: string;
  sourceKind: string;
  hemisphere: string;
  sourceUri?: string;
  citation?: string;
  summary?: string;
  tags?: string[] | string;
  scriptureReferences?: string[] | string;
  content: string;
};

export type UpdateKnowledgeSourceDetailsInput = {
  title: string;
  summary: string;
  tags?: string[] | string;
  scriptureReferences?: string[] | string;
  citation?: string;
  sourceUri?: string;
};

type KnowledgeSourceRow = {
  id: string;
  title: string;
  source_kind: KnowledgeSourceKind;
  hemisphere: KnowledgeHemisphere;
  visibility: KnowledgeVisibility;
  source_uri: string | null;
  citation: string | null;
  summary: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeChunkRow = {
  id: string;
  source_id: string;
  chunk_index: number;
  title: string;
  body: string;
  student_summary: string | null;
  topic_tags: string[] | null;
  concepts: string[] | null;
  scripture_references: string[] | null;
  visibility: KnowledgeVisibility;
  created_at: string;
  updated_at: string;
};

const MAX_TITLE_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 800;
const MAX_CONTENT_LENGTH = 24000;
const MAX_CHUNKS = 8;
const MAX_CHUNK_BODY_LENGTH = 3400;
const LEADER_ROLES = new Set(["admin", "leader", "staff"]);

export async function getKnowledgeControlRoomState(session: AuthSession): Promise<KnowledgeControlRoomState> {
  if (!isLiveKnowledgeStorageReady(session)) {
    return emptyKnowledgeState("Knowledge source control requires Supabase Auth and database configuration.");
  }

  assertKnowledgeLeader(session);
  const supabase = getSupabaseAuthClient(session.accessToken);
  const sourceResult = await supabase
    .from("knowledge_sources")
    .select("id,title,source_kind,hemisphere,visibility,source_uri,citation,summary,tags,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(30)
    .returns<KnowledgeSourceRow[]>();

  throwIfSupabaseError(sourceResult.error);
  const sources = sourceResult.data ?? [];
  const sourceIds = sources.map((source) => source.id);
  const chunkRows = sourceIds.length ? await getChunksForSources(session, sourceIds) : [];
  return toControlRoomState(sources, chunkRows);
}

export async function createKnowledgeSource(session: AuthSession, input: CreateKnowledgeSourceInput): Promise<KnowledgeSourceControlItem> {
  if (!isLiveKnowledgeStorageReady(session)) {
    throw new KnowledgeControlRoomError("Knowledge source control requires Supabase Auth and database configuration.", 503, "live_storage_not_configured");
  }

  assertKnowledgeLeader(session);
  const title = normalizeRequiredText(input.title, "Title", MAX_TITLE_LENGTH);
  const sourceKind = normalizeEnum(input.sourceKind, knowledgeSourceKinds, "Source type");
  const hemisphere = normalizeEnum(input.hemisphere, knowledgeHemispheres, "Hemisphere");
  const content = normalizeRequiredText(input.content, "Source content", MAX_CONTENT_LENGTH);
  const tags = normalizeList(input.tags).slice(0, 12);
  const scriptureReferences = normalizeList(input.scriptureReferences).slice(0, 12);
  const summary = normalizeOptionalText(input.summary, MAX_SUMMARY_LENGTH) || summarizeText(content, MAX_SUMMARY_LENGTH);
  const ministryId = await resolveMinistryScope(session);
  const sourceRow = {
    ...ministryScopeColumns(ministryId),
    title,
    source_kind: sourceKind,
    hemisphere,
    visibility: "private_review" as KnowledgeVisibility,
    source_uri: normalizeOptionalText(input.sourceUri, 500) || null,
    citation: normalizeOptionalText(input.citation, 500) || null,
    summary,
    tags,
    created_by_user_id: session.user.id
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const sourceResult = await supabase.from("knowledge_sources").insert(sourceRow).select("*").single<KnowledgeSourceRow>();
  throwIfSupabaseError(sourceResult.error);
  if (!sourceResult.data) throw new KnowledgeControlRoomError("The knowledge source was not saved.", 500, "missing_saved_source");

  const chunkInputs = buildKnowledgeChunks({
    sourceId: sourceResult.data.id,
    sourceTitle: title,
    body: content,
    tags,
    scriptureReferences,
    summary,
    ministryId
  });
  const chunkResult = await supabase.from("knowledge_chunks").insert(chunkInputs).select("*").returns<KnowledgeChunkRow[]>();
  throwIfSupabaseError(chunkResult.error);

  return toControlItem(sourceResult.data, chunkResult.data ?? []);
}

export async function updateKnowledgeSourceVisibility(
  session: AuthSession,
  sourceId: string,
  visibility: string
): Promise<KnowledgeSourceControlItem> {
  if (!isLiveKnowledgeStorageReady(session)) {
    throw new KnowledgeControlRoomError("Knowledge source control requires Supabase Auth and database configuration.", 503, "live_storage_not_configured");
  }

  assertKnowledgeLeader(session);
  const nextVisibility = normalizeEnum(visibility, knowledgeVisibilities, "Visibility");
  const supabase = getSupabaseAuthClient(session.accessToken);

  const sourceResult = await supabase
    .from("knowledge_sources")
    .update({ visibility: nextVisibility })
    .eq("id", sourceId)
    .select("*")
    .single<KnowledgeSourceRow>();
  throwIfSupabaseError(sourceResult.error);
  if (!sourceResult.data) throw new KnowledgeControlRoomError("Knowledge source not found.", 404, "not_found");

  const chunkResult = await supabase
    .from("knowledge_chunks")
    .update({ visibility: nextVisibility })
    .eq("source_id", sourceId)
    .select("*")
    .returns<KnowledgeChunkRow[]>();
  throwIfSupabaseError(chunkResult.error);

  return toControlItem(sourceResult.data, chunkResult.data ?? []);
}

export async function updateKnowledgeSourceDetails(
  session: AuthSession,
  sourceId: string,
  input: UpdateKnowledgeSourceDetailsInput
): Promise<KnowledgeSourceControlItem> {
  if (!isLiveKnowledgeStorageReady(session)) {
    throw new KnowledgeControlRoomError("Knowledge source control requires Supabase Auth and database configuration.", 503, "live_storage_not_configured");
  }

  assertKnowledgeLeader(session);
  const title = normalizeRequiredText(input.title, "Title", MAX_TITLE_LENGTH);
  const summary = normalizeRequiredText(input.summary, "Student-safe summary", MAX_SUMMARY_LENGTH);
  const tags = normalizeList(input.tags).slice(0, 12);
  const scriptureReferences = normalizeList(input.scriptureReferences).slice(0, 12);
  const sourceUri = normalizeOptionalText(input.sourceUri, 500) || null;
  const citation = normalizeOptionalText(input.citation, 500) || null;
  const supabase = getSupabaseAuthClient(session.accessToken);

  const sourceResult = await supabase
    .from("knowledge_sources")
    .update({
      title,
      summary,
      tags,
      source_uri: sourceUri,
      citation
    })
    .eq("id", sourceId)
    .select("*")
    .single<KnowledgeSourceRow>();
  throwIfSupabaseError(sourceResult.error);
  if (!sourceResult.data) throw new KnowledgeControlRoomError("Knowledge source not found.", 404, "not_found");

  const chunkResult = await supabase
    .from("knowledge_chunks")
    .update({
      title,
      student_summary: summarizeText(summary, 420),
      topic_tags: tags,
      concepts: tags.map(toConceptSlug).filter(Boolean).slice(0, 12),
      scripture_references: scriptureReferences
    })
    .eq("source_id", sourceId)
    .select("*")
    .returns<KnowledgeChunkRow[]>();
  throwIfSupabaseError(chunkResult.error);

  return toControlItem(sourceResult.data, chunkResult.data ?? []);
}

function isLiveKnowledgeStorageReady(session: AuthSession) {
  return !session.isMock && Boolean(session.accessToken) && isSupabaseConfigured();
}

async function getChunksForSources(session: AuthSession, sourceIds: string[]) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("knowledge_chunks")
    .select("id,source_id,chunk_index,title,body,student_summary,topic_tags,concepts,scripture_references,visibility,created_at,updated_at")
    .in("source_id", sourceIds)
    .order("chunk_index", { ascending: true })
    .returns<KnowledgeChunkRow[]>();
  throwIfSupabaseError(result.error);
  return result.data ?? [];
}

function toControlRoomState(sourceRows: KnowledgeSourceRow[], chunkRows: KnowledgeChunkRow[]): KnowledgeControlRoomState {
  const chunksBySource = new Map<string, KnowledgeChunkRow[]>();
  for (const chunk of chunkRows) {
    const chunks = chunksBySource.get(chunk.source_id) ?? [];
    chunks.push(chunk);
    chunksBySource.set(chunk.source_id, chunks);
  }

  const sources = sourceRows.map((source) => toControlItem(source, chunksBySource.get(source.id) ?? []));
  return {
    readiness: {
      liveStorage: true,
      message: "Knowledge source control is connected to live storage."
    },
    sources,
    stats: {
      totalSources: sources.length,
      reviewSources: sources.filter((source) => source.visibility === "private_review").length,
      studentVisibleSources: sources.filter((source) => source.visibility === "student_visible").length,
      chunkCount: sources.reduce((total, source) => total + source.chunkCount, 0)
    }
  };
}

function toControlItem(source: KnowledgeSourceRow, chunks: KnowledgeChunkRow[]): KnowledgeSourceControlItem {
  return {
    id: source.id,
    title: source.title,
    sourceKind: source.source_kind,
    hemisphere: source.hemisphere,
    visibility: source.visibility,
    sourceUri: source.source_uri ?? "",
    citation: source.citation ?? "",
    summary: source.summary,
    tags: normalizeList(source.tags),
    chunkCount: chunks.length,
    chunks: chunks.map(toChunkPreview),
    createdAt: source.created_at,
    updatedAt: source.updated_at
  };
}

function toChunkPreview(chunk: KnowledgeChunkRow): KnowledgeSourceChunkPreview {
  return {
    id: chunk.id,
    title: chunk.title,
    body: chunk.body,
    studentSummary: chunk.student_summary ?? "",
    topicTags: normalizeList(chunk.topic_tags),
    concepts: normalizeList(chunk.concepts),
    scriptureReferences: normalizeList(chunk.scripture_references),
    visibility: chunk.visibility,
    chunkIndex: chunk.chunk_index
  };
}

function buildKnowledgeChunks({
  sourceId,
  sourceTitle,
  body,
  tags,
  scriptureReferences,
  summary,
  ministryId
}: {
  sourceId: string;
  sourceTitle: string;
  body: string;
  tags: string[];
  scriptureReferences: string[];
  summary: string;
  ministryId?: string;
}) {
  const chunks = splitIntoChunks(body);
  return chunks.map((chunk, index) => ({
    ...ministryScopeColumns(ministryId),
    source_id: sourceId,
    chunk_index: index,
    title: chunks.length === 1 ? sourceTitle : `${sourceTitle} (${index + 1})`,
    body: chunk,
    student_summary: summarizeText(index === 0 ? summary || chunk : chunk, 420),
    topic_tags: tags,
    concepts: tags.map(toConceptSlug).filter(Boolean).slice(0, 12),
    scripture_references: scriptureReferences,
    visibility: "private_review" as KnowledgeVisibility
  }));
}

function splitIntoChunks(value: string) {
  const paragraphs = value
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [value.replace(/\s+/g, " ").trim()]) {
    if (current && `${current}\n\n${paragraph}`.length > MAX_CHUNK_BODY_LENGTH) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);

  return chunks.flatMap(splitOversizedChunk).slice(0, MAX_CHUNKS);
}

function splitOversizedChunk(value: string) {
  if (value.length <= MAX_CHUNK_BODY_LENGTH) return [value];
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += MAX_CHUNK_BODY_LENGTH) {
    chunks.push(value.slice(start, start + MAX_CHUNK_BODY_LENGTH).trim());
  }
  return chunks.filter(Boolean);
}

function assertKnowledgeLeader(session: AuthSession) {
  if (!LEADER_ROLES.has(session.user.role.trim().toLowerCase())) {
    throw new KnowledgeControlRoomError("Only leaders can manage knowledge sources.", 403, "forbidden");
  }
}

function emptyKnowledgeState(message: string): KnowledgeControlRoomState {
  return {
    readiness: {
      liveStorage: false,
      message
    },
    sources: [],
    stats: {
      totalSources: 0,
      reviewSources: 0,
      studentVisibleSources: 0,
      chunkCount: 0
    }
  };
}

function normalizeEnum<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
  if (allowed.includes(value)) return value as T[number];
  throw new KnowledgeControlRoomError(`${label} is not valid.`, 400, "invalid_enum");
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.normalize("NFKC").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) throw new KnowledgeControlRoomError(`${label} is required.`, 400, "required");
  if (normalized.length > maxLength) throw new KnowledgeControlRoomError(`${label} is too long.`, 400, "too_long");
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (!value) return "";
  const normalized = value.normalize("NFKC").replace(/[ \t]+/g, " ").trim();
  if (normalized.length > maxLength) throw new KnowledgeControlRoomError("One field is too long.", 400, "too_long");
  return normalized;
}

function normalizeList(value: string[] | string | null | undefined) {
  const items = Array.isArray(value) ? value : (value ?? "").split(/[\n,]/);
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 20);
}

function summarizeText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function toConceptSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ministryScopeColumns(ministryId: string | undefined): { ministry_id?: string } {
  return ministryId ? { ministry_id: ministryId } : {};
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new KnowledgeControlRoomError(error.message, 500, "supabase_error");
  }
}

export class KnowledgeControlRoomError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
