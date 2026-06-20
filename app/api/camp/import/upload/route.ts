import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { assertCampRestrictedAccess, resolveCampAccessContext } from "@/lib/camp/permissions";
import { getOakwoodUploadImportPreview } from "@/lib/camp/repository";
import { detectOakwoodWorkbook, extractOakwoodCsv, sha256Hex, MAX_OAKWOOD_UPLOAD_BYTES } from "@/lib/camp/oakwood-upload-source";

// Restricted Camp Oakwood registration-export upload. .xlsx/.csv are parsed
// server-side only; the original workbook is never persisted. Andrew/Jaci/Joel
// only. mode=inspect returns worksheet names (so a sheet can be chosen without
// guessing); mode=preview builds the real-name import preview.
export const runtime = "nodejs";

type UploadSlot = { field: string; scope: "full_roster" | "camper_only" | "staff_only"; sheetField: string };

const UPLOAD_SLOTS: UploadSlot[] = [
  { field: "combinedFile", scope: "full_roster", sheetField: "combinedSheet" },
  { field: "camperFile", scope: "camper_only", sheetField: "camperSheet" },
  { field: "staffFile", scope: "staff_only", sheetField: "staffSheet" }
];

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const XLSX_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

function validateUploadType(file: File): { ok: true } | { ok: false; status: number; error: string } {
  const name = file.name.trim().toLowerCase();
  const mimeType = file.type.trim().toLowerCase();
  if (name.endsWith(".csv") && CSV_MIME_TYPES.has(mimeType)) return { ok: true };
  if (name.endsWith(".xlsx") && XLSX_MIME_TYPES.has(mimeType)) return { ok: true };
  return { ok: false, status: 415, error: `${file.name} must be a .xlsx or .csv file with a matching file type.` };
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  // The role query param is a mock/dev Access Preview affordance only. Live
  // sessions are authorized from the authenticated server identity, never from
  // ?role=, the request body, local storage, or a client selector.
  const context = resolveCampAccessContext(session, session.isMock ? searchParams.get("role") : null);
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload of the Camp Oakwood registration export." }, { status: 400 });
  }

  const mode = String(form.get("mode") ?? "preview");
  const sourceNameValue = form.get("sourceName");
  const sourceName = typeof sourceNameValue === "string" && sourceNameValue.trim() ? sourceNameValue.trim() : undefined;

  const loaded: Array<{ slot: UploadSlot; fileName: string; buffer: Buffer; sheetName?: string }> = [];
  for (const slot of UPLOAD_SLOTS) {
    const value = form.get(slot.field);
    if (!(value instanceof File) || value.size === 0) continue;
    const typeCheck = validateUploadType(value);
    if (!typeCheck.ok) {
      return NextResponse.json({ error: typeCheck.error }, { status: typeCheck.status });
    }
    if (value.size > MAX_OAKWOOD_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${value.name} exceeds the ${Math.round(MAX_OAKWOOD_UPLOAD_BYTES / (1024 * 1024))} MB upload limit.` }, { status: 413 });
    }
    const sheetValue = form.get(slot.sheetField);
    loaded.push({
      slot,
      fileName: value.name,
      buffer: Buffer.from(await value.arrayBuffer()),
      sheetName: typeof sheetValue === "string" && sheetValue.trim() ? sheetValue.trim() : undefined
    });
  }

  if (loaded.length === 0) {
    return NextResponse.json({ error: "Attach a combined registration file, or a camper file and/or a staff file (.xlsx or .csv)." }, { status: 400 });
  }

  if (mode === "inspect") {
    const files = [];
    for (const item of loaded) {
      const detected = await detectOakwoodWorkbook({ fileName: item.fileName, buffer: item.buffer });
      if (!detected.ok) return NextResponse.json({ error: detected.error }, { status: detected.status });
      files.push({ slot: item.slot.field, scope: item.slot.scope, fileName: item.fileName, kind: detected.kind, sheetNames: detected.sheetNames });
    }
    return NextResponse.json({ files });
  }

  const sources: Array<{ scope: UploadSlot["scope"]; csv: string; fileName: string; checksumSha256: string; sheetName?: string }> = [];
  for (const item of loaded) {
    const extracted = await extractOakwoodCsv({ fileName: item.fileName, buffer: item.buffer }, { sheetName: item.sheetName });
    if (!extracted.ok) return NextResponse.json({ error: extracted.error }, { status: extracted.status });
    sources.push({
      scope: item.slot.scope,
      csv: extracted.csv,
      fileName: item.fileName,
      checksumSha256: sha256Hex(item.buffer),
      sheetName: extracted.sheetName ?? item.sheetName
    });
  }

  const payload = await getOakwoodUploadImportPreview(session, context, { sourceName, sources });
  if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
  return NextResponse.json({ preview: payload.preview });
}
