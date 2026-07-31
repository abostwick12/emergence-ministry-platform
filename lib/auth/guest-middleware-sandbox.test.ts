import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { authCookieNames } from "@/lib/auth/config";

const originalGuestWrites = process.env.GUEST_SANDBOX_WRITES_ENABLED;

describe("guest middleware sandbox allowlist", () => {
  afterEach(() => {
    process.env.GUEST_SANDBOX_WRITES_ENABLED = originalGuestWrites;
  });

  it("allows isolated event edits and preview-only generators", async () => {
    process.env.GUEST_SANDBOX_WRITES_ENABLED = "true";
    await expectStatus("/api/events/demo-event", 200, "PATCH");
    await expectStatus("/api/events/demo-event/generate-communications", 200, "POST");
  });

  it("keeps live event integrations and admin AI outside the sandbox", async () => {
    process.env.GUEST_SANDBOX_WRITES_ENABLED = "true";
    await expectStatus("/api/events/demo-event/google-drive-files/refresh", 403, "POST");
    await expectStatus("/api/events/demo-event/emma/summary", 403, "POST");
  });
});

async function expectStatus(pathname: string, status: number, method: string) {
  const request = new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: { cookie: `${authCookieNames.guestSession}=guest-session` }
  });
  expect((await middleware(request)).status).toBe(status);
}
