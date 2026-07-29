import type { ResourceType } from "@/lib/resources/types";

const executableExtensions = new Set([
  "app",
  "bat",
  "bin",
  "cmd",
  "com",
  "dll",
  "dmg",
  "elf",
  "exe",
  "hta",
  "html",
  "jar",
  "js",
  "jsx",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
  "ts",
  "tsx",
  "vbs",
  "wsf"
]);

const officeMimeByExtension: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const resourceTypeByMime: Record<string, ResourceType> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "video/mp4": "video",
  "text/plain": "document",
  "text/csv": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet"
};

export type ValidatedResourceFile = {
  fileSizeBytes: number;
  mimeType: string;
  originalFilename: string;
  resourceType: ResourceType;
  safeFilename: string;
};

export function getMaxResourceAttachmentBytes() {
  const configured = Number.parseInt(process.env.RESOURCE_ATTACHMENT_MAX_FILE_SIZE_MB ?? "", 10);
  const megabytes = Number.isFinite(configured) && configured > 0 ? configured : 25;
  return megabytes * 1024 * 1024;
}

export function validateResourceFile(input: { bytes: Buffer; filename: string; declaredMimeType?: string }): ValidatedResourceFile {
  const safeFilename = validateResourceUploadFilename(input.filename);
  const extension = extensionFor(safeFilename);

  if (input.bytes.length <= 0) {
    throw new ResourceFileValidationError("Choose a non-empty file.", 400, "empty_file");
  }

  const maxBytes = getMaxResourceAttachmentBytes();
  if (input.bytes.length > maxBytes) {
    throw new ResourceFileValidationError(`Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`, 400, "file_too_large");
  }

  const signature = detectMimeType(input.bytes, extension);
  if (!signature) {
    throw new ResourceFileValidationError("This file type is not supported.", 400, "unsupported_file_type");
  }

  if (isExecutableMagic(input.bytes)) {
    throw new ResourceFileValidationError("Executable files cannot be uploaded.", 400, "executable_file");
  }

  const resourceType = resourceTypeByMime[signature] ?? "other";
  return {
    fileSizeBytes: input.bytes.length,
    mimeType: signature,
    originalFilename: input.filename,
    resourceType,
    safeFilename
  };
}

export function validateResourceUploadFilename(filename: string) {
  const safeFilename = sanitizeFilename(filename);
  const extension = extensionFor(safeFilename);
  if (executableExtensions.has(extension)) {
    throw new ResourceFileValidationError("Executable and script files cannot be uploaded.", 400, "executable_file");
  }
  return safeFilename;
}

export function sanitizeFilename(filename: string) {
  const rawName = filename.split(/[\\/]/).pop()?.trim() || "resource";
  const normalized = rawName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 140);
  const fallback = normalized || "resource";
  return fallback.includes(".") ? fallback : `${fallback}.bin`;
}

export function extensionFor(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match?.[1]?.toLowerCase() ?? "";
}

function detectMimeType(bytes: Buffer, extension: string): string | undefined {
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  if (bytes.length >= 3 && bytes.subarray(0, 3).toString("ascii") === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return officeMimeByExtension[extension];
  }
  if (isPlainText(bytes)) return extension === "csv" ? "text/csv" : "text/plain";
  return undefined;
}

function isExecutableMagic(bytes: Buffer) {
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString("ascii") === "MZ") return true;
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return true;
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0xcf, 0xfa, 0xed, 0xfe]))) return true;
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString("ascii") === "#!") return true;
  return false;
}

function isPlainText(bytes: Buffer) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let printable = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    if (byte === 0) return false;
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e)) {
      printable += 1;
    }
  }
  return sample.length > 0 && printable / sample.length > 0.92;
}

export class ResourceFileValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "resource_file_validation_error"
  ) {
    super(message);
  }
}
