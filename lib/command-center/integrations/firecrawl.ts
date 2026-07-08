// Read-only web scrape for the Personal Command Center's daily resource
// feed. Like Slack, Firecrawl has no OAuth consent flow — just
// FIRECRAWL_API_KEY being present in the server environment. Mirrors the
// same graceful-degradation pattern: every function throws
// FirecrawlConfigError instead of attempting a network call when the API
// key is missing.
//
// This module only ever scrapes a single URL when explicitly requested by
// an Andrew-triggered call (the manual scrape route). There is no scheduled
// crawl, curated URL allowlist, or other automatic caller anywhere —
// wiring an automatic daily-briefing crawl is a distinct, separately
// approved change, per the "must never be automatic" rule in
// docs/architecture/command-center-integrations.md.

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";
const MAX_MARKDOWN_LENGTH = 4000;

type FirecrawlEnv = Record<string, string | undefined>;

export type FirecrawlConfig = {
  configured: boolean;
  apiKey?: string;
  missing: string[];
};

export type FirecrawlScrapeResult = {
  title: string;
  markdown: string;
  truncated: boolean;
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readFirecrawlConfig(env: FirecrawlEnv = process.env): FirecrawlConfig {
  const apiKey = cleanEnv(env.FIRECRAWL_API_KEY);
  const missing = apiKey ? [] : ["FIRECRAWL_API_KEY"];
  return { configured: missing.length === 0, apiKey, missing };
}

export class FirecrawlConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Firecrawl integration is not configured.");
    this.name = "FirecrawlConfigError";
    this.missing = missing;
  }
}

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string };
  };
};

// Read-only, single-URL scrape. There is no crawl/map call here — only the
// narrowest Firecrawl operation needed to pull one page's readable content
// for Andrew's manual review.
export async function scrapeUrl(params: { url: string; env?: FirecrawlEnv; fetchImpl?: typeof fetch }): Promise<FirecrawlScrapeResult> {
  const config = readFirecrawlConfig(params.env);
  if (!config.configured || !config.apiKey) {
    throw new FirecrawlConfigError(config.missing);
  }
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: params.url, formats: ["markdown"] })
  });
  if (!response.ok) throw new Error(`Firecrawl scrape failed: ${response.status}`);
  const json = (await response.json()) as FirecrawlScrapeResponse;
  const markdown = json.data?.markdown ?? "";
  const truncated = markdown.length > MAX_MARKDOWN_LENGTH;
  return {
    title: json.data?.metadata?.title ?? params.url,
    markdown: truncated ? markdown.slice(0, MAX_MARKDOWN_LENGTH) : markdown,
    truncated
  };
}
