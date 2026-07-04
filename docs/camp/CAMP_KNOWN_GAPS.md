# Camp Known Gaps

Verified from codebase inspection on 2026-06-23. These are **intentional or acknowledged gaps** — they are not regressions. Do not treat them as broken behavior.

When a gap is resolved by a future task, update this file and add the gap to the CAMP_BLUEPRINT.md change log.

---

## Gap 1: Medication Photo Frontend

**Status**: Live backend; frontend upload widget not yet present in live intake workflow.

**Details**:
- `POST /api/camp/medication/photos` (upload) and `GET /api/camp/medication/photos` (signed URL retrieval) are live API routes.
- The orphaned `components/camp-command-center.tsx` contains a photo management UI (modal, thumbnail view) but is not imported by any live route.
- The live intake workflow (`CampMedicineIntakeToolPage` in `components/camp/camp-tool-pages.tsx`) does not currently include a photo capture or upload widget.

**Risk**: Parents expecting to photograph medication containers have no live frontend to do so in the current Camp module.

**Resolution path**: Add a photo upload widget to the medicine intake page using the existing API routes. The storage bucket (`camp-medication-photos`) and photo metadata table (`camp_medication_photo_records`) are already in place.

---

## Gap 2: Announcements Page (Placeholder)

**Status**: Placeholder.

**Details**:
- `/camp/announcements` renders `CampAnnouncementsToolPage` which surfaces schedule items as leader signals.
- The component's subtitle explicitly states: "A focused announcement board is not live yet."
- There is no announcement creation, posting, or broadcasting workflow.

**Risk**: Leaders expecting a live announcement board will see only schedule signal items.

**Resolution path**: Define the announcement source (schedule blocks? Manual entry? Push notifications?) before implementing. Do not add features to this page without a focused design decision.

---

## Gap 3: Checkout / Return-Home Workflow (Placeholder)

**Status**: Placeholder.

**Details**:
- `/camp/checkout` renders `CampCheckoutToolPage` which displays vehicle/rider data.
- The component's subtitle explicitly states: "Return-home workflow is not split into a live checklist yet."
- There is no checkout confirmation, student release tracking, or guardian pickup workflow.

**Risk**: Staff expecting a live checkout checklist have no mechanism to confirm student release.

**Resolution path**: Design checkout workflow before implementation. Consider whether this integrates with medication return or is a separate student-release flow.

---

## Gap 4: Phase 2 Leader Safety Booleans

**Status**: Spec written; migration not applied.

**Details**:
- `docs/camp-leader-safety-phase-2-spec.md` proposes adding discrete boolean safety flags to `camp_campers`: `has_food_allergy_alert`, `has_epipen`, `has_inhaler`, `emergency_contact_on_file`.
- These booleans would allow leaders to see more specific (but still non-restricted) safety indicators without accessing medical free text.
- No migration has been applied. The spec is awaiting Andrew's approval.

**Risk**: General leaders currently receive a single `hasMedicalAlert` boolean with no distinction between allergy types or equipment needs.

**Resolution path**: Andrew reviews and approves `docs/camp-leader-safety-phase-2-spec.md` → apply migration → update intake import to set new fields → update leader safety view to display them.

---

## Gap 5: Import UI Warnings for Sibling Household IDs

**Status**: Backend detects; UI does not surface a callout.

**Details**:
- The parser handles Registration ID as a household-level ID (two siblings share an ID). This is expected Oakwood behavior.
- The backend generates a warning when the same Registration ID appears for multiple students.
- The import preview UI does not display a visible callout explaining that household ID sharing is normal and expected.

**Risk**: Import operators may incorrectly interpret sibling ID sharing as a data error and hesitate to commit, or may not notice an actual duplicate.

**Resolution path**: Add an informational notice to the import preview UI when Registration ID duplicates appear: "This Registration ID is shared by multiple students — this is normal for siblings."

---

## Gap 6: Import UI Column Validation Summary

**Status**: No pre-preview column list shown.

**Details**:
- The import UI does not show which of the 17 expected Quick View columns were found vs. missing in the uploaded file before the preview table renders.
- The parser generates backend warnings for missing recommended columns (Grade, Room Number, Team, Vehicle) but these may not be prominently surfaced in the UI.

**Risk**: An import from a different Oakwood export format (not the Quick View workbook) could silently produce a preview with many blank/warning rows without a clear explanation of which columns were unrecognized.

**Resolution path**: Display a column validation summary at the top of the import preview: which required/recommended columns were found, which were missing, and whether any unrecognized columns were detected.

---

## Gap 7: Durable Role Assignments May Be Empty

**Status**: Migration 014 applied; actual row grants depend on Andrew's action.

**Details**:
- `camp_access_members` table exists in the database (migration 014).
- The table is empty until Andrew explicitly grants roles via `PATCH /api/camp/access`.
- If no rows exist for Andrew, Jaci, or Joel, the system falls back entirely to email-based inference from migration 007.
- For most scenarios this fallback produces correct access, but it means the durable system is not actually in use yet.

