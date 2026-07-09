import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { FeedSourceDriveUnavailableError, FeedSourceFolderNotFoundError, ingestFeedSources } from "@/lib/command-center/weekly-feed/ingest";

const getValidGoogleDriveAccessToken = vi.fn();
const findGoogleDriveFolderByName = vi.fn();
const listGoogleDriveFilesInFolder = vi.fn();
const getGoogleDriveFileContent = vi.fn();
const getKnowledgeSourceByDriveFileId = vi.fn();
const upsertKnowledgeSource = vi.fn();

vi.mock("@/lib/command-center/integrations/google-drive-token", () => ({
  getValidGoogleDriveAccessToken: (...args: unknown[]) => getValidGoogleDriveAccessToken(...args)
}));
vi.mock("@/lib/command-center/integrations/google-drive", () => ({
  findGoogleDriveFolderByName: (...args: unknown[]) => findGoogleDriveFolderByName(...args),
  listGoogleDriveFilesInFolder: (...args: unknown[]) => listGoogleDriveFilesInFolder(...args),
  getGoogleDriveFileContent: (...args: unknown[]) => getGoogleDriveFileContent(...args)
}));
vi.mock("@/lib/command-center/repository", () => ({
  getKnowledgeSourceByDriveFileId: (...args: unknown[]) => getKnowledgeSourceByDriveFileId(...args),
  upsertKnowledgeSource: (...args: unknown[]) => upsertKnowledgeSource(...args)
}));

function session(): AuthSession {
  return { isMock: true, user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" } };
}

const validNote = `---
title: Test Article
source_type: article
url: https://example.com/a
---

Body content.`;

beforeEach(() => {
  vi.clearAllMocks();
  getValidGoogleDriveAccessToken.mockResolvedValue("at");
  getKnowledgeSourceByDriveFileId.mockResolvedValue(null);
  upsertKnowledgeSource.mockImplementation(async (_session: AuthSession, input: Record<string, unknown>) => ({
    id: "source_1",
    ...input
  }));
});

describe("ingestFeedSources", () => {
  it("throws FeedSourceDriveUnavailableError when Drive is not connected", async () => {
    getValidGoogleDriveAccessToken.mockRejectedValue(new Error("Google Drive is not connected."));
    await expect(ingestFeedSources(session())).rejects.toThrow(FeedSourceDriveUnavailableError);
    expect(findGoogleDriveFolderByName).not.toHaveBeenCalled();
  });

  it("throws FeedSourceFolderNotFoundError when the root folder doesn't exist", async () => {
    findGoogleDriveFolderByName.mockResolvedValue(null);
    await expect(ingestFeedSources(session())).rejects.toThrow(FeedSourceFolderNotFoundError);
  });

  it("scans every subfolder and imports a new, parseable file", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Articles" ? [{ id: "file_1", name: "note.md", mimeType: "text/markdown" }] : []
    );
    getGoogleDriveFileContent.mockResolvedValue({ content: validNote, truncated: false });

    const result = await ingestFeedSources(session());

    expect(result.filesScanned).toBe(1);
    expect(result.filesImported).toBe(1);
    expect(result.filesSkipped).toBe(0);
    expect(result.changedSources).toHaveLength(1);
    expect(upsertKnowledgeSource).toHaveBeenCalledWith(
      session(),
      expect.objectContaining({ googleDriveFileId: "file_1", title: "Test Article", sourceType: "article" })
    );
  });

  it("skips a file whose content hash matches an already-imported source (dedupe)", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Articles" ? [{ id: "file_1", name: "note.md", mimeType: "text/markdown" }] : []
    );
    getGoogleDriveFileContent.mockResolvedValue({ content: validNote, truncated: false });
    getKnowledgeSourceByDriveFileId.mockResolvedValue({
      id: "source_1",
      contentHash: createHash("sha256").update(validNote).digest("hex")
    });

    const result = await ingestFeedSources(session());

    expect(result.filesScanned).toBe(1);
    expect(result.filesImported).toBe(0);
    expect(result.changedSources).toHaveLength(0);
    expect(upsertKnowledgeSource).not.toHaveBeenCalled();
  });

  it("re-imports a file whose content hash has changed since last import", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Articles" ? [{ id: "file_1", name: "note.md", mimeType: "text/markdown" }] : []
    );
    getGoogleDriveFileContent.mockResolvedValue({ content: validNote, truncated: false });
    getKnowledgeSourceByDriveFileId.mockResolvedValue({ id: "source_1", contentHash: "stale-hash-does-not-match" });

    const result = await ingestFeedSources(session());

    expect(result.filesImported).toBe(1);
    expect(upsertKnowledgeSource).toHaveBeenCalled();
  });

  it("skips a file with malformed frontmatter without failing the whole run", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Articles" ? [{ id: "file_bad", name: "bad.md", mimeType: "text/markdown" }] : []
    );
    getGoogleDriveFileContent.mockResolvedValue({ content: "no frontmatter at all", truncated: false });

    const result = await ingestFeedSources(session());

    expect(result.filesScanned).toBe(1);
    expect(result.filesSkipped).toBe(1);
    expect(result.filesImported).toBe(0);
    expect(result.errors[0]).toContain("bad.md");
  });

  it("skips an unreadable file type without failing the whole run", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Articles" ? [{ id: "file_pdf", name: "scan.pdf", mimeType: "application/pdf" }] : []
    );

    const result = await ingestFeedSources(session());

    expect(result.filesSkipped).toBe(1);
    expect(getGoogleDriveFileContent).not.toHaveBeenCalled();
  });

  it("never scans the Archive folder", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name }: { name: string }) => ({ id: `folder_${name}`, name }));
    listGoogleDriveFilesInFolder.mockResolvedValue([]);

    await ingestFeedSources(session());

    const requestedFolderNames = findGoogleDriveFolderByName.mock.calls.map((call) => call[0].name);
    expect(requestedFolderNames).not.toContain("Archive");
  });

  it("continues scanning other subfolders when one folder isn't found", async () => {
    findGoogleDriveFolderByName.mockImplementation(async ({ name, parentId }: { name: string; parentId?: string }) => {
      if (!parentId) return { id: "folder_root", name };
      if (name === "Articles") return null;
      return { id: `folder_${name}`, name };
    });
    listGoogleDriveFilesInFolder.mockImplementation(async ({ folderId }: { folderId: string }) =>
      folderId === "folder_Podcasts" ? [{ id: "file_1", name: "note.md", mimeType: "text/markdown" }] : []
    );
    getGoogleDriveFileContent.mockResolvedValue({
      content: validNote.replace("source_type: article", "source_type: podcast"),
      truncated: false
    });

    const result = await ingestFeedSources(session());
    expect(result.filesImported).toBe(1);
  });
});
