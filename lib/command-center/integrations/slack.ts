// Slack webhook push for the Personal Command Center. Unlike Calendar,
// Gmail, and Google Drive, Slack incoming webhooks have no OAuth consent
// flow — there is nothing to "connect" beyond the webhook URL itself being
// present in the server environment. Mirrors the same graceful-degradation
// pattern anyway: every function throws SlackConfigError instead of
// attempting a network call when COMMAND_CENTER_SLACK_WEBHOOK_URL is
// missing.
//
// This module only ever sends a message when explicitly called by an
// Andrew-triggered request (e.g. the manual test-send route). It has no
// scheduled/automatic send path — wiring a daily briefing push (or any
// other automatic notification) is a distinct, separately approved change,
// per the "must never be automatic" rule in
// docs/architecture/command-center-integrations.md.

type SlackEnv = Record<string, string | undefined>;

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
