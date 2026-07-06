import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration024 = readFileSync(
  join(process.cwd(), "supabase/migrations/024_personal_command_center_repair.sql"),
  "utf8"
);

const commandCenterTables = [
  "personal_tasks",
  "daily_briefing_cache",
  "ai_conversations",
  "personal_integrations",
  "sage_memory",
  "capture_inbox",
  "job_applications"
];

describe("command center repair migration", () => {
  it("creates every Command Center table idempotently", () => {
    for (const table of commandCenterTables) {
      expect(migration024).toContain(`create table if not exists public.${table}`);
      expect(migration024).toContain(`alter table public.${table} enable row level security`);
      expect(migration024).toContain(`drop policy if exists "andrew only" on public.${table}`);
      expect(migration024).toContain(`create policy "andrew only" on public.${table}`);
    }
  });

  it("keeps the Andrew-only policy and reloads PostgREST schema cache", () => {
    expect(migration024.match(/auth\.email\(\) = 'andrew\.w\.bostwick12@gmail\.com'/g)?.length).toBe(14);
    expect(migration024).toContain("notify pgrst, 'reload schema'");
  });

  it("uses safe index and integration seed patterns", () => {
    expect(migration024).toContain("create index if not exists idx_ai_conversations_session");
    expect(migration024).toContain("create index if not exists idx_sage_memory_domain");
    expect(migration024).toContain("on conflict (service) do nothing");
    expect(migration024).not.toContain("create or replace function public.set_updated_at()");
  });
});
