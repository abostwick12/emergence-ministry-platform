import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleDriveAuthUrl,
  createGoogleDriveFolder,
  exchangeGoogleDriveCode,
  findOrCreateGoogleDriveFolder,
  getGoogleDriveFile,
  getGoogleDriveFileContent,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_READONLY_SCOPE,
  GoogleDriveConfigError,
  isGoogleDriveTokenExpired,
  listGoogleDriveFolders,
  moveGoogleDriveFile,
  parseStoredGoogleDriveTokens,
  readGoogleDriveConfig,
  refreshGoogleDriveAccessToken,
  searchGoogleDriveFiles
} from "@/lib/command-center/integrations/google-drive";

const configuredEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/command-center/integrations/google-drive/callback"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body))
  } as Response;
}

function textResponse(text: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => text } as Response;
}

describe("readGoogleDriveConfig", () => {
  it("reports not configured with the specific missing env vars", () => {
    const config = readGoogleDriveConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);
  });

  it("reports configured when all three shared Google OAuth env vars are present", () => {
    const config = readGoogleDriveConfig(configuredEnv);
    expect(config.configured).toBe(true);
  });
});

describe("buildGoogleDriveAuthUrl", () => {
  it("throws GoogleDriveConfigError when not configured", () => {
    expect(() => buildGoogleDriveAuthUrl({ state: "abc", env: {} })).toThrow(GoogleDriveConfigError);
  });

  it("requests drive.readonly and drive.metadata, never the broader drive scope", () => {
    const url = new URL(buildGoogleDriveAuthUrl({ state: "csrf-state", env: configuredEnv }));
    const scope = url.searchParams.get("scope");
    expect(scope).toContain(GOOGLE_DRIVE_READONLY_SCOPE);
    expect(scope).toContain(GOOGLE_DRIVE_METADATA_SCOPE);
    expect(scope).not.toMatch(/auth\/drive\s/);
    expect(scope).not.toBe("https://www.googleapis.com/auth/drive");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("exchangeGoogleDriveCode", () => {
  it("throws GoogleDriveConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeGoogleDriveCode({ code: "abc", env: {}, fetchImpl })).rejects.toThrow(GoogleDriveConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GOOGLE_DRIVE_READONLY_SCOPE }));
    const tokens = await exchangeGoogleDriveCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
  });
});

describe("refreshGoogleDriveAccessToken", () => {
  it("refreshes an access token using the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const refreshed = await refreshGoogleDriveAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(refreshed.accessToken).toBe("new-at");
  });
});

describe("isGoogleDriveTokenExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isGoogleDriveTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a comfortably future expiry as not expired", () => {
    expect(isGoogleDriveTokenExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe("parseStoredGoogleDriveTokens", () => {
  it("returns null for malformed or partial stored config", () => {
    expect(parseStoredGoogleDriveTokens({})).toBeNull();
    expect(parseStoredGoogleDriveTokens({ accessToken: "at" })).toBeNull();
  });

  it("parses a well-formed stored token record", () => {
    const parsed = parseStoredGoogleDriveTokens({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
    expect(parsed).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
  });
});

describe("searchGoogleDriveFiles", () => {
  it("requests metadata fields including parents, and excludes trashed files", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        files: [
          {
            id: "file_1",
            name: "SOTF reflection outline",
            mimeType: "application/vnd.google-apps.document",
            webViewLink: "https://drive.google.com/file_1",
            modifiedTime: "2026-07-01T00:00:00.000Z",
            parents: ["folder_1"]
          }
        ]
      })
    );

    const files = await searchGoogleDriveFiles({ accessToken: "at", query: "SOTF", fetchImpl });
    expect(files).toEqual([
      {
        id: "file_1",
        name: "SOTF reflection outline",
        mimeType: "application/vnd.google-apps.document",
        webViewLink: "https://drive.google.com/file_1",
        modifiedTime: "2026-07-01T00:00:00.000Z",
        parents: ["folder_1"]
      }
    ]);

    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("trashed+%3D+false");
    expect(calledUrl).toContain("parents");
  });

  it("escapes single quotes in the search query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    await searchGoogleDriveFiles({ accessToken: "at", query: "Andrew's plan", fetchImpl });
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("Andrew%5C%27s+plan");
  });

  it("throws when the search request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(searchGoogleDriveFiles({ accessToken: "expired", query: "x", fetchImpl })).rejects.toThrow("Google Drive search failed");
  });
});

describe("getGoogleDriveFile", () => {
  it("reads one file's metadata including parents", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "file_1", name: "Doc", mimeType: "text/plain", parents: ["folder_1"] }));
    const file = await getGoogleDriveFile({ accessToken: "at", fileId: "file_1", fetchImpl });
    expect(file.parents).toEqual(["folder_1"]);
  });
});

