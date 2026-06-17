import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  contextManifestEntrySchema,
  createAiRequestInputSchema,
  emmaResponseSchema
} from "@/lib/emma/schemas";

describe("createAiRequestInputSchema", () => {
  it("accepts a valid request", () => {
    const result = createAiRequestInputSchema.safeParse({
      source: "event_card",
      workflow: "GENERATE_EVENT_TASKS",
      sourceRecordType: "event",
      sourceRecordId: "evt_winter_retreat"
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown workflow", () => {
    expect(createAiRequestInputSchema.safeParse({ source: "event_card", workflow: "NOPE" }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(createAiRequestInputSchema.safeParse({ source: "hacker", workflow: "GENERATE_EVENT_TASKS" }).success).toBe(false);
  });

  it("rejects extra keys (strict) so a client cannot smuggle ministry_id", () => {
    const result = createAiRequestInputSchema.safeParse({
      source: "event_card",
      workflow: "GENERATE_EVENT_TASKS",
      ministry_id: "some-other-ministry"
    });
    expect(result.success).toBe(false);
  });
});

describe("contextManifestEntrySchema", () => {
  it("rejects sensitive categories", () => {
    expect(contextManifestEntrySchema.safeParse({ recordId: "x", recordType: "student", category: "medical" }).success).toBe(false);
  });

  it("rejects extra (potentially sensitive) keys", () => {
    expect(
      contextManifestEntrySchema.safeParse({ recordId: "x", recordType: "event", category: "event", body: "secret" }).success
    ).toBe(false);
  });

  it("accepts a clean entry", () => {
    expect(contextManifestEntrySchema.safeParse({ recordId: "x", recordType: "event", category: "event" }).success).toBe(true);
  });
});

describe("emmaResponseSchema", () => {
  it("validates ok and error variants and rejects bad error codes", () => {
    const schema = emmaResponseSchema(z.object({ value: z.number() }));
    expect(schema.safeParse({ ok: true, data: { value: 1 } }).success).toBe(true);
    expect(schema.safeParse({ ok: false, error: { code: "FORBIDDEN", message: "no" } }).success).toBe(true);
    expect(schema.safeParse({ ok: false, error: { code: "BOGUS", message: "x" } }).success).toBe(false);
  });
});
