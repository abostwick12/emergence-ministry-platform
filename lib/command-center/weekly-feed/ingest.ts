// Reads the approved "SAGE Feed Sources" Google Drive folder tree and
// upserts a personal_knowledge_sources row for every new or changed file.
// Never scans anywhere else in Drive, never auto-runs -- only called from
// generateWeeklyFeed's manual "Generate Feed Now" trigger.

import { createHash } from "node:crypto";
import type { AuthSession } from "@/lib/auth/server";
import {
  findGoogleDriveFolderByName,
  getGoogleDriveFileContent,
  listGoogleDriveFilesInFolder,
  type GoogleDriveFileSummary
} from "@/lib/command-center/integrations/google-drive";
import { getValidGoogleDriveAccessToken } from "@/lib/command-center/integrations/google-drive-token";
import { getKnowledgeSourceByDriveFileId, upsertKnowledgeSource } from "@/lib/command-center/repository";
import { parseSourceNote } from "@/lib/command-center/weekly-feed/parse-source-note";
import type { KnowledgeSource, KnowledgeSourceType } from "@/lib/command-center/types";

export const SAGE_FEED_SOURCES_ROOT_FOLDER = "SAGE Feed Sources";

// Archive is intentionally omitted -- it's where Andrew moves things he's
// already reviewed, never re-ingested.
const SUBFOLDER_SOURCE_TYPES: Record<string, KnowledgeSourceType> = {
  Articles: "article",
  Podcasts: "podcast",
  Videos: "video",
  LinkedIn: "linkedin",
  "Weekly Reports": "report"
};

const READABLE_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "application/vnd.google-apps.document"]);

export class FeedSourceDriveUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("SAGE could not connect to the feed source folder. Try again later.");
    this.name = "FeedSourceDriveUnavailableError";
    if (cause instanceof Error) this.cause = cause;
  }
}

export class FeedSourceFolderNotFoundError extends Error {
  constructor() {
    super("SAGE Feed Sources folder was not found.");
    this.name = "FeedSourceFolderNotFoundError";
  }
}

// Analysis needs each source's parsed body, but personal_knowledge_sources
// only stores metadata (see migration 031) -- the raw note body is never
// persisted, only its distilled summary/analysis (personal_knowledge_items),
// so it's carried here transiently rather than round-tripped through the DB.
export type ChangedSource = { source: KnowledgeSource; body: string };

export type IngestResult = {
  filesScanned: number;
  filesImported: number;
  filesSkipped: number;
  errors: string[];
  changedSources: ChangedSource[];
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readFileRaw(params: { accessToken: string; file: GoogleDriveFileSummary }): Promise<string | null> {
  if (!READABLE_MIME_TYPES.has(params.file.mimeType)) return null;
  const { content } = await getGoogleDriveFileContent({
    accessToken: params.accessToken,
    fileId: params.file.id,
    mimeType: params.file.mimeType
  });
  return content;
}

export async function ingestFeedSources(session: AuthSession): Promise<IngestResult> {
  let accessToken: string;
  try {
    accessToken = await getValidGoogleDriveAccessToken(session);
  } catch (error) {
    throw new FeedSourceDriveUnavailableError(error);
  }

  let rootFolder;
  try {
    rootFolder = await findGoogleDriveFolderByName({ accessToken, name: SAGE_FEED_SOURCES_ROOT_FOLDER });
  } catch (error) {
    throw new FeedSourceDriveUnavailableError(error);
  }
  if (!rootFolder) throw new FeedSourceFolderNotFoundError();

  const result: IngestResult = { filesScanned: 0, filesImported: 0, filesSkipped: 0, errors: [], changedSources: [] };

  for (const [folderName, sourceType] of Object.entries(SUBFOLDER_SOURCE_TYPES)) {
    let subfolder;
    try {
      subfolder = await findGoogleDriveFolderByName({ accessToken, name: folderName, parentId: rootFolder.id });
    } catch (error) {
      result.errors.push(`Could not look up the "${folderName}" folder: ${error instanceof Error ? error.message : "unknown error"}`);
      continue;
    }
    if (!subfolder) continue;

    let files: GoogleDriveFileSummary[];
    try {
      files = await listGoogleDriveFilesInFolder({ accessToken, folderId: subfolder.id });
    } catch (error) {
      result.errors.push(`Could not list files in "${folderName}": ${error instanceof Error ? error.message : "unknown error"}`);
      continue;
    }

    for (const file of files) {
      result.filesScanned += 1;
      try {
        const raw = await readFileRaw({ accessToken, file });
        if (raw === null) {
          result.filesSkipped += 1;
          result.errors.push(`Skipped "${file.name}": unsupported file type (${file.mimeType}).`);
          continue;
        }

        const contentHash = hashContent(raw);
        const existing = await getKnowledgeSourceByDriveFileId(session, file.id);
        if (existing && existing.contentHash === contentHash) {
          continue; // unchanged -- dedupe, don't reimport
        }

        const parsed = parseSourceNote(raw);
        if (!parsed.ok) {
          result.filesSkipped += 1;
          result.errors.push(`Skipped "${file.name}": ${parsed.error}`);
          continue;
        }

        const source = await upsertKnowledgeSource(session, {
          googleDriveFileId: file.id,
          fileName: file.name,
          filePath: `${SAGE_FEED_SOURCES_ROOT_FOLDER}/${folderName}/${file.name}`,
          sourceType: parsed.note.frontmatter.sourceType ?? sourceType,
          title: parsed.note.frontmatter.title,
          sourceName: parsed.note.frontmatter.sourceName,
          authorOrHost: parsed.note.frontmatter.authorOrHost,
          url: parsed.note.frontmatter.url,
          dateFound: parsed.note.frontmatter.dateFound,
          lastModifiedAt: file.modifiedTime,
          contentHash
        });
        result.filesImported += 1;
        result.changedSources.push({ source, body: parsed.note.body });
      } catch (error) {
        result.filesSkipped += 1;
        result.errors.push(`Skipped "${file.name}": ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  }

  return result;
}
