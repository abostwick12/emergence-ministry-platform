import { describe, expect, it } from "vitest";

import { canUseCampStubMode, isCampLaunchRuntime } from "@/lib/camp/runtime";

describe("Camp runtime mode", () => {
  it("does not treat explicit local e2e mock auth as launch runtime", () => {
    expect(isCampLaunchRuntime({
      E2E_MOCK_AUTH: "true",
      NODE_ENV: "development",
      VERCEL_ENV: "production"
    } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("allows stub mode for explicit local e2e mock auth even with a stale production Vercel env", () => {
    expect(canUseCampStubMode({
      E2E_MOCK_AUTH: "true",
      NODE_ENV: "development",
      VERCEL_ENV: "production"
    } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("blocks stub mode in real production runtime", () => {
    expect(canUseCampStubMode({
      E2E_MOCK_AUTH: "true",
      NODE_ENV: "production",
      VERCEL_ENV: "production"
    } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("blocks stub mode in preview without explicit local e2e mock auth", () => {
    expect(canUseCampStubMode({
      NODE_ENV: "development",
      VERCEL_ENV: "preview"
    } as NodeJS.ProcessEnv)).toBe(false);
  });
});
