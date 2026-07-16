import { isSupabaseAdminConfigured, getSupabaseAdminClient } from "@/lib/auth/server";
import type { ResearchResource, ResearchResourceType, WeeklyContentDay } from "@/lib/daily-intelligence/types";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

type FirecrawlEnv = Record<string, string | undefined>;

export class DailyIntelligenceFirecrawlConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Daily intelligence Firecrawl integration is not configured.");
    this.name = "DailyIntelligenceFirecrawlConfigError";
    this.missing = missing;
  }
}

export function readDailyIntelligenceFirecrawlConfig(env: FirecrawlEnv = process.env) {
  const apiKey = env.FIRECRAWL_API_KEY?.trim();
  return { configured: Boolean(apiKey), apiKey, missing: apiKey ? [] : ["FIRECRAWL_API_KEY"] };
}

const TOPICS: Array<{ day: WeeklyContentDay; query: string; topic: string }> = [
  { day: "monday", topic: "Leadership & Ministry Systems", query: "recent student ministry leadership volunteer systems parent partnership ministry operations" },
  { day: "tuesday", topic: "Quick Sunday Icebreakers", query: "youth ministry Sunday morning icebreaker game demonstration video minimal setup" },
  { day: "tuesday", topic: "Longer Event Game", query: "youth ministry event game demonstration video camp midweek high school middle school" },
  { day: "wednesday", topic: "Discipleship", query: "student ministry discipleship biblical literacy small groups spiritual formation teaching methods" },
  { day: "thursday", topic: "Student Culture", query: "teen culture technology social media school life identity parent communication pastoral awareness" },
  { day: "friday", topic: "Leadership Development", query: "youth ministry volunteer leadership student leaders worship leaders team development" }
];

const REJECT_DOMAINS = ["medium.com", "substack.com", "quora.com", "reddit.com"];
const TRUSTED_TERMS = ["ministry", "church", "youth", "student", "leader", "discipleship", "pastor", "worship", "group", "game"];

export type FirecrawlSearchHit = {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: { web?: FirecrawlSearchHit[] };
};

export async function runWeeklyResearchSweep(params: {
  ministryId?: string;
  weekStart: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<{ resources: ResearchResource[]; warnings: string[] }> {
  const warnings: string[] = [];
  const resources: ResearchResource[] = [];

  for (const topic of TOPICS) {
    try {
      const hits = await searchFirecrawl({ query: topic.query, fetchImpl: params.fetchImpl, env: params.env });
      resources.push(...rankSearchHits(hits, topic.day, topic.topic));
    } catch (error) {
      const message =
        error instanceof DailyIntelligenceFirecrawlConfigError
          ? `Firecrawl is not configured: ${error.missing.join(", ")}`
          : `Firecrawl search failed for ${topic.topic}.`;
      warnings.push(message);
    }
  }

  const curated = dedupeResources(resources)
    .filter((resource) => !resource.rejected)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  if (curated.length > 0) {
    await saveResearchQueueBestEffort({ ministryId: params.ministryId, weekStart: params.weekStart, resources: curated, warnings });
  }

  return { resources: curated, warnings };
}

export async function loadResearchQueueForDay(params: {
  ministryId?: string;
  weekStart: string;
  day: WeeklyContentDay;
}): Promise<ResearchResource[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("daily_intelligence_resource_queue")
      .select("id,day,topic,resource_type,title,url,source,summary,why_included,score")
      .eq("week_start", params.weekStart)
      .eq("day", params.day)
      .order("score", { ascending: false })
      .limit(5);
    if (params.ministryId) query = query.eq("ministry_id", params.ministryId);
    const { data, error } = await query.returns<
      Array<{
        id: string;
        day: WeeklyContentDay;
        topic: string;
        resource_type: ResearchResourceType;
        title: string;
        url: string;
        source: string;
        summary: string;
        why_included: string;
        score: number;
      }>
    >();
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      day: row.day,
      topic: row.topic,
      type: row.resource_type,
      title: row.title,
      url: row.url,
      source: row.source,
      summary: row.summary,
      whyIncluded: row.why_included,
      score: row.score
    }));
  } catch {
    return [];
  }
}

