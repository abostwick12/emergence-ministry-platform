import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { createGmailDraft, stageGmailDraftForReview } from "@/lib/command-center/integrations/gmail";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";

type CreateDraftBody = {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  inReplyTo?: unknown;
  threadId?: unknown;
};

// Draft-only. This route creates a Gmail draft for Andrew to review and
// send himself from Gmail — it never calls Gmail's send endpoint. Every
// draft is staged under GMAIL_DRAFT_REVIEW_LABEL_NAME so SAGE-created
// drafts are easy to find in one place.
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

  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const draft = await createGmailDraft({
      accessToken,
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      inReplyTo: typeof payload.inReplyTo === "string" ? payload.inReplyTo : undefined,
      threadId: typeof payload.threadId === "string" ? payload.threadId : undefined
    });
    await stageGmailDraftForReview({ accessToken, messageId: draft.messageId });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (
      error instanceof GmailNotConnectedError ||
      error instanceof GmailConnectionInvalidError ||
      error instanceof GmailConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to create Gmail draft. Reconnect from the integrations page." }, { status: 502 });
  }
}
