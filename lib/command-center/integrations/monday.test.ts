import { describe, expect, it, vi } from "vitest";
import { listMondayBoardItems, listMondayBoards, MondayConfigError, readMondayConfig } from "@/lib/command-center/integrations/monday";

const configuredEnv = { MONDAY_API_TOKEN: "monday-test-token" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("readMondayConfig", () => {
  it("reports not configured with the specific missing env var", () => {
    const config = readMondayConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["MONDAY_API_TOKEN"]);
  });

  it("reports configured when the API token is present", () => {
    const config = readMondayConfig(configuredEnv);
    expect(config.configured).toBe(true);
  });
});

describe("listMondayBoards", () => {
  it("throws MondayConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(listMondayBoards({ env: {}, fetchImpl })).rejects.toThrow(MondayConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lists boards using a read-only GraphQL query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: { boards: [{ id: "1", name: "Job Search Pipeline" }] } })
    );
    const boards = await listMondayBoards({ env: configuredEnv, fetchImpl });
    expect(boards).toEqual([{ id: "1", name: "Job Search Pipeline" }]);

    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.monday.com/v2");
    expect((init.headers as Record<string, string>).Authorization).toBe("monday-test-token");
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain("boards");
    expect(body.query).not.toMatch(/mutation/i);
  });

  it("throws when the Monday.com API returns an error payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "Invalid token" }] }));
    await expect(listMondayBoards({ env: configuredEnv, fetchImpl })).rejects.toThrow("Monday.com API error: Invalid token");
  });

  it("throws when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listMondayBoards({ env: configuredEnv, fetchImpl })).rejects.toThrow("Monday.com boards fetch failed");
  });
});

describe("listMondayBoardItems", () => {
  it("throws MondayConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(listMondayBoardItems({ boardId: "1", env: {}, fetchImpl })).rejects.toThrow(MondayConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lists items with their column values using a read-only GraphQL query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          boards: [
            {
              items_page: {
                items: [
                  {
                    id: "item_1",
                    name: "Follow up with recruiter",
                    column_values: [
                      { id: "status", text: "Working on it" },
                      { id: "date", text: "2026-07-10" }
                    ]
                  }
                ]
              }
            }
          ]
        }
      })
    );

    const items = await listMondayBoardItems({ boardId: "board_1", env: configuredEnv, fetchImpl });
    expect(items).toEqual([
      {
        id: "item_1",
        name: "Follow up with recruiter",
        columns: [
          { id: "status", text: "Working on it" },
          { id: "date", text: "2026-07-10" }
        ]
      }
    ]);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain("board_1");
    expect(body.query).toContain("items_page");
    expect(body.query).not.toMatch(/mutation/i);
  });

  it("returns an empty list when the board has no items", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { boards: [{ items_page: { items: [] } }] } }));
    const items = await listMondayBoardItems({ boardId: "board_2", env: configuredEnv, fetchImpl });
    expect(items).toEqual([]);
  });

  it("throws when the Monday.com API returns an error payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "Board not found" }] }));
    await expect(listMondayBoardItems({ boardId: "missing", env: configuredEnv, fetchImpl })).rejects.toThrow(
      "Monday.com API error: Board not found"
    );
  });

  it("throws when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listMondayBoardItems({ boardId: "board_1", env: configuredEnv, fetchImpl })).rejects.toThrow(
      "Monday.com board items fetch failed"
    );
  });
});
