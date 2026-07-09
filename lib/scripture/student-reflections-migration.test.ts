import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260709113613_student_question_reflection_state.sql"),
  "utf8"
);

describe("student question reflection migration", () => {
  it("creates a private per-student reflection table", () => {
    expect(migration).toContain("create table if not exists public.student_question_reflections");
    expect(migration).toContain("prompt_id uuid not null references public.student_discussion_prompts(id) on delete cascade");
    expect(migration).toContain("private_note text not null default '' check (char_length(private_note) <= 1200)");
    expect(migration).toContain("unique (prompt_id, student_user_id)");
  });

  it("keeps reflection rows protected by student-owned RLS", () => {
    expect(migration).toContain("alter table public.student_question_reflections enable row level security");
    expect(migration).toContain("students can select own question reflections");
    expect(migration).toContain("students can insert own question reflections");
    expect(migration).toContain("students can update own question reflections");
    expect(migration).toContain("and student_user_id = (select auth.uid())");
    expect(migration).toContain("and p.submitted_by_user_id = (select auth.uid())");
  });

  it("exposes only the minimal authenticated Data API permissions", () => {
    expect(migration).toContain("revoke all on public.student_question_reflections from anon");
    expect(migration).toContain("revoke delete, truncate, trigger on public.student_question_reflections from authenticated");
    expect(migration).toContain("grant select, insert, update on public.student_question_reflections to authenticated");
  });
});
