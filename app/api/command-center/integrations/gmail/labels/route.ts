import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { createGmailLabel, listGmailLabels } from "@/lib/command-center/integrations/gmail";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";

function mapTokenError(error: unknown): NextResponse | null {
  if (
    error instanceof GmailNotConnectedError ||
    error instanceof GmailConnectionInvalidError ||
    error instanceof GmailConnectionExpiredError
  ) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const labels = await listGmailLabels({ accessToken });
    return NextResponse.json({ labels });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Gmail labels. Reconnect from the integrations page." }, { status: 502 });
  }
}

type CreateLabelBody = { name?: unknown };

// Creates a new label ("folder"). This never touches an existing message's
// labels — see the /move route for that.
export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as CreateLabelBody | null;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim()) {
    return NextResponse.json({ error: "A non-empty label name is required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const label = await createGmailLabel({ accessToken, name: payload.name.trim() });
    return NextResponse.json({ label }, { status: 201 });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to create the Gmail label." }, { status: 502 });
  }
}
