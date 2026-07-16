import { formatBriefDate } from "@/lib/daily-intelligence/operations";
import type { DailyBriefItem, DailyBriefSectionKey, DailyIntelligenceBrief } from "@/lib/daily-intelligence/types";

const SECTION_LABELS: Record<DailyBriefSectionKey, string> = {
  needsAttentionToday: "🚨 Needs Attention Today",
  nextSevenDays: "📅 Next 7 Days",
  daysEightToFourteen: "📆 Days 8-14",
  communications: "💬 Communications",
  studentVolunteerCare: "👥 Student & Volunteer Care",
  decisionsNeeded: "🎯 Decisions Needed",
  recentProgress: "✅ Recent Progress",
  systemHealth: "⚙️ System Health"
};

const SECTION_ORDER: DailyBriefSectionKey[] = [
  "needsAttentionToday",
  "nextSevenDays",
  "daysEightToFourteen",
  "communications",
  "studentVolunteerCare",
  "decisionsNeeded",
  "recentProgress",
  "systemHealth"
];

type SlackEnv = Record<string, string | undefined>;

export class DailyBriefSlackConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Daily intelligence Slack integration is not configured.");
    this.name = "DailyBriefSlackConfigError";
    this.missing = missing;
  }
}

export function readDailyBriefSlackConfig(env: SlackEnv = process.env) {
  const webhookUrl = env.DAILY_BRIEFING_SLACK_WEBHOOK_URL?.trim();
  return { configured: Boolean(webhookUrl), webhookUrl, missing: webhookUrl ? [] : ["DAILY_BRIEFING_SLACK_WEBHOOK_URL"] };
}

export async function sendDailyBriefToSlack(params: { text: string; env?: SlackEnv; fetchImpl?: typeof fetch }) {
  const config = readDailyBriefSlackConfig(params.env);
  if (!config.configured || !config.webhookUrl) throw new DailyBriefSlackConfigError(config.missing);
  const response = await (params.fetchImpl ?? fetch)(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: params.text })
  });
  if (!response.ok) throw new Error(`Daily briefing Slack post failed: ${response.status}`);
}

export function formatDailyIntelligenceSlackMessage(brief: DailyIntelligenceBrief, env: SlackEnv = process.env): string {
  const lines: string[] = ["*Lead Emerge Daily Intelligence Brief*", `_Generated ${formatBriefDate(brief.generatedAt)}_`, ""];

  for (const section of SECTION_ORDER) {
    lines.push(`*${SECTION_LABELS[section]}*`);
    const items = brief.sections[section].slice(0, section === "recentProgress" ? 5 : 6);
    if (items.length === 0) {
      lines.push("_Nothing urgent surfaced._");
    } else {
      lines.push(...items.map((item) => formatItem(item, env)));
    }
    lines.push("");
  }

  lines.push(`*${brief.content.title}*`);
  lines.push(brief.content.focus);
  if (brief.content.items.length === 0) {
    lines.push("_No ministry insight queued for today._");
  } else {
    lines.push(...brief.content.items.slice(0, 4).map((item) => formatItem(item, env)));
  }

  if (brief.warnings.length > 0) {
    lines.push("", "*Warnings*");
    lines.push(...brief.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n");
}

function formatItem(item: DailyBriefItem, env: SlackEnv): string {
  const date = item.date ? ` (${formatBriefDate(item.date)})` : "";
  const action = item.action ? ` Action: ${item.action}` : "";
  const absoluteUrl = resolveRecordUrl(item.recordUrl, env);
  const link = absoluteUrl ? ` <${absoluteUrl}|Open record>` : item.recordUrl ? ` Open record: ${item.recordUrl}` : "";
  return `- *${item.title}*${date}: ${item.why}${action}${link}`;
}

function resolveRecordUrl(recordUrl: string | undefined, env: SlackEnv): string | undefined {
  if (!recordUrl) return undefined;
  if (/^https?:\/\//i.test(recordUrl)) return recordUrl;
  const base = env.DAILY_BRIEFING_APP_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  if (!base) return undefined;
  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;
  return `${normalizedBase.replace(/\/$/, "")}${recordUrl.startsWith("/") ? recordUrl : `/${recordUrl}`}`;
}
