// Manual-trigger entry point for the SAGE Weekly Intelligence Feed. Only
// ever called from POST /api/command-center/feed/weekly/generate (Andrew
// clicking "Generate Feed Now") -- there is no scheduled job anywhere that
// calls this.

import { z } from "zod";
import type { AuthSession } from "@/lib/auth/server";
import {
  completeFeedRunLog,
  createFeedRunLog,
  createWeeklyFeed,
  getLatestWeeklyFeedWithItems,
  replaceWeeklyFeedItems
} from "@/lib/command-center/repository";
import { callSageStructured } from "@/lib/command-center/sage";
import { analyzeSources } from "@/lib/command-center/weekly-feed/analyze";
import { FeedSourceDriveUnavailableError, FeedSourceFolderNotFoundError, ingestFeedSources } from "@/lib/command-center/weekly-feed/ingest";
import type { KnowledgeItem, WeeklyFeed, WeeklyFeedItemWithDetail } from "@/lib/command-center/types";

class WeeklyFeedNotPersistedError extends Error {
  constructor() {
    super("Weekly feed was created but could not be re-read.");
    this.name = "WeeklyFeedNotPersistedError";
  }
}

export { FeedSourceDriveUnavailableError, FeedSourceFolderNotFoundError };

const FEED_SECTIONS = ["top5", "articles", "podcasts", "videos", "linkedin", "reports"] as const;

const ASSEMBLY_INSTRUCTIONS = `You are SAGE, assembling this week's Personal Command Center Weekly Intelligence Feed from a list of already-analyzed research items.

Andrew's priorities, in rough order: youth ministry leadership, student discipleship, student mental health and pastoral boundaries, AI ministry operations, student career readiness, volunteer development, communication systems, student leadership, theological/exegetical insight, Emerge platform development.

You are given a numbered list of items, each with its source type, title, summary, topic tags, and a relevance score already assigned. Do not simply summarize everything -- decide what matters most this week and explain why. Pick the 5 most important items overall for the "top5" section (ranked 1-5), and group the remaining useful items into their source-type section (articles/podcasts/videos/linkedin/reports). An item can appear in both top5 and its type section. Items that aren't worth surfacing can be omitted entirely.

Respond with ONLY a single valid JSON object -- no markdown fences, no commentary -- matching this shape exactly:
{
  "title": string (e.g. "Week of <date> Intelligence Feed"),
  "executiveSummary": string,
  "topTopics": string[],
  "appPlatformImplications": string,
  "ministryImplications": string,
  "suggestedActionItems": string,
  "items": [
    { "index": number (matches the input list), "section": "top5" | "articles" | "podcasts" | "videos" | "linkedin" | "reports", "rank": number, "reasonIncluded": string, "recommendedAction": string, "confidenceNote": string }
  ]
}`;

const assemblySchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  topTopics: z.array(z.string()).default([]),
  appPlatformImplications: z.string().default(""),
  ministryImplications: z.string().default(""),
  suggestedActionItems: z.string().default(""),
  items: z.array(
    z.object({
      index: z.number().int(),
      section: z.enum(FEED_SECTIONS),
      rank: z.number().int(),
      reasonIncluded: z.string().default(""),
      recommendedAction: z.string().default(""),
      confidenceNote: z.string().default("")
    })
  )
});

function getWeekRange(date: Date): { weekStart: string; weekEnd: string } {
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { weekStart: monday.toISOString().slice(0, 10), weekEnd: sunday.toISOString().slice(0, 10) };
}

function buildAssemblyInput(items: KnowledgeItem[]): string {
  return items
    .map(
      (item, index) =>
        `[${index}] relevanceScore=${item.relevanceScore ?? 0} topics=${item.topicTags.join(", ")}\nsummary: ${item.summary}\nministryApplication: ${item.ministryApplication ?? ""}\ncommandCenterApplication: ${item.commandCenterApplication ?? ""}`
    )
    .join("\n\n");
}

export type GenerateWeeklyFeedResult = {
  feed: WeeklyFeed;
  items: WeeklyFeedItemWithDetail[];
  warnings: string[];
};

