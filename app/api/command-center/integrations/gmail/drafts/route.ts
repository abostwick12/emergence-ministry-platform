import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  createGmailDraft,
  isGmailTokenExpired,
  parseStoredGmailTokens,
  refreshGmailAccessToken
} from "@/lib/command-center/integrations/gmail";

type CreateDraftBody = {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  inReplyTo?: unknown;
  threadId?: unknown;
};

// Draft-only. This route creates a Gmail draft for Andrew to review and
// send himself from Gmail — it never calls Gmail's send endpoint.
export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as CreateDraftBody | null;
  if (
    !payload ||
    typeof payload.to !== "string" ||
    typeof payload.subject !== "string" ||
    typeof payload.body !== "string" ||
    !payload.to.trim() ||
    !payload.subject.trim() ||
    !payload.body.trim()
  ) {
    return NextResponse.json({ error: "to, subject, and body are required." }, { status: 400 });
  }

  const integration = await getIntegration(access.session, "gmail");
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Gmail is not connected." }, { status: 409 });
  }

  const tokens = parseStoredGmailTokens(integration.config);
  if (!tokens) {
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Gmail connection is invalid. Reconnect from the integrations page." }, { status: 409 });
  }

  try {
    let accessToken = tokens.accessToken;

    if (isGmailTokenExpired(tokens.expiresAt)) {
      if (!tokens.refreshToken) {
        await updateIntegration(access.session, "gmail", { status: "error", config: {} });
        return NextResponse.json({ error: "Gmail connection expired. Reconnect from the integrations page." }, { status: 409 });
      }
      const refreshed = await refreshGmailAccessToken({ refreshToken: tokens.refreshToken });
      accessToken = refreshed.accessToken;
      await updateIntegration(access.session, "gmail", {
        status: "connected",
        config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
      });
    }

    const draft = await createGmailDraft({
      accessToken,
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      inReplyTo: typeof payload.inReplyTo === "string" ? payload.inReplyTo : undefined,
      threadId: typeof payload.threadId === "string" ? payload.threadId : undefined
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch {
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to create Gmail draft. Reconnect from the integrations page." }, { status: 502 });
  }
}