**Risk**: If the email-based fallback is ever removed or tightened, users without durable assignments would lose access.

**Resolution path**: Andrew grants durable roles to himself, Jaci, and Joel via the access management API. Confirm assignments are in place before any deployment that modifies the fallback logic.

---

## Gap 8: Camp EMMA Search Not Audit-Logged

**Status**: Known architectural gap.

**Details**:
- The main EMMA workflows (`lib/emma/repository.ts`) create rows in `ai_requests`, `ai_runs`, `ai_action_proposals`, and `ai_approvals` for audit.
- The Camp EMMA route (`app/api/camp/emma/route.ts`) is a separate, lighter-weight deterministic route and does not log to those tables.
- Camp EMMA queries are not auditable after the fact.

**Risk**: No record of what questions leaders or restricted staff asked EMMA, which may be relevant for audit or security review if a data exposure concern arises.

**Resolution path**: If audit logging of Camp EMMA search queries is required, add a lightweight log record (query, access tier, timestamp) either to `ai_requests` or a Camp-specific search log table.

---

## Gap 9: No Return-to-Parent Signature Schema

**Status**: Needs verification.

**Details**:
- The parent/guardian **handoff** signature (medication received from parent at check-in) is fully live — stored in `camp_medication_intake_records.signature_data`.
- It is not confirmed from the current codebase inspection whether a separate **return** signature (parent receives medication back at checkout) has a dedicated schema field or UI.
- `camp_medication_return_items` has recipient fields (`recipient_name`, `recipient_relationship`, `return_notes`) but no signature field.

**Risk**: If a signature at medication return is a product requirement, neither the schema nor the UI currently supports it.

**Resolution path**: Confirm the product requirement for return signatures. If required, add `return_signature_data` to `camp_medication_return_items` and add a `SignaturePad` to the return workflow.

---

## Gap 10: Camp EMMA Command Route Duplication

**2026-07-04 update:** Provider-backed controlled action files now exist, but
there are multiple Camp EMMA command paths.

**Current details**:
- `.env.example` documents server-only Azure/OpenAI variables for Camp EMMA
  controlled action intent parsing.
- `lib/camp/emma-azure-provider.ts`, `lib/camp/emma-openai-provider.ts`,
  `lib/camp/emma-command-interpreter.ts`, and `lib/camp/emma-actions.ts` exist
  in the current branch.
- `app/api/camp/emma/actions` is the newer controlled action path with pending
  actions, confirmation, permission denial, and audit behavior.
- `app/api/camp/emma/command` and `app/api/camp/emma/confirm` still exist as
  legacy command/confirm slices.

**Current risk**: Maintaining multiple command paths makes it easier for access,
provider readiness, audit behavior, or sensitive-data filtering to drift.

**Current resolution path**: In a focused cleanup PR, choose the canonical Camp
EMMA action path, preserve any behavior still needed from legacy routes, update
E2E coverage, and deprecate or remove the redundant path only after proving no
live UI depends on it.

The following 2026-06-23 note is historical and superseded by the update above.

**Status**: `.env.example` has pre-existing uncommitted changes referencing files that do not exist.

**Details**:
- `.env.example` (pre-existing uncommitted modification, not caused by this doc scrub) adds four Azure OpenAI environment variables:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT`
  - `AZURE_OPENAI_API_VERSION`
- These variables are described as "Camp EMMA Azure OpenAI settings (SERVER-ONLY)" for a "Camp-scoped EMMA room-change command slice" that references `lib/camp/emma-command.ts` and `lib/camp/emma-azure-provider.ts`.
- **Neither file exists in the current working tree.**
- Cross-reference with memory: "Camp EMMA uncommitted recovery — Camp mobile+EMMA work NOT committed; recover via `git stash apply stash@{0}` on feat/camp-command-center-mobile-emma (files in stash^3). Don't drop that stash."

**Risk**: If these files are recovered from stash and introduced without a full access audit:
1. Restricted medical/medication data could be sent to an Azure OpenAI provider if the context is not sanitized
2. The Azure provider would represent a new live external API call with real secrets
3. The current access model documented in this blueprint was audited assuming NO external AI calls from Camp EMMA

**Resolution path**: Before recovering and merging the stashed Camp EMMA Azure work:
1. Andrew must explicitly approve introducing a live AI provider into Camp EMMA
2. The context passed to the provider must be audited against `EMMA_SENSITIVE_CATEGORIES` and restricted data boundaries
3. `.env.example` should only be updated at the same time as the implementation files are committed
4. This blueprint must be updated to reflect the new provider behavior

---

## Not a Gap: CampCommandCenter Orphan

`components/camp-command-center.tsx` (2338 lines) is intentionally orphaned — all its functionality has been superseded by the current route-based architecture. It is preserved in the repo as reference but is not a missing feature. See `docs/camp/CAMP_FEATURE_INVENTORY.md` for the orphaned component inventory.
