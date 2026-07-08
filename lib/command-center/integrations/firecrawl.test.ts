import { describe, expect, it, vi } from "vitest";
import { FirecrawlConfigError, readFirecrawlConfig, scrapeUrl } from "@/lib/command-center/integrations/firecrawl";

const configuredEnv = { FIRECRAWL_API_KEY: "fc-test-key" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("readFirecrawlConfig", () => {
  it("reports not configured with the specific missing env var", () => {
    const config = readFirecrawlConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["FIRECRAWL_API_KEY"]);
  });

  it("reports configured when the API key is present", () => {
    const config = readFirecrawlConfig(configuredEnv);
    expect(config.configured).toBe(true);
  });
});

describe("scrapeUrl", () => {
  it("throws FirecrawlConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(scrapeUrl({ url: "https://example.com", env: {}, fetchImpl })).rejects.toThrow(FirecrawlConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scrapes a URL and returns title/markdown", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { markdown: "# Example\nHello world.", metadata: { title: "Example Domain" } } })
    );
    const result = await scrapeUrl({ url: "https://example.com", env: configuredEnv, fetchImpl });
    expect(result).toEqual({ title: "Example Domain", markdown: "# Example\nHello world.", truncated: false });

    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.firecrawl.dev/v1/scrape");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com", formats: ["markdown"] });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fc-test-key");
  });

  it("truncates markdown longer than the safety limit", async () => {
    const longMarkdown = "a".repeat(5000);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { markdown: longMarkdown, metadata: {} } }));
    const result = await scrapeUrl({ url: "https://example.com", env: configuredEnv, fetchImpl });
    expect(result.truncated).toBe(true);
    expect(result.markdown.length).toBe(4000);
  });

  it("throws when the scrape request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(scrapeUrl({ url: "https://example.com", env: configuredEnv, fetchImpl })).rejects.toThrow("Firecrawl scrape failed");
  });
});
