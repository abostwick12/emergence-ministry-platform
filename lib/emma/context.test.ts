import { describe, expect, it } from "vitest";
import { buildContextManifest, containsForbiddenKeys } from "@/lib/emma/context";

describe("buildContextManifest", () => {
  it("drops sensitive-category entries and strips extra fields", () => {
    const manifest = buildContextManifest([
      { recordId: "evt_1", recordType: "event", category: "event", sourceTable: "events", body: "should be dropped", email: "a@b.c" },
      { recordId: "stu_1", recordType: "student", category: "medical", notes: "confidential" },
      { recordId: "p_1", recordType: "profile", category: "bogus_category" }
    ]);

    expect(manifest.entries).toEqual([
      { recordId: "evt_1", recordType: "event", category: "event", sourceTable: "events" }
    ]);
    expect(containsForbiddenKeys(manifest)).toBe(false);
  });

  it("keeps only known non-sensitive categories", () => {
    const manifest = buildContextManifest([
      { recordId: "t_1", recordType: "task", category: "task" },
      { recordId: "v_1", recordType: "voice_profile", category: "voice_profile" }
    ]);
    expect(manifest.entries).toHaveLength(2);
  });
});

describe("containsForbiddenKeys", () => {
  it("detects forbidden keys anywhere in a structure", () => {
    expect(containsForbiddenKeys({ entries: [{ recordId: "x", body: "secret" }] })).toBe(true);
    expect(containsForbiddenKeys({ nested: { deep: { password: "p" } } })).toBe(true);
    expect(containsForbiddenKeys([{ email: "a@b.c" }])).toBe(true);
  });

  it("passes clean structures", () => {
    expect(containsForbiddenKeys({ entries: [{ recordId: "x", recordType: "event", category: "event" }] })).toBe(false);
  });
});
