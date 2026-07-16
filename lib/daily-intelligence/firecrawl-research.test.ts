import { describe, expect, it, vi } from "vitest";
import {
  DailyIntelligenceFirecrawlConfigError,
  rankSearchHits,
  readDailyIntelligenceFirecrawlConfig,
  searchFirecrawl
} from "@/lib/daily-intelligence/firecrawl-research";

const configuredEnv = { FIRECRAWL_API_KEY: "fc-test" };

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("daily intelligence Firecrawl config", () => {
  it("uses the shared Firecrawl key without depending on Command Center env names", () => {
    expect(readDailyIntelligenceFirecrawlConfig({}).missing).toEqual(["FIRECRAWL_API_KEY"]);
    expect(readDailyIntelligenceFirecrawlConfig(configuredEnv).configured).toBe(true);
  });
});

describe("searchFirecrawl", () => {
  it("does not call Firecrawl when the API key is missing", async () => {
    const fetchImpl = vi.fn();
    await expect(searchFirecrawl({ query: "student ministry", env: {}, fetchImpl })).rejects.toThrow(DailyIntelligenceFirecrawlConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls Firecrawl v2 search with recent web search options", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ success: true, data: { web: [{ title: "A", url: "https://example.com/a" }] } }));
    const hits = await searchFirecrawl({ query: "student ministry", env: configuredEnv, fetchImpl });

    expect(hits).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.firecrawl.dev/v2/search");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fc-test");
    expect(JSON.parse(init.body as string)).toMatchObject({ query: "student ministry", limit: 6, sources: ["web"], tbs: "qdr:m" });
  });
});

describe("rankSearchHits", () => {
  it("rejects unsafe games and keeps useful resources", () => {
    const resources = rankSearchHits(
      [
        { title: "Safe youth ministry game", url: "https://trustedministry.org/game", description: "minimal setup youth group game" },
        { title: "Humiliation game", url: "https://example.com/bad", description: "embarrass students for laughs" }
      ],
      "tuesday",
      "Quick Sunday Icebreakers"
    );

    expect(resources[0].rejected).toBe(false);
    expect(resources[0].type).toBe("game");
    expect(resources[1].rejected).toBe(true);
  });
});

