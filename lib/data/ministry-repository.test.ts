import { describe, expect, it } from "vitest";
import { MINISTRY_TASK_LIST_SELECT } from "@/lib/data/ministry-repository";

describe("ministry repository Supabase query shape", () => {
  it("does not select the optional tasks.notes column for dashboard and events data", () => {
    expect(MINISTRY_TASK_LIST_SELECT.split(",")).not.toContain("notes");
  });
});
