import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/029_scripture_knowledge_rag_spine.sql"), "utf8");
const grantHardeningMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/030_harden_student_question_recommendation_grants.sql"),
  "utf8"
);

describe("scripture knowledge RAG migration", () => {
  it("creates the launch knowledge tables with pgvector-ready chunks", () => {
    expect(migration).toContain("create extension if not exists vector with schema extensions");
    expect(migration).toContain("create table if not exists public.knowledge_sources");
    expect(migration).toContain("create table if not exists public.knowledge_chunks");
    expect(migration).toContain("embedding extensions.vector(1536)");
    expect(migration).toContain("create table if not exists public.student_question_recommendations");
  });

  it("keeps student retrieval limited to student-visible knowledge", () => {
    expect(migration).toContain("alter table public.knowledge_sources enable row level security");
    expect(migration).toContain("alter table public.knowledge_chunks enable row level security");
    expect(migration).toContain("visibility = 'student_visible'");
    expect(migration).toContain("visibility in ('student_visible','leader_only','private_review','scholar_citation_only')");
  });

  it("explicitly grants Data API access while preserving RLS", () => {
    expect(migration).toContain("grant select, insert, update, delete on public.knowledge_sources to authenticated");
    expect(migration).toContain("grant select, insert, update, delete on public.knowledge_chunks to authenticated");
    expect(migration).toContain("grant select, insert on public.student_question_recommendations to authenticated");
  });

  it("keeps persisted student recommendations append-only through explicit grants", () => {
    expect(grantHardeningMigration).toContain(
      "revoke update, delete, truncate, trigger on public.student_question_recommendations from authenticated"
    );
    expect(grantHardeningMigration).toContain("grant select, insert on public.student_question_recommendations to authenticated");
  });
});