export async function searchFirecrawl(params: {
  query: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<FirecrawlSearchHit[]> {
  const config = readDailyIntelligenceFirecrawlConfig(params.env);
  if (!config.configured || !config.apiKey) throw new DailyIntelligenceFirecrawlConfigError(config.missing);
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(FIRECRAWL_SEARCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: params.query,
      limit: 6,
      sources: ["web"],
      country: "US",
      tbs: "qdr:m",
      scrapeOptions: { formats: ["markdown"] }
    })
  });
  if (!response.ok) throw new Error(`Firecrawl search failed: ${response.status}`);
  const json = (await response.json()) as FirecrawlSearchResponse;
  return json.data?.web ?? [];
}

export function rankSearchHits(hits: FirecrawlSearchHit[], day: WeeklyContentDay, topic: string): ResearchResource[] {
  return hits.flatMap((hit, index) => {
    if (!hit.url || !hit.title) return [];
    const source = host(hit.url);
    const description = stripMarkdown(hit.description || hit.markdown || "");
    const rejected = shouldReject(hit.url, hit.title, description);
    const type = inferType(hit.url, topic);
    return [
      {
        id: stableId(hit.url),
        day,
        topic,
        type,
        title: hit.title.trim(),
        url: hit.url,
        source,
        summary: description || "Review the source before using this resource.",
        whyIncluded: rejected.rejected ? "" : whyIncluded(type, topic, source),
        score: rejected.rejected ? 0 : scoreHit(hit, index, type),
        rejected: rejected.rejected,
        rejectionReason: rejected.reason
      }
    ];
  });
}

async function saveResearchQueueBestEffort(params: {
  ministryId?: string;
  weekStart: string;
  resources: ResearchResource[];
  warnings: string[];
}) {
  if (!isSupabaseAdminConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    let deleteQuery = supabase.from("daily_intelligence_resource_queue").delete().eq("week_start", params.weekStart);
    if (params.ministryId) deleteQuery = deleteQuery.eq("ministry_id", params.ministryId);
    await deleteQuery;
    await supabase.from("daily_intelligence_resource_queue").insert(
      params.resources.map((resource) => ({
        ministry_id: params.ministryId ?? null,
        week_start: params.weekStart,
        day: resource.day,
        topic: resource.topic,
        resource_type: resource.type,
        title: resource.title,
        url: resource.url,
        source: resource.source,
        summary: resource.summary,
        why_included: resource.whyIncluded,
        score: resource.score
      }))
    );
  } catch {
    params.warnings.push("Research queue could not be persisted; apply the daily intelligence migration before relying on weekly distribution.");
  }
}

function shouldReject(url: string, title: string, description: string): { rejected: boolean; reason?: string } {
  const lower = `${url} ${title} ${description}`.toLowerCase();
  const domain = host(url);
  if (REJECT_DOMAINS.some((blocked) => domain.endsWith(blocked))) return { rejected: true, reason: "Rejected low-control aggregation/social discussion source." };
  if (/ai[- ]generated|content farm|guaranteed growth|hack students|manipulat/i.test(lower)) return { rejected: true, reason: "Rejected unsafe or manipulative content." };
  if (/dangerous|humiliation|embarrass|choking|tackle/i.test(lower)) return { rejected: true, reason: "Rejected unsafe or embarrassing game pattern." };
  return { rejected: false };
}

function scoreHit(hit: FirecrawlSearchHit, index: number, type: ResearchResourceType): number {
  const text = `${hit.title ?? ""} ${hit.description ?? ""} ${hit.markdown ?? ""}`.toLowerCase();
  const relevance = TRUSTED_TERMS.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
  const typeBoost = type === "game" || type === "video" ? 2 : 0;
  return Math.max(1, 10 - index + relevance + typeBoost);
}

function inferType(url: string, topic: string): ResearchResourceType {
  const lower = `${url} ${topic}`.toLowerCase();
  if (/game|icebreaker/.test(lower)) return "game";
  if (/youtube|vimeo|video/.test(lower)) return "video";
  if (/podcast|spotify|apple\.com\/.*podcast/.test(lower)) return "podcast";
  if (/instagram|linkedin|x\.com|twitter|facebook|tiktok/.test(lower)) return "social";
  if (/download|resource|toolkit|curriculum/.test(lower)) return "ministry_resource";
  return "article";
}

function whyIncluded(type: ResearchResourceType, topic: string, source: string): string {
  return `${topic} resource from ${source}; type ${type.replace("_", " ")} fits this week's curated ministry learning rhythm.`;
}

function dedupeResources(resources: ResearchResource[]): ResearchResource[] {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    const key = resource.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown source";
  }
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return `res_${hash.toString(36)}`;
}

function stripMarkdown(value: string, maxLength = 280): string {
  const plain = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}...` : plain;
}
