// Read-only Monday.com board and item listing for the Personal Command
// Center. Monday's personal API token needs no OAuth flow — just
// MONDAY_API_TOKEN being present in the server environment. Mirrors the
// same graceful-degradation pattern: every function throws
// MondayConfigError instead of attempting a network call when the token is
// missing.
//
// This module is read-only end to end: it lists boards and the items
// (tasks) inside a board. Task sync (reading or writing personal_tasks
// to/from a Monday board) is a distinct, separately approved change — per
// docs/architecture/command-center-integrations.md, "Writing to Monday.com
// without Andrew approving the sync direction first" must never be
// automatic, and there is intentionally no write/mutation call anywhere in
// this module.

const MONDAY_API_URL = "https://api.monday.com/v2";

type MondayEnv = Record<string, string | undefined>;

export type MondayConfig = {
  configured: boolean;
  apiToken?: string;
  missing: string[];
};

export type MondayBoardSummary = {
  id: string;
  name: string;
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readMondayConfig(env: MondayEnv = process.env): MondayConfig {
  const apiToken = cleanEnv(env.MONDAY_API_TOKEN);
  const missing = apiToken ? [] : ["MONDAY_API_TOKEN"];
  return { configured: missing.length === 0, apiToken, missing };
}

export class MondayConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Monday.com integration is not configured.");
    this.name = "MondayConfigError";
    this.missing = missing;
  }
}

type MondayBoardsResponse = {
  data?: { boards?: Array<{ id: string; name: string }> };
  errors?: Array<{ message?: string }>;
};

// Read-only: lists board id/name only, via Monday's GraphQL API. No
// mutation query exists anywhere in this module.
export async function listMondayBoards(params: {
  env?: MondayEnv;
  fetchImpl?: typeof fetch;
  limit?: number;
}): Promise<MondayBoardSummary[]> {
  const config = readMondayConfig(params.env);
  if (!config.configured || !config.apiToken) {
    throw new MondayConfigError(config.missing);
  }
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: config.apiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: `{ boards (limit: ${params.limit ?? 25}) { id name } }` })
  });
  if (!response.ok) throw new Error(`Monday.com boards fetch failed: ${response.status}`);
  const json = (await response.json()) as MondayBoardsResponse;
  if (json.errors?.length) throw new Error(`Monday.com API error: ${json.errors[0]?.message ?? "unknown"}`);
  return (json.data?.boards ?? []).map((board) => ({ id: board.id, name: board.name }));
}

export type MondayColumnValue = {
  id: string;
  text: string;
};

export type MondayBoardItem = {
  id: string;
  name: string;
  columns: MondayColumnValue[];
};

type MondayItemsResponse = {
  data?: {
    boards?: Array<{
      items_page?: {
        items?: Array<{
          id: string;
          name: string;
          column_values?: Array<{ id: string; text: string | null }>;
        }>;
      };
    }>;
  };
  errors?: Array<{ message?: string }>;
};

function mapMondayItem(item: {
  id: string;
  name: string;
  column_values?: Array<{ id: string; text: string | null }>;
}): MondayBoardItem {
  return {
    id: item.id,
    name: item.name,
    columns: (item.column_values ?? []).map((column) => ({ id: column.id, text: column.text ?? "" }))
  };
}

// Read-only: lists the items (tasks) inside one board, including each
// item's column values (status, dates, etc. as rendered text). No
// mutation query exists anywhere in this module — this never creates,
// updates, or deletes a board or item.
export async function listMondayBoardItems(params: {
  boardId: string;
  limit?: number;
  env?: MondayEnv;
  fetchImpl?: typeof fetch;
}): Promise<MondayBoardItem[]> {
  const config = readMondayConfig(params.env);
  if (!config.configured || !config.apiToken) {
    throw new MondayConfigError(config.missing);
  }
  const doFetch = params.fetchImpl ?? fetch;
  const query = `{ boards (ids: [${JSON.stringify(params.boardId)}]) { items_page (limit: ${params.limit ?? 25}) { items { id name column_values { id text } } } } }`;
  const response = await doFetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: config.apiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  if (!response.ok) throw new Error(`Monday.com board items fetch failed: ${response.status}`);
  const json = (await response.json()) as MondayItemsResponse;
  if (json.errors?.length) throw new Error(`Monday.com API error: ${json.errors[0]?.message ?? "unknown"}`);
  const items = json.data?.boards?.[0]?.items_page?.items ?? [];
  return items.map(mapMondayItem);
}
