import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { getMinistryIntelligenceData } from "@/lib/daily-intelligence/source";
import { buildLeaderDailyBriefEvidence } from "@/lib/leader-daily-brief/operations";
import type { LeaderDailyBrief, LeaderDailyBriefEvidence } from "@/lib/leader-daily-brief/types";

type ResourceAttachmentSummaryRow = {
  id: string;
  parent_type: string;
  parent_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  external_url: string | null;
  created_at: string;
};

type VolunteerHubItemSummaryRow = {
  id: string;
  item_key: string;
  title: string;
  detail: string | null;
  category: string | null;
  item_type: string;
  updated_at: string | null;
  created_at: string;
};

type ActivityLogRow = {
  id: string;
  action: string;
  created_at: string;
};

export type LeaderDailyBriefCollectionStage = "collect_context" | "collect_events" | "collect_sermon_prep" | "collect_resources";

export async function loadLeaderDailyBriefEvidence(
  now = new Date(),
  onStage?: (stage: LeaderDailyBriefCollectionStage) => void
): Promise<LeaderDailyBriefEvidence> {
  onStage?.("collect_context");
  const data = await getMinistryIntelligenceData();
  onStage?.("collect_events");
  onStage?.("collect_sermon_prep");
  onStage?.("collect_resources");
  const [eventFileHints, publishedSermonResources, volunteerSignals] = await Promise.all([
    loadEventFileHints(data.ministryId),
    loadPublishedSermonResources(data.ministryId),
    loadVolunteerSignals(data.ministryId)
  ]);
  return buildLeaderDailyBriefEvidence({ data, now, eventFileHints, publishedSermonResources, volunteerSignals });
}

export async function hasPostedLeaderDailyBrief(params: { ministryId?: string; contentDate: string; messageHash?: string }) {
  if (!isSupabaseAdminConfigured()) return { status: "unavailable" as const, duplicate: false };
  try {
    let query = getSupabaseAdminClient()
      .from("activity_logs")
      .select("id,action,created_at")
      .ilike("action", `Leader Daily Brief posted for ${params.contentDate}%`)
      .order("created_at", { ascending: false })
      .limit(5);
    if (params.ministryId) query = query.eq("ministry_id", params.ministryId);
    const result = await query.returns<ActivityLogRow[]>();
    if (result.error) return { status: "unavailable" as const, duplicate: false };
    const rows = result.data ?? [];
    const duplicate = rows.some((row) => !params.messageHash || row.action.includes(`hash ${params.messageHash}`));
    return { status: duplicate ? "duplicate_found" as const : "clear" as const, duplicate, rows };
  } catch {
    return { status: "unavailable" as const, duplicate: false };
  }
}

export async function recordLeaderDailyBriefPosted(brief: LeaderDailyBrief, groupMe: { success: boolean; messageId?: string; groupId?: string }) {
  if (!isSupabaseAdminConfigured() || !brief.evidence.ministryId) return { status: "unavailable" as const };
  try {
    const action = [
      `Leader Daily Brief posted for ${brief.evidence.contentDate}`,
      `hash ${brief.messageHash}`,
      `groupMe ${groupMe.success ? "success" : "failure"}`,
      groupMe.messageId ? `message ${groupMe.messageId}` : "message unavailable",
      brief.sermonId ? `sermon ${brief.sermonId}` : "sermon unpublished",
      `events ${brief.eventIdsConsulted.join(",") || "none"}`,
      `firecrawl ${brief.firecrawl.used ? "used" : "skipped"}`
    ].join("; ");
    const result = await getSupabaseAdminClient().from("activity_logs").insert({
      ministry_id: brief.evidence.ministryId,
      action,
      actor_id: null
    });
    if (result.error) return { status: "unavailable" as const };
    return { status: "recorded" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}

async function loadEventFileHints(ministryId?: string): Promise<LeaderDailyBriefEvidence["eventFileHints"]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    let query = getSupabaseAdminClient()
      .from("resource_attachments")
      .select("id,parent_type,parent_id,title,description,resource_type,external_url,created_at")
      .eq("parent_type", "event")
      .is("archived_at", null)
      .in("visibility", ["volunteer_leaders", "assigned_leaders", "authenticated", "public", "inherit_parent"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (ministryId) query = query.eq("organization_id", ministryId);
    const { data, error } = await query.returns<ResourceAttachmentSummaryRow[]>();
    if (error) return [];
    return (data ?? []).map((row) => ({
      eventId: row.parent_id,
      eventTitle: "Event",
      title: row.title,
      resourceType: row.resource_type
    }));
  } catch {
    return [];
  }
}

async function loadPublishedSermonResources(ministryId?: string): Promise<LeaderDailyBriefEvidence["publishedSermonResources"]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const [attachments, volunteerItems] = await Promise.all([
      loadSermonResourceAttachments(ministryId),
      loadVolunteerHubSermonItems(ministryId)
    ]);
    return [...attachments, ...volunteerItems].slice(0, 8);
  } catch {
    return [];
  }
}

async function loadSermonResourceAttachments(ministryId?: string) {
  let query = getSupabaseAdminClient()
    .from("resource_attachments")
    .select("id,parent_type,parent_id,title,description,resource_type,external_url,created_at")
    .in("parent_type", ["weekly_leader_prep", "sermon"])
    .is("archived_at", null)
    .in("visibility", ["volunteer_leaders", "assigned_leaders", "authenticated", "public", "inherit_parent"])
    .order("created_at", { ascending: false })
    .limit(8);
  if (ministryId) query = query.eq("organization_id", ministryId);
  const { data, error } = await query.returns<ResourceAttachmentSummaryRow[]>();
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    source: "resource_attachment" as const,
    url: row.external_url ?? undefined
  }));
}

async function loadVolunteerHubSermonItems(ministryId?: string) {
  let query = getSupabaseAdminClient()
    .from("volunteer_hub_items")
    .select("id,item_key,title,detail,category,item_type,updated_at,created_at")
    .eq("item_type", "resource")
    .is("archived_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(8);
  if (ministryId) query = query.eq("ministry_id", ministryId);
  const { data, error } = await query.returns<VolunteerHubItemSummaryRow[]>();
  if (error) return [];
  return (data ?? [])
    .filter((row) => /sermon|leader|guide|discussion|question|slide|message/i.test(`${row.title} ${row.detail ?? ""} ${row.category ?? ""}`))
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.detail ?? "",
      source: "volunteer_hub_item" as const
    }));
}

async function loadVolunteerSignals(ministryId?: string) {
  if (!isSupabaseAdminConfigured()) return undefined;
  try {
    let followUpQuery = getSupabaseAdminClient()
      .from("volunteer_hub_follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned");
    let groupQuery = getSupabaseAdminClient()
      .from("volunteer_hub_small_groups")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null);
    if (ministryId) {
      followUpQuery = followUpQuery.eq("ministry_id", ministryId);
      groupQuery = groupQuery.eq("ministry_id", ministryId);
    }
    const [followUps, groups] = await Promise.all([followUpQuery, groupQuery]);
    if (followUps.error && groups.error) return undefined;
    return {
      followUpVisible: (followUps.count ?? 0) > 0,
      quietStudentCareUseful: true,
      source: `${groups.count ?? 0} active small-group record${groups.count === 1 ? "" : "s"} and ${followUps.count ?? 0} assigned follow-up signal${followUps.count === 1 ? "" : "s"} consulted.`
    };
  } catch {
    return undefined;
  }
}
