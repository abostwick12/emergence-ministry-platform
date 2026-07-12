import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

import { POST as scriptureLookupPOST } from "@/app/api/student/scripture/lookup/route";
import { buildYouVersionReaderLink, lookupYouVersionPassage, readYouVersionConfig, sanitizeScriptureReference } from "@/lib/scripture/youversion";

function session(role = "student"): AuthSession {
  return {
    isMock: true,
    user: {
      id: "usr_student",
      email: "student@example.test",
      fullName: "Student User",
      role
    }
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/student/scripture/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("YouVersion config and reference normalization", () => {
  it("reports a clear missing-config state without exposing a key", () => {
    const config = readYouVersionConfig({});

    expect(config).toEqual({
      configured: false,
      apiBaseUrl: "https://api.youversion.com",
      bibleId: 3034,
      reason: "missing_app_key",
      message: "Scripture lookup is offline. You can still use the reading resources and starter passages."
    });
  });

  it("uses the configured server-only app key and trims the API base URL", () => {
    const config = readYouVersionConfig({
      YVP_APP_KEY: " app-key ",
      YOUVERSION_API_BASE_URL: "https://api.example.test/v1/"
    });

    expect(config).toEqual({
      configured: true,
      appKey: "app-key",
      apiBaseUrl: "https://api.example.test/v1",
      bibleId: 3034
    });
  });

  it("sanitizes natural references into YouVersion passage identifiers", () => {
    expect(sanitizeScriptureReference("John 3:16")).toEqual({ ok: true, reference: "John 3:16", passageId: "JHN.3.16" });
    expect(sanitizeScriptureReference("1 John 4:7")).toEqual({ ok: true, reference: "1 John 4:7", passageId: "1JN.4.7" });
    expect(sanitizeScriptureReference("JHN.3.16")).toEqual({ ok: true, reference: "JHN.3.16", passageId: "JHN.3.16" });
  });

  it("rejects empty, broad, and suspicious references", () => {
    expect(sanitizeScriptureReference("")).toMatchObject({ ok: false });
    expect(sanitizeScriptureReference("John")).toMatchObject({ ok: false });
    expect(sanitizeScriptureReference("John 3:16<script>")).toMatchObject({ ok: false });
  });

  it("builds Bible App reader links from natural references without exposing text", () => {
    expect(buildYouVersionReaderLink("John 1")).toMatchObject({
      ok: true,
      displayReference: "John 1",
      passageId: "JHN.1",
      versionCode: "NIV",
      url: "https://www.bible.com/bible/111/JHN.1.NIV"
    });
    expect(buildYouVersionReaderLink("Genesis 1-3")).toMatchObject({
      ok: true,
      displayReference: "Genesis 1",
      passageId: "GEN.1"
    });
  });
});

describe("YouVersion passage lookup adapter", () => {
  it("does not call YouVersion when the app key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupYouVersionPassage({ reference: "John 3:16" })).resolves.toEqual({
      ok: false,
      code: "not_configured",
      message: "Scripture lookup is offline. You can still use the reading resources and starter passages.",
      status: 503
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the documented passage endpoint with the app key header", async () => {
    vi.stubEnv("YOUVERSION_APP_KEY", "server-key");
    vi.stubEnv("YOUVERSION_API_BASE_URL", "https://api.example.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "JHN.3.16",
        content: "For God so loved the world.",
        reference: "John 3:16"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupYouVersionPassage({ reference: "John 3:16" });

    expect(result).toEqual({
      ok: true,
      passageId: "JHN.3.16",
      passage: {
        id: "JHN.3.16",
        content: "For God so loved the world.",
        reference: "John 3:16"
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://api.example.test/v1/bibles/3034/passages/JHN.3.16?format=text&include_headings=false&include_notes=false"),
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "X-YVP-App-Key": "server-key"
        }
      })
    );
  });
});

describe("Student Scripture lookup route", () => {
  it("requires an authenticated Student Hub session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await scriptureLookupPOST(jsonRequest({ reference: "John 3:16" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("keeps parent accounts out of the Student Scripture lookup route", async () => {
    getServerSessionMock.mockResolvedValue(session("parent"));

    const response = await scriptureLookupPOST(jsonRequest({ reference: "John 3:16" }));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/student scripture hub access/i);
  });

  it("returns a structured not-configured response instead of a server error", async () => {
    getServerSessionMock.mockResolvedValue(session("student"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await scriptureLookupPOST(jsonRequest({ reference: "John 3:16" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "not_configured",
      error: "Scripture lookup is offline. You can still use the reading resources and starter passages."
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns Scripture through the server route when configured", async () => {
    getServerSessionMock.mockResolvedValue(session("leader"));
    vi.stubEnv("YOUVERSION_APP_KEY", "server-key");
    vi.stubEnv("YOUVERSION_API_BASE_URL", "https://api.example.test/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: "JHN.3.16", reference: "John 3:16", content: "For God so loved the world." }))
    );

    const response = await scriptureLookupPOST(jsonRequest({ reference: "John 3:16" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      passageId: "JHN.3.16",
      passage: {
        id: "JHN.3.16",
        reference: "John 3:16",
        content: "For God so loved the world."
      }
    });
  });
});
