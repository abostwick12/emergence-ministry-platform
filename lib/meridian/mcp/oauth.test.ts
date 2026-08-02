import { afterEach, describe, expect, it } from "vitest";

import {
  getMeridianBearerChallenge,
  getMeridianProtectedResourceMetadata,
  getMeridianPublicOrigin
} from "@/lib/meridian/mcp/oauth";
import { meridianMcpUnauthorizedResponse } from "@/lib/meridian/mcp/auth";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalVercelUrl = process.env.VERCEL_URL;
const originalProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const originalVercelEnvironment = process.env.VERCEL_ENV;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

describe("Meridian OAuth metadata", () => {
  afterEach(() => {
    restore("NEXT_PUBLIC_APP_URL", originalAppUrl);
    restore("VERCEL_URL", originalVercelUrl);
    restore("VERCEL_PROJECT_PRODUCTION_URL", originalProductionUrl);
    restore("VERCEL_ENV", originalVercelEnvironment);
    restore("NEXT_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
  });

  it("publishes the protected resource and Supabase authorization issuer", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.leademergence.com/";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co/";

    expect(getMeridianProtectedResourceMetadata()).toEqual({
      resource: "https://www.leademergence.com/mcp",
      authorization_servers: ["https://project.supabase.co/auth/v1"],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "Lead Emergence Meridian",
      resource_documentation: "https://www.leademergence.com/settings#meridian-personal-ai"
    });
  });

  it("keeps untrusted request hosts out of production discovery", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    expect(getMeridianPublicOrigin(new Request("https://attacker.example/mcp"))).toBe("https://www.leademergence.com");
    expect(getMeridianPublicOrigin(new Request("http://localhost:3100/mcp"))).toBe("http://localhost:3100");
  });

  it("keeps the canonical production domain ahead of Vercel deployment URLs", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "lead-emergence-random-hash.vercel.app";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "lead-emergence.vercel.app";

    expect(getMeridianPublicOrigin()).toBe("https://www.leademergence.com");
  });

  it("advertises discovery metadata in the bearer challenge", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.leademergence.com";
    expect(getMeridianBearerChallenge()).toContain('resource_metadata="https://www.leademergence.com/.well-known/oauth-protected-resource"');
    expect(getMeridianBearerChallenge()).toContain('scope="openid email profile"');
  });

  it("fails closed with an OAuth-discoverable 401 response", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.leademergence.com";
    const response = meridianMcpUnauthorizedResponse(new Request("https://www.leademergence.com/mcp"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
