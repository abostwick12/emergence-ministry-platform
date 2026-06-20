import { createHash } from "crypto";
import ExcelJS from "exceljs";

// Server-only parsing for the restricted Camp Oakwood registration-export upload.
// Parses .xlsx (via exceljs) and .csv entirely in memory. The original workbook is
// NEVER persisted; callers retain only the filename + SHA-256 + sheet + counts.
// This module must only be imported by server code (it uses Node crypto + exceljs).

export const MAX_OAKWOOD_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file.

export type OakwoodUploadFile = { fileName: string; buffer: Buffer };

type DetectResult =
  | { ok: true; kind: "csv" | "xlsx"; sheetNames: string[] }
  | { ok: false; status: number; error: string };

type ExtractResult =
  | { ok: true; csv: string; sheetName?: string; rowCount: number }
  | { ok: false; status: number; error: string };

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isXlsx(fileName: string): boolean {
  return /\.xlsx$/i.test(fileName.trim());
}

function isCsv(fileName: string): boolean {
  return /\.csv$/i.test(fileName.trim());
}

function assertUploadSize(buffer: Buffer): { ok: true } | { ok: false; status: number; error: string } {
  if (buffer.length === 0) return { ok: false, status: 422, error: "Uploaded file is empty." };
  if (buffer.length > MAX_OAKWOOD_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: `Uploaded file exceeds the ${Math.round(MAX_OAKWOOD_UPLOAD_BYTES / (1024 * 1024))} MB limit.` };
  }
  return { ok: true };
}

// Detect file kind and, for .xlsx, the worksheet names so the user can choose a
// sheet. We never guess which sheet is correct.
export async function detectOakwoodWorkbook(file: OakwoodUploadFile): Promise<DetectResult> {
  const size = assertUploadSize(file.buffer);
  if (!size.ok) return size;
  if (isCsv(file.fileName)) return { ok: true, kind: "csv", sheetNames: [] };
  if (!isXlsx(file.fileName)) return { ok: false, status: 415, error: "Only .xlsx and .csv registration exports are supported." };
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toArrayBuffer(file.buffer));
    const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);
    if (sheetNames.length === 0) return { ok: false, status: 422, error: "The uploaded workbook has no worksheets." };
    return { ok: true, kind: "xlsx", sheetNames };
  } catch {
    return { ok: false, status: 422, error: "The uploaded .xlsx file could not be read." };
  }
}

// Extract the chosen sheet (or the csv) into CSV text the import engine can parse.
export async function extractOakwoodCsv(file: OakwoodUploadFile, options: { sheetName?: string } = {}): Promise<ExtractResult> {
  const size = assertUploadSize(file.buffer);
  if (!size.ok) return size;

  if (isCsv(file.fileName)) {
    const csv = file.buffer.toString("utf8").replace(/^﻿/, "");
    return { ok: true, csv, rowCount: countCsvRows(csv) };
  }
  if (!isXlsx(file.fileName)) return { ok: false, status: 415, error: "Only .xlsx and .csv registration exports are supported." };

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toArrayBuffer(file.buffer));
    let worksheet: ExcelJS.Worksheet | undefined;
    if (!options.sheetName) return { ok: false, status: 422, error: "Choose a worksheet to preview the uploaded workbook." };
    worksheet = workbook.worksheets.find((sheet) => sheet.name === options.sheetName);
    if (!worksheet) return { ok: false, status: 422, error: `Worksheet "${options.sheetName}" was not found in the uploaded workbook.` };
    const csv = worksheetToCsv(worksheet);
    return { ok: true, csv, sheetName: worksheet.name, rowCount: countCsvRows(csv) };
  } catch {
    return { ok: false, status: 422, error: "The uploaded .xlsx file could not be read." };
  }
}

function worksheetToCsv(worksheet: ExcelJS.Worksheet): string {
  const lines: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values : [];
    const cells: string[] = [];
    // exceljs row.values is 1-indexed (index 0 is unused).
    for (let column = 1; column < values.length; column += 1) {
      cells.push(cellToString(values[column]));
    }
    lines.push(cells.map(csvCell).join(","));
  });
  return lines.join("\n");
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.richText)) return record.richText.map((part) => (part as { text?: string }).text ?? "").join("");
    if (record.result !== undefined && record.result !== null) return String(record.result);
    if (typeof record.hyperlink === "string") return record.hyperlink;
    return "";
  }
  return String(value);
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function countCsvRows(csv: string): number {
  return csv.split(/\r?\n/).filter((line) => line.trim()).length;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
