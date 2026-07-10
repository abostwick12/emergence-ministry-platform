import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260710143000_student_how_to_read_progress.sql"),
  "utf8"
);

describe("student how to read progress migration", () => {
  it("creates private per-student guide progress", () => {
    expect(migration).toContain("create table if not exists public.student_how_to_read_progress");
    expect(migration).toContain("student_user_id uuid not null references public.profiles(id)");
    expect(migration).toContain("module_id text not null check");
    expect(migration).toContain("completed_at timestamptz");
    expect(migration).toContain("share_with_group boolean not null default false");
    expect(migration).toContain("unique (student_user_id, module_id)");
  });

  it("keeps progress rows protected by student-owned RLS", () => {
    expect(migration).toContain("alter table public.student_how_to_read_progress enable row level security");
    expect(migration).toContain("students can select own how to read progress");
    expect(migration).toContain("students can insert own how to read progress");
    expect(migration).toContain("students can update own how to read progress");
    expect(migration).toContain("and student_user_id = (select auth.uid())");
  });

  it("exposes only minimal authenticated Data API permissions", () => {
    expect(migration).toContain("revoke all on public.student_how_to_read_progress from anon");
    expect(migration).toContain("revoke delete, truncate, trigger on public.student_how_to_read_progress from authenticated");
    expect(migration).toContain("grant select, insert, update on public.student_how_to_read_progress to authenticated");
  });
});
