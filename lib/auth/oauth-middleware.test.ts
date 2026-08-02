import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

describe("OAuth middleware routing", () => {
  it("lets MCP clients reach the route so it can return an OAuth challenge", async () => {
    const response = await middleware(new NextRequest("https://www.leademergence.com/mcp", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves the authorization request when sign-in is required", async () => {
    const response = await middleware(new NextRequest("https://www.leademergence.com/oauth/consent?authorization_id=request-123"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/oauth/consent?authorization_id=request-123");
  });

  it("keeps protected-resource discovery public", async () => {
    const response = await middleware(new NextRequest("https://www.leademergence.com/.well-known/oauth-protected-resource"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
