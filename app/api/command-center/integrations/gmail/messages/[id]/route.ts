import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { getGmailMessageBody } from "@/lib/command-center/integrations/gmail";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";

// Read-only, full message body. Separate from the /messages triage list
// (which only fetches metadata + snippet) so a full body is only ever
// pulled when Andrew (or SAGE, on Andrew's explicit request) actually needs
// to read one specific message closely.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const message = await getGmailMessageBody({ accessToken, messageId: params.id });
    return NextResponse.json({ message });
  } catch (error) {
    if (
      error instanceof GmailNotConnectedError ||
      error instanceof GmailConnectionInvalidError ||
      error instanceof GmailConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load the Gmail message." }, { status: 502 });
  }
}
