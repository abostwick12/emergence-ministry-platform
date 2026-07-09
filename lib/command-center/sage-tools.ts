// SAGE's first (and, for now, only) tool call: creating a Gmail draft when
// Andrew explicitly asks for one in chat. Draft-only -- this reuses the
// exact createGmailDraft + stageGmailDraftForReview pair the manual drafts
// route (app/api/command-center/integrations/gmail/drafts/route.ts) already
// uses, so a SAGE-authored draft looks identical to one created there and
// there is still no send() call anywhere in this codebase.
//
// The tool is only ever offered to the model when Gmail is actually
// connected -- if it isn't, SAGE isn't given this capability for the turn
// at all, matching the graceful-degradation pattern every other integration
// already uses.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration } from "@/lib/command-center/repository";
import type { SageToolCall, SageToolDefinition } from "@/lib/command-center/sage";
import { createGmailDraft, stageGmailDraftForReview } from "@/lib/command-center/integrations/gmail";
import { getValidGmailAccessToken } from "@/lib/command-center/integrations/gmail-token";

export const CREATE_GMAIL_DRAFT_TOOL_NAME = "create_gmail_draft";

const CREATE_GMAIL_DRAFT_TOOL: SageToolDefinition = {
  name: CREATE_GMAIL_DRAFT_TOOL_NAME,
  description:
    "Creates a Gmail draft for Andrew to review and send himself. Never sends an email. Use only when Andrew explicitly asks for a draft to be created.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address." },
      subject: { type: "string", description: "Email subject line." },
      body: { type: "string", description: "Plain-text email body." }
    },
    required: ["to", "subject", "body"],
    additionalProperties: false
  }
};

export type GmailDraftToolOutcome =
  | { ok: true; draftId: string; to: string; subject: string }
  | { ok: false; error: string };

// Returns the tool definitions to offer the model this turn. Empty when
// Gmail isn't connected -- the model is never even told this tool exists.
export async function buildSageTools(session: AuthSession): Promise<SageToolDefinition[]> {
  const integration = await getIntegration(session, "gmail");
  if (!integration || integration.status !== "connected") return [];
  return [CREATE_GMAIL_DRAFT_TOOL];
}

// Executes a tool call the model requested and returns the JSON string to
// send back as the function_call_output, plus the structured outcome so the
// caller (the chat route) can surface a deterministic confirmation in the
// UI independent of whatever the model says next.
export async function executeSageToolCall(
  session: AuthSession,
  call: SageToolCall
): Promise<{ output: string; outcome: GmailDraftToolOutcome }> {
  if (call.name !== CREATE_GMAIL_DRAFT_TOOL_NAME) {
    const outcome: GmailDraftToolOutcome = { ok: false, error: `Unknown tool: ${call.name}` };
    return { output: JSON.stringify(outcome), outcome };
  }

  let args: { to?: unknown; subject?: unknown; body?: unknown };
  try {
    args = JSON.parse(call.argumentsJson);
  } catch {
    const outcome: GmailDraftToolOutcome = { ok: false, error: "Invalid tool arguments." };
    return { output: JSON.stringify(outcome), outcome };
  }

  if (
    typeof args.to !== "string" ||
    typeof args.subject !== "string" ||
    typeof args.body !== "string" ||
    !args.to.trim() ||
    !args.subject.trim() ||
    !args.body.trim()
  ) {
    const outcome: GmailDraftToolOutcome = { ok: false, error: "to, subject, and body are required." };
    return { output: JSON.stringify(outcome), outcome };
  }

  try {
    const accessToken = await getValidGmailAccessToken(session);
    const draft = await createGmailDraft({ accessToken, to: args.to, subject: args.subject, body: args.body });
    await stageGmailDraftForReview({ accessToken, messageId: draft.messageId });
    const outcome: GmailDraftToolOutcome = { ok: true, draftId: draft.draftId, to: args.to, subject: args.subject };
    return { output: JSON.stringify(outcome), outcome };
  } catch (error) {
    const outcome: GmailDraftToolOutcome = {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create Gmail draft."
    };
    return { output: JSON.stringify(outcome), outcome };
  }
}
