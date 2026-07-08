import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { moveGmailMessageToLabel } from "@/lib/command-center/integrations/gmail";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";

type MoveMessageBody = { labelName?: unknown };

// "Move to folder": adds the target label (creating it first if it doesn't
// exist) and removes INBOX. Gmail has no real folders — this is the
// closest equivalent and matches what dragging a message onto a label does
// in Gmail's own UI.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as MoveMessageBody | null;
  if (!payload || typeof payload.labelName !== "string" || !payload.labelName.trim()) {
    return NextResponse.json({ error: "A non-empty labelName is required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const label = await moveGmailMessageToLabel({ accessToken, messageId: params.id, labelName: payload.labelName.trim() });
    return NextResponse.json({ label });
  } catch (error) {
    if (
      error instanceof GmailNotConnectedError ||
      error instanceof GmailConnectionInvalidError ||
      error instanceof GmailConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to move the Gmail message." }, { status: 502 });
  }
}
