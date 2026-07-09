import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

export type SlackDiscussionDeliveryResult =
  | { ok: true; channel: string; message: string }
  | { ok: false; code: "not_configured" | "provider_error"; message: string };

export function isSlackDiscussionDeliveryConfigured(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return Boolean(env.SLACK_WEBHOOK_URL?.trim());
}

export async function deliverDiscussionPromptToSlack(prompt: StudentDiscussionPrompt): Promise<SlackDiscussionDeliveryResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      ok: false,
      code: "not_configured",
      message: "Slack delivery is offline. The approved prompt is saved for leader-controlled sharing."
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text:
        `Approved Scripture discussion prompt\n` +
        `Question: ${prompt.question}\n` +
        `Reference: ${prompt.scriptureReference || "No reference selected"}\n\n` +
        `${prompt.discussionPrompt}`
    })
  });

  if (!response.ok) {
    return { ok: false, code: "provider_error", message: "Slack did not accept the approved discussion prompt." };
  }

  return {
    ok: true,
    channel: "Slack webhook",
    message: "Approved discussion prompt delivered to Slack."
  };
}
