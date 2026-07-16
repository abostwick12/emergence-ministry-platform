import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { measureServerOperation } from "@/lib/performance/timing";

describe("privacy-safe server timing", () => {
  const originalEnabled = process.env.PERFORMANCE_TIMING_ENABLED;
  const originalRegion = process.env.VERCEL_REGION;

  beforeEach(() => {
    process.env.PERFORMANCE_TIMING_ENABLED = "true";
    process.env.VERCEL_REGION = "test-region";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnvironment("PERFORMANCE_TIMING_ENABLED", originalEnabled);
    restoreEnvironment("VERCEL_REGION", originalRegion);
  });

  it("logs only the allowed operation metadata", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await measureServerOperation("dashboard.overview", async () => ({ secret: "do-not-log" }));

    const entry = JSON.parse(String(info.mock.calls[0][0]));
    expect(entry).toMatchObject({
      event: "server_timing",
      operation: "dashboard.overview",
      outcome: "ok",
      runtimeRegion: "test-region"
    });
    expect(Object.keys(entry).sort()).toEqual(["durationMs", "event", "operation", "outcome", "runtimeRegion"]);
    expect(JSON.stringify(entry)).not.toContain("do-not-log");
  });

  it("classifies errors without logging their messages", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(measureServerOperation("provider.gloo", async () => {
      throw new TypeError("private prompt text");
    })).rejects.toThrow("private prompt text");

    const entry = JSON.parse(String(info.mock.calls[0][0]));
    expect(entry).toMatchObject({ outcome: "error", errorType: "TypeError" });
    expect(JSON.stringify(entry)).not.toContain("private prompt text");
  });

  it("rejects dynamic operation labels", async () => {
    await expect(measureServerOperation("auth.user@example.test", async () => undefined)).rejects.toThrow(
      "static, lowercase identifiers"
    );
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
