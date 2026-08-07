import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260807121622_meridian_content_studio.sql"), "utf8").toLowerCase();
const mcpServer = readFileSync(join(process.cwd(), "lib/meridian/mcp/server.ts"), "utf8");

describe("Meridian content studio migration", () => {
  it("stores governed guide versions, draft-only content, and append-only feedback evidence", () => {
    expect(migration).toContain("create table if not exists public.content_guides");
    expect(migration).toContain("create table if not exists public.content_drafts");
    expect(migration).toContain("create table if not exists public.content_feedback (");
    expect(migration).toContain("status text not null default 'draft' check (status = 'draft')");
    expect(migration).not.toContain("status in ('draft','published')");
  });

  it("requires three distinct drafts and explicit admin approval before activating a new guide version", () => {
    expect(migration).toContain("count(distinct feedback.draft_id)");
    expect(migration).toContain("create or replace function public.approve_content_feedback_batch");
    expect(migration).toContain("administrator approval is required");
    expect(migration).toContain("update public.content_guides set status = 'retired'");
    expect(migration).toContain("resulting_guide_version_id");
  });

  it("preserves retrievable history and implements rollback by creating a new version", () => {
    expect(migration).toContain("create or replace function public.rollback_content_guide");
    expect(migration).toContain("parent_version_id");
    expect(migration).toContain("'rollback to version '");
    expect(migration).toContain("create index if not exists idx_content_guides_history");
  });

  it("enables RLS and explicit Data API grants on every new public table", () => {
    for (const table of ["content_guides", "content_interview_sessions", "content_drafts", "content_feedback_batches", "content_feedback_batch_changes", "content_feedback"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("grant select on public.content_guides to authenticated");
    expect(migration).toContain("revoke all on public.content_guides");
  });
});

describe("content MCP safety surface", () => {
  it("exposes guided and skip paths but no publish, send, schedule, or sync content tool", () => {
    const toolNames = Array.from(mcpServer.matchAll(/server\.registerTool\(\s*\n\s*"([^"]+)"/g), (match) => match[1]);
    expect(toolNames).toContain("start_content_session");
    expect(toolNames).toContain("save_content_draft");
    expect(toolNames).toContain("submit_content_feedback");
    expect(toolNames.some((name) => /content.*(?:publish|send|schedule|sync)|(?:publish|send|schedule|sync).*content/.test(name))).toBe(false);
  });
});
