// LinkedIn drafting support for the Personal Command Center. LinkedIn has
// no API integration here and needs none: SAGE only drafts post/outreach
// text locally using the same OpenAI/Azure OpenAI provider already
// configured for SAGE chat (lib/command-center/sage.ts). There is no
// LinkedIn API call, no OAuth flow, and no post/send function anywhere in
// this module — Andrew always copies and posts the draft himself.
//
// Because there is no separate LinkedIn credential, "configured" for this
// integration means the same thing as SAGE chat being configured: see
// isIntegrationConfigured()'s LinkedIn special case in
// lib/command-center/integrations-meta.ts.

import { streamSageResponse } from "@/lib/command-center/sage";

export type LinkedInDraftKind = "post" | "outreach";

const LINKEDIN_POST_INSTRUCTIONS = `You are SAGE, drafting a LinkedIn post for Andrew Bostwick's military-to-civilian leadership transition and job search. Write in a direct, warm, credible voice with no corporate jargon or hashtag spam. Keep it to 150-250 words. Andrew will review and post this himself — never claim it has been posted or published.`;

const LINKEDIN_OUTREACH_INSTRUCTIONS = `You are SAGE, drafting a short LinkedIn outreach/connection message for Andrew Bostwick's job search. Keep it under 80 words, specific to the stated topic, warm but not presumptuous, and easy for Andrew to personalize further. Andrew will review and send this himself — never claim it has been sent.`;

export function linkedInDraftInstructions(kind: LinkedInDraftKind): string {
  return kind === "outreach" ? LINKEDIN_OUTREACH_INSTRUCTIONS : LINKEDIN_POST_INSTRUCTIONS;
}

// Drafting only — there is no send/post call anywhere in this function or
// module. Reuses SAGE's existing provider selection (OpenAI or Azure
// OpenAI) rather than adding a separate credential.
export async function draftLinkedInContent(params: {
  kind: LinkedInDraftKind;
  topic: string;
  signal: AbortSignal;
  env?: Record<string, string | undefined>;
}): Promise<string> {
  const instructions = linkedInDraftInstructions(params.kind);
  const result = await streamSageResponse({
    instructions,
    input: `Topic: ${params.topic}`,
    signal: params.signal,
    env: params.env
  });
  return result.content;
}
