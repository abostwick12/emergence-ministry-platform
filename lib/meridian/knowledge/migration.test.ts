import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260801120000_meridian_primitive_knowledge.sql"), "utf8");

describe("Meridian primitive knowledge migration", () => {
  it("creates every primitive plus audited promotion and answer provenance", () => {
    for (const table of [
      "meridian_sources",
      "meridian_fragments",
      "meridian_claims",
      "meridian_contexts",
      "meridian_relationships",
      "meridian_guardrails",
      "meridian_candidates",
      "meridian_review_events",
      "meridian_answer_traces",
      "meridian_provider_traces"
    ]) expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain("create or replace function public.promote_meridian_candidate");
    expect(migration).toContain("create or replace function public.search_meridian_approved_claims");
  });

  it("models the reviewed Andrew-authored corpus and indexed claim-first retrieval", () => {
    expect(migration).toContain("'sermon','academic_paper','curriculum_material','scholarly_work'");
    expect(migration).toContain("corpus_family text not null");
    expect(migration).toContain("'andrew_authored_ministry'");
    expect(migration).toContain("search_vector tsvector generated always as");
    expect(migration).toContain("idx_meridian_claims_search");
    expect(migration).toContain("p_match_count integer default 32");
    expect(migration).toContain("security invoker");
  });

  it("enforces Obsidian private discovery defaults and granular use permissions", () => {
    expect(migration).toContain("source_kind text not null default 'obsidian_note' check (source_kind = 'obsidian_note')");
    expect(migration).toContain("authority_class text not null default 'none' check (authority_class = 'none')");
    expect(migration).toContain("quote_policy text not null default 'never' check (quote_policy = 'never')");
    expect(migration).toContain("generation_policy text not null default 'discovery_only' check (generation_policy = 'discovery_only')");
    expect(migration).toContain("can_use_final_answer boolean not null default false");
    expect(migration).toContain("can_use_external_communication boolean not null default false");
  });

  it("uses strict tenant RLS, denies raw candidates to anon, and makes fragments immutable", () => {
    expect(migration).toContain("p.id = (select auth.uid()) and p.ministry_id = meridian_candidates.ministry_id");
    expect(migration).toContain("alter table public.meridian_candidates enable row level security");
    expect(migration).toContain("revoke all on public.meridian_candidates from anon");
    expect(migration).toContain("before update or delete on public.meridian_fragments");
    expect(migration).toContain("revoke update, delete, truncate, trigger on public.meridian_fragments from authenticated");
  });

  it("hardens the promotion RPC and prevents persistent YouVersion text", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("revoke all on function public.promote_meridian_candidate");
    expect(migration).toContain("Only a ministry admin may promote Meridian knowledge");
    expect(migration).toContain("YouVersion Scripture text must remain transient");
  });
});
