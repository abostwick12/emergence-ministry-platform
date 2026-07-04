import type { PersonalDomain } from "@/lib/command-center/types";

// Phase 1A helper: deterministic draft defaults for Andrew's manual review.
// This is not SAGE, not AI triage, and never creates a task automatically.
export function suggestCaptureDomain(rawText: string): PersonalDomain {
  if (/retir|\bva\b|military|army|dd-214|\btap\b|tricare|\bsbp\b/i.test(rawText)) return "military_transition";
  if (/sotf|fellowship|cohort/i.test(rawText)) return "sotf_fellowship";
  if (/job|resume|linkedin|interview|hire|recruiter|application/i.test(rawText)) return "job_search";
  return "life";
}

export function suggestCaptureTitle(rawText: string): string {
  const trimmed = rawText.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}