describe("getGoogleDriveFileContent", () => {
  it("exports a Google Doc as plain text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse("Reflection outline content."));
    const result = await getGoogleDriveFileContent({
      accessToken: "at",
      fileId: "file_1",
      mimeType: "application/vnd.google-apps.document",
      fetchImpl
    });
    expect(result).toEqual({ content: "Reflection outline content.", truncated: false });
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/export");
    expect(calledUrl).toContain("mimeType=text%2Fplain");
  });

  it("downloads a plain-text file directly via alt=media", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse("Just some notes."));
    const result = await getGoogleDriveFileContent({ accessToken: "at", fileId: "file_2", mimeType: "text/plain", fetchImpl });
    expect(result.content).toBe("Just some notes.");
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("alt=media");
  });

  it("truncates content longer than the safety limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse("a".repeat(5000)));
    const result = await getGoogleDriveFileContent({ accessToken: "at", fileId: "file_3", mimeType: "text/plain", fetchImpl });
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBe(4000);
  });

  it("refuses to read a folder's content", async () => {
    const fetchImpl = vi.fn();
    await expect(
      getGoogleDriveFileContent({ accessToken: "at", fileId: "folder_1", mimeType: "application/vnd.google-apps.folder", fetchImpl })
    ).rejects.toThrow("Cannot read the content of a folder");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses unsupported binary types instead of attempting to parse them", async () => {
    const fetchImpl = vi.fn();
    await expect(
      getGoogleDriveFileContent({ accessToken: "at", fileId: "file_4", mimeType: "application/pdf", fetchImpl })
    ).rejects.toThrow("not supported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("listGoogleDriveFolders / createGoogleDriveFolder / findOrCreateGoogleDriveFolder", () => {
  it("lists only folder-typed files", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ files: [{ id: "folder_1", name: "Job Search" }] }));
    const folders = await listGoogleDriveFolders({ accessToken: "at", fetchImpl });
    expect(folders).toEqual([{ id: "folder_1", name: "Job Search" }]);
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("application%2Fvnd.google-apps.folder");
  });

  it("creates a folder with the correct mimeType", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "folder_2", name: "New Folder" }));
    const folder = await createGoogleDriveFolder({ accessToken: "at", name: "New Folder", fetchImpl });
    expect(folder).toEqual({ id: "folder_2", name: "New Folder" });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: "New Folder", mimeType: "application/vnd.google-apps.folder" });
  });

  it("returns an existing folder by case-insensitive name instead of creating a duplicate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ files: [{ id: "folder_3", name: "Job Search" }] }));
    const folder = await findOrCreateGoogleDriveFolder({ accessToken: "at", name: "job search", fetchImpl });
    expect(folder).toEqual({ id: "folder_3", name: "Job Search" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("moveGoogleDriveFile", () => {
  it("finds or creates the target folder, then adds/removes parents accordingly", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "folder_4", name: "Job Search" }] }))
      .mockResolvedValueOnce(jsonResponse({ id: "file_1", parents: ["folder_4"] }));

    const folder = await moveGoogleDriveFile({
      accessToken: "at",
      fileId: "file_1",
      currentParents: ["folder_old"],
      folderName: "Job Search",
      fetchImpl
    });

    expect(folder).toEqual({ id: "folder_4", name: "Job Search" });
    const [moveUrl, moveInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(moveUrl).toContain("addParents=folder_4");
    expect(moveUrl).toContain("removeParents=folder_old");
    expect(moveInit.method).toBe("PATCH");
  });

  it("throws when the move request fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "folder_5", name: "Job Search" }] }))
      .mockResolvedValueOnce(jsonResponse({}, false, 404));
    await expect(
      moveGoogleDriveFile({ accessToken: "at", fileId: "missing", currentParents: [], folderName: "Job Search", fetchImpl })
    ).rejects.toThrow("Google Drive file move failed");
  });
});
