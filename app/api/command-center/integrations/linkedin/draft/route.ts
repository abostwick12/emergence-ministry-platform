import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { draftLinkedInContent, type LinkedInDraftKind } from "@/lib/command-center/integrations/linkedin";
import { updateIntegration } from "@/lib/command-center/repository";
import { readSageProviderConfig, sageUnavailableMessage, SageProviderConfigError } from "@/lib/command-center/sage";

type DraftBody = { kind?: unknown; topic?: unknown };

const VALID_KINDS: LinkedInDraftKind[] = ["post", "outreach"];

// Drafting only. This route never calls a LinkedIn API and never posts or
// sends anything — it returns text for Andrew to copy and post himself.
export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as DraftBody | null;
  const kind = payload?.kind;
  const topic = payload?.topic;
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind as LinkedInDraftKind) || typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "kind ('post' or 'outreach') and a non-empty topic are required." }, { status: 400 });
  }

  const providerConfig = readSageProviderConfig();
  if (!providerConfig.configured) {
    return NextResponse.json({ error: sageUnavailableMessage(providerConfig) }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const draft = await draftLinkedInContent({ kind: kind as LinkedInDraftKind, topic, signal: controller.signal });
    await updateIntegration(access.session, "linkedin", { status: "connected", config: {} });
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof SageProviderConfigError) {
      return NextResponse.json({ error: sageUnavailableMessage(providerConfig) }, { status: 503 });
    }
    await updateIntegration(access.session, "linkedin", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to draft LinkedIn content." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
