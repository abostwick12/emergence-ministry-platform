import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { triageAndDraftImportantMessages } from "@/lib/command-center/integrations/gmail";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";
import { readSageProviderConfig, sageUnavailableMessage, SageProviderConfigError } from "@/lib/command-center/sage";

// Andrew-triggered only — there is no scheduled job calling this route.
// Reads the most recent inbox messages, asks SAGE to judge importance and
// draft a reply for the important ones, creates those drafts, and stages
// them under the review label. Never sends anything.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const providerConfig = readSageProviderConfig();
  if (!providerConfig.configured) {
    return NextResponse.json({ error: sageUnavailableMessage(providerConfig) }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const accessToken = await getValidGmailAccessToken(access.session);
    const results = await triageAndDraftImportantMessages({ accessToken, maxMessages: 5, signal: controller.signal });
    return NextResponse.json({ results });
  } catch (error) {
    if (
      error instanceof GmailNotConnectedError ||
      error instanceof GmailConnectionInvalidError ||
      error instanceof GmailConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SageProviderConfigError) {
      return NextResponse.json({ error: sageUnavailableMessage(providerConfig) }, { status: 503 });
    }
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to triage the Gmail inbox." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
