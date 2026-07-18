import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260718124742_student_journey_entries.sql"),
  "utf8"
);

describe("student journey entries migration", () => {
  it("stores structured progress for each student journey day", () => {
    expect(migration).toContain("create table if not exists public.student_journey_entries");
    expect(migration).toContain("unique (student_user_id, journey_id, entry_sequence)");
    expect(migration).toContain("journey_kind text not null check (journey_kind in ('formation', 'question'))");
    expect(migration).toContain("scripture_reflection text not null default ''");
    expect(migration).toContain("fruit_reflection text not null default ''");
    expect(migration).toContain("selected_practice text not null default 'embodied'");
    expect(migration).toContain("study_path text not null default 'word'");
  });

  it("restricts rows to the authenticated student and their ministry", () => {
    expect(migration).toContain("alter table public.student_journey_entries enable row level security");
    expect(migration).toContain("students can select own journey entries");
    expect(migration).toContain("students can insert own journey entries");
    expect(migration).toContain("students can update own journey entries");
    expect(migration).toContain("student_user_id = (select auth.uid())");
    expect(migration).toContain("p.submitted_by_user_id = (select auth.uid())");
  });

  it("exposes only the minimum authenticated Data API privileges", () => {
    expect(migration).toContain("revoke all on public.student_journey_entries from anon");
    expect(migration).toContain("revoke delete, truncate, trigger on public.student_journey_entries from authenticated");
    expect(migration).toContain("grant select, insert, update on public.student_journey_entries to authenticated");
  });
});