export async function generateWeeklyFeed(session: AuthSession): Promise<GenerateWeeklyFeedResult> {
  const startedAt = Date.now();
  const runLog = await createFeedRunLog(session, "manual");
  const { weekStart, weekEnd } = getWeekRange(new Date());
  const warnings: string[] = [];

  try {
    const ingestResult = await ingestFeedSources(session);
    warnings.push(...ingestResult.errors);

    const { items: knowledgeItems, failures } = await analyzeSources(session, ingestResult.changedSources);
    warnings.push(...failures);

    if (knowledgeItems.length === 0) {
      const feed = await createWeeklyFeed(session, {
        weekStart,
        weekEnd,
        title: `Week of ${weekStart}`,
        executiveSummary: "No new feed sources were found this week.",
        topTopics: [],
        createdBy: "manual"
      });
      await replaceWeeklyFeedItems(session, feed.id, []);
      await completeFeedRunLog(session, runLog.id, {
        status: "succeeded",
        filesScanned: ingestResult.filesScanned,
        filesImported: ingestResult.filesImported,
        filesSkipped: ingestResult.filesSkipped,
        errorsCount: warnings.length,
        errorDetails: warnings,
        durationMs: Date.now() - startedAt
      });
      return { feed, items: [], warnings };
    }

    const assembly = await callSageStructured({
      instructions: ASSEMBLY_INSTRUCTIONS,
      input: buildAssemblyInput(knowledgeItems),
      schema: assemblySchema
    });

    if (!assembly.ok) {
      warnings.push(`Could not assemble the weekly feed: ${assembly.message}`);
      const feed = await createWeeklyFeed(session, {
        weekStart,
        weekEnd,
        title: `Week of ${weekStart}`,
        executiveSummary: "SAGE analyzed this week's sources but could not assemble the feed. See warnings for details.",
        topTopics: [],
        createdBy: "manual"
      });
      await replaceWeeklyFeedItems(session, feed.id, []);
      await completeFeedRunLog(session, runLog.id, {
        status: "failed",
        filesScanned: ingestResult.filesScanned,
        filesImported: ingestResult.filesImported,
        filesSkipped: ingestResult.filesSkipped,
        errorsCount: warnings.length,
        errorDetails: warnings,
        durationMs: Date.now() - startedAt
      });
      return { feed, items: [], warnings };
    }

    const feed = await createWeeklyFeed(session, {
      weekStart,
      weekEnd,
      title: assembly.data.title,
      executiveSummary: assembly.data.executiveSummary,
      topTopics: assembly.data.topTopics,
      appPlatformImplications: assembly.data.appPlatformImplications || undefined,
      ministryImplications: assembly.data.ministryImplications || undefined,
      suggestedActionItems: assembly.data.suggestedActionItems || undefined,
      createdBy: "manual"
    });

    const feedItemInputs = assembly.data.items.flatMap((item) => {
      const knowledgeItem = knowledgeItems[item.index];
      if (!knowledgeItem) return [];
      return [
        {
          weeklyFeedId: feed.id,
          knowledgeItemId: knowledgeItem.id,
          rank: item.rank,
          section: item.section,
          reasonIncluded: item.reasonIncluded || undefined,
          recommendedAction: item.recommendedAction || undefined,
          confidenceNote: item.confidenceNote || undefined
        }
      ];
    });
    await replaceWeeklyFeedItems(session, feed.id, feedItemInputs);

    await completeFeedRunLog(session, runLog.id, {
      status: "succeeded",
      filesScanned: ingestResult.filesScanned,
      filesImported: ingestResult.filesImported,
      filesSkipped: ingestResult.filesSkipped,
      errorsCount: warnings.length,
      errorDetails: warnings,
      durationMs: Date.now() - startedAt
    });

    const persisted = await getLatestWeeklyFeedWithItems(session);
    if (!persisted) throw new WeeklyFeedNotPersistedError();
    return { feed: persisted.feed, items: persisted.items, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error generating the weekly feed.";
    await completeFeedRunLog(session, runLog.id, {
      status: "failed",
      filesScanned: 0,
      filesImported: 0,
      filesSkipped: 0,
      errorsCount: warnings.length + 1,
      errorDetails: [...warnings, message],
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}
