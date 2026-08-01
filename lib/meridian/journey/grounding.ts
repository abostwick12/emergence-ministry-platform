export type JourneyAnchorValidation =
  | { ok: true }
  | { ok: false; reason: "missing_reading_path" | "scripture_anchor_substituted"; expected?: string; actual?: string };

export function validateJourneyScriptureAnchor(
  requestedReference: string | undefined,
  readingPath: Array<{ reference: string }>
): JourneyAnchorValidation {
  if (!readingPath.length) return { ok: false, reason: "missing_reading_path" };
  const requested = normalizeReference(requestedReference ?? "");
  if (!requested) return { ok: true };
  const actual = normalizeReference(readingPath[0]?.reference ?? "");
  const anchorMatches = actual === requested || (!requested.includes("-") && actual.startsWith(`${requested}-`));
  if (!anchorMatches) {
    return {
      ok: false,
      reason: "scripture_anchor_substituted",
      expected: requestedReference?.trim(),
      actual: readingPath[0]?.reference
    };
  }
  return { ok: true };
}

function normalizeReference(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, "").trim();
}
