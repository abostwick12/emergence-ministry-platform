import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { FirecrawlConfigError, scrapeUrl } from "@/lib/command-center/integrations/firecrawl";

type ScrapeBody = { url?: unknown };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Manual, on-demand, single-URL scrape. There is no scheduled crawl calling
// this — Andrew (or a future SAGE turn Andrew explicitly asks for) must
// request each scrape individually.
export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as ScrapeBody | null;
  if (!payload || typeof payload.url !== "string" || !isHttpUrl(payload.url)) {
    return NextResponse.json({ error: "A valid http(s) url is required." }, { status: 400 });
  }

  try {
    const result = await scrapeUrl({ url: payload.url });
    await updateIntegration(access.session, "firecrawl", { status: "connected", config: {} });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof FirecrawlConfigError) {
      return NextResponse.json({ error: "Firecrawl is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "firecrawl", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to scrape the page." }, { status: 502 });
  }
}
