import { isSensitiveCategory } from "./risk";
import {
  EMMA_CONTEXT_CATEGORIES,
  type ContextManifest,
  type ContextManifestEntry,
  type EmmaContextCategory
} from "./types";

// Builds the `context_manifest` stored on an ai_runs row. The manifest records
// ONLY which records EMMA referenced — never their contents. Sensitive data
// (message bodies, medical info, pastoral-care notes, parent contact details,
// student-sensitive notes, secrets) must never enter the manifest.
//
// Exclusion is enforced by allow-listing: we copy only the four safe fields from
// each entry, so any extra field a caller passes (body, email, phone, notes,
// content, etc.) is dropped, and any entry in a sensitive category is omitted
// entirely.

const ALLOWED_CATEGORY_SET: ReadonlySet<string> = new Set(EMMA_CONTEXT_CATEGORIES);

// Field names that must never be serialized into the manifest. Used by the
// defensive scanner below; the primary protection is allow-listing.
export const FORBIDDEN_MANIFEST_KEYS = [
  "body",
  "content",
  "message",
  "subject",
  "notes",
  "note",
  "email",
  "phone",
  "address",
  "fullName",
  "full_name",
  "medical",
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key"
] as const;

type RawManifestEntry = {
  recordId: string;
  recordType: string;
  category: string;
  sourceTable?: string | null;
  // Callers may pass richer objects; any extra keys are intentionally ignored.
  [key: string]: unknown;
};

/**
 * Produces a sanitized ContextManifest. Entries in unknown or sensitive
 * categories are dropped; only the safe identifying fields survive.
 */
export function buildContextManifest(rawEntries: RawManifestEntry[]): ContextManifest {
  const entries: ContextManifestEntry[] = [];

  for (const raw of rawEntries) {
    if (!raw || typeof raw.recordId !== "string" || typeof raw.category !== "string") {
      continue;
    }
    // Drop sensitive categories entirely; only allow known safe categories.
    if (isSensitiveCategory(raw.category) || !ALLOWED_CATEGORY_SET.has(raw.category)) {
      continue;
    }

    const entry: ContextManifestEntry = {
      recordId: raw.recordId,
      recordType: typeof raw.recordType === "string" ? raw.recordType : raw.category,
      category: raw.category as EmmaContextCategory
    };
    if (typeof raw.sourceTable === "string" && raw.sourceTable.length > 0) {
      entry.sourceTable = raw.sourceTable;
    }
    entries.push(entry);
  }

  return { entries };
}

/**
 * Defensive check: returns true if a value (e.g. a manifest about to be stored,
 * or a payload about to be logged) contains any forbidden key anywhere in its
 * structure. Used in tests and as an optional guard before persistence.
 */
export function containsForbiddenKeys(value: unknown): boolean {
  const forbidden: ReadonlySet<string> = new Set(FORBIDDEN_MANIFEST_KEYS.map((k) => k.toLowerCase()));

  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) {
      return node.some(walk);
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (forbidden.has(key.toLowerCase())) return true;
        if (walk(child)) return true;
      }
    }
    return false;
  };

  return walk(value);
}
