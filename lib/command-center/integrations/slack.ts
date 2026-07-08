// Slack webhook push for the Personal Command Center. Unlike Calendar,
// Gmail, and Google Drive, Slack incoming webhooks have no OAuth consent
// flow — there is nothing to "connect" beyond the webhook URL itself being
// present in the server environment. Mirrors the same graceful-degradation
// pattern anyway: every function throws SlackConfigError instead of
// attempting a network call when COMMAND_CENTER_SLACK_WEBHOOK_URL is
// missing.
//
// This module only ever sends a message when explicitly called by an
// Andrew-triggered request (the manual test-send route, or the manual
// send-daily-briefing route). There is still no scheduled/automatic send
// path anywhere in the codebase — an actually automatic daily push is a
// distinct, separately approved change, per the "must never be automatic"
// rule in docs/architecture/command-center-integrations.md.

import type { CommandCenterOverview, PersonalDomain } from "@/lib/command-center/types";

type SlackEnv = Record<string, string | undefined>;

const DOMAIN_LABELS: Record<PersonalDomain, string> = {
  military_transition: "Military Transition",
  sotf_fellowship: "SOTF Fellowship",
  job_search: "Job Search",
  life: "Life"
};

const DOMAIN_ORDER: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

export type SlackConfig = {
  configured: boolean;
  webhookUrl?: string;
  missing: string[];
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readSlackConfig(env: SlackEnv = process.env): SlackConfig {
  const webhookUrl = cleanEnv(env.COMMAND_CENTER_SLACK_WEBHOOK_URL);
  const missing = webhookUrl ? [] : ["COMMAND_CENTER_SLACK_WEBHOOK_URL"];
  return { configured: missing.length === 0, webhookUrl, missing };
}

export class SlackConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Slack integration is not configured.");
    this.name = "SlackConfigError";
    this.missing = missing;
  }
}

// Posts a single message to the configured incoming webhook. There is no
// corresponding "read" function — this integration is write-only (push),
// matching the priority doc's "Slack webhook push" description.
export async function sendSlackMessage(params: { text: string; env?: SlackEnv; fetchImpl?: typeof fetch }): Promise<void> {
  const config = readSlackConfig(params.env);
  if (!config.configured || !config.webhookUrl) {
    throw new SlackConfigError(config.missing);
  }
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: params.text })
  });
  if (!response.ok) throw new Error(`Slack webhook post failed: ${response.status}`);
}

// Pure formatting — no network call, easy to unit test independent of the
// webhook itself. Composes a plain-text (Slack mrkdwn) summary from the
// same CommandCenterOverview the dashboard already renders, plus whatever
// live Calendar/Gmail context SAGE chat would also see for this moment
// (see lib/command-center/sage-live-context.ts). Andrew triggers this by
// clicking "Send daily briefing" — there is no scheduled caller.
export function formatDailyBriefingMessage(params: {
  overview: CommandCenterOverview;
  liveIntegrationContext?: string;
}): string {
  const { overview } = params;
  const lines: string[] = ["*SAGE Daily Briefing*", ""];

  if (overview.todayPriority) {
    const due = overview.todayPriority.dueDate ? `, due ${overview.todayPriority.dueDate}` : "";
    lines.push(`Today's priority: *${overview.todayPriority.title}* (${DOMAIN_LABELS[overview.todayPriority.domain]}${due})`);
  } else {
    lines.push("Today's priority: no open tasks.");
  }
  lines.push("");

  lines.push("Open tasks by domain:");
  for (const domain of DOMAIN_ORDER) {
    lines.push(`- ${DOMAIN_LABELS[domain]}: ${overview.tasksByDomain[domain].open} open`);
  }

  if (overview.jobFollowUpsDueCount > 0) {
    lines.push("");
    lines.push(`Job follow-ups due: ${overview.jobFollowUpsDueCount}`);
  }
  if (overview.unprocessedCaptureCount > 0) {
    lines.push(`Unprocessed quick captures: ${overview.unprocessedCaptureCount}`);
  }

  if (params.liveIntegrationContext) {
    lines.push("");
    lines.push(params.liveIntegrationContext);
  }

  return lines.join("\n");
}
