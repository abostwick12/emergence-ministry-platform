import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/029_scripture_knowledge_rag_spine.sql"), "utf8");
const grantHardeningMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/030_harden_student_question_recommendation_grants.sql"),
  "utf8"
);
const rabbinicRecommendationMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/031_student_question_rabbinic_recommendations.sql"),
  "utf8"
);
const internalGroundingMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260716123000_internal_grounding_visibility.sql"),
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

  it("allows the student question rhythm to be persisted as first-class recommendations", () => {
    expect(rabbinicRecommendationMigration).toContain("drop constraint if exists student_question_recommendations_recommendation_kind_check");
    expect(rabbinicRecommendationMigration).toContain("'wrestle_question'");
    expect(rabbinicRecommendationMigration).toContain("'journal_prompt'");
    expect(rabbinicRecommendationMigration).toContain("'prayer_prompt'");
    expect(rabbinicRecommendationMigration).toContain("'wrestle_together'");
  });

  it("adds admin-only internal grounding without changing student-visible retrieval", () => {
    expect(internalGroundingMigration).toContain("'internal_grounding'");
    expect(internalGroundingMigration).toContain("admins can manage all ministry knowledge sources");
    expect(internalGroundingMigration).toContain("leaders can manage non-grounding ministry knowledge sources");
    expect(internalGroundingMigration).toContain("visibility <> 'internal_grounding'");
    expect(migration).toContain("using (ministry_id = public.current_ministry_id() and visibility = 'student_visible')");
  });
});
