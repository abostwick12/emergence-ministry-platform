# Camp Leader Safety View — Phase 2 Spec (PROPOSAL — NOT APPLIED)

> **Gap status**: This proposal is documented as a known gap in [`docs/camp/CAMP_KNOWN_GAPS.md`](camp/CAMP_KNOWN_GAPS.md) (Gap 4). No migration has been applied as of 2026-06-23. Awaiting Andrew's approval before implementation.

Status: **Draft for Andrew's approval. No migration has been applied and no
workbook data has been imported.** Phase 1 (shipped on `feat/camp-leader-safety-view`)
adds the Leader Safety View using only data General Leaders already receive and
requires **no** schema or API change. This document specifies the *optional*
Phase 2 that would add discrete, accurate safety indicators that the current
data cannot honestly support.

## 1. Why Phase 2 exists

Phase 1 can truthfully show, for each camper, only:

- name, photo (initials), grade, team, cabin
- "Medication on file — contact medical lead" (generic boolean)
- "Medical support on file — contact medical lead" (generic boolean)
- "Form follow-up needed" (generic boolean)
- "Contact Andrew, Jaci, or Joel" guidance

It **cannot** show a food-allergy alert, an EpiPen/inhaler indicator, or an
emergency-contact action, because no discrete, leader-safe field for those
exists. `has_restricted_medical_info` is a single generic flag, and the
specifics live only in restricted free-text (`allergy_notes`) or in the
restricted registration export. Inventing those indicators from generic data would violate the
"do not invent or infer safety statuses" rule.

Phase 2 makes them honest by introducing **discrete boolean flags that
restricted staff set explicitly**, exposed to leaders as booleans only.

## 2. Core principle

- Leaders receive **booleans only** (presence/true-false). Never free-text,
  never the underlying medical content.
- Booleans are **set by restricted staff** (Andrew/Jaci/Joel) through the
  existing restricted workflow — never auto-parsed from medical notes, and never
  set by a General Leader.
- Raw medical/dietary text continues to live **only** in
  `camp_restricted_medical_records` (Andrew/Jaci/Joel via RLS).
- The uploaded registration export is transient; Supabase stores only the
  approved normalized fields plus audit metadata.

## 3. Proposed migration `013_camp_leader_safety_flags.sql` (additive, idempotent)

```sql
-- 013_camp_leader_safety_flags.sql  (PROPOSAL)
-- Additive, non-destructive. Adds discrete, leader-safe boolean indicators set
-- by restricted staff. No medical free-text is added to camp_campers. RLS for
-- camp_campers is unchanged (ministry-readable); these columns are booleans and
-- safe for general leaders by design.

alter table public.camp_campers
  add column if not exists has_food_allergy_alert   boolean not null default false,
  add column if not exists has_epipen               boolean not null default false,
  add column if not exists has_inhaler              boolean not null default false,
  add column if not exists emergency_contact_on_file boolean not null default false;

notify pgrst, 'reload schema';
```

Notes:
- These are the *only* new columns. Specific allergy/medication text stays in the
  restricted tables.
- `camp_campers` is already `select`-able by the ministry under existing RLS;
  exposing four additional booleans does not weaken any restricted boundary.
- Setting these booleans is gated behind the restricted-staff write paths (a
  General Leader cannot write `camp_campers` safety flags — roster edit already
  blocks drivers and the restricted setter would assert `canAccessRestricted`).

## 4. API / type changes (kept boolean-only)

- `CampStudentPublic` / `CampVisibleStudent`: add `hasFoodAllergyAlert`,
  `hasEpiPen`, `hasInhaler`, `emergencyContactOnFile` (all optional booleans).
- `lib/camp/access.ts#getCampVisibleStudentsForData` (non-driver branch only):
  pass the four booleans through. **Driver branch stays at its current 5 fields.**
- `lib/camp/repository.ts#toCampStudentPublic` + the `CampCamperRow` type: map the
  four new columns.
- `lib/camp/leader-safety.ts`: add calm labels:
  - `has_food_allergy_alert` → "Allergy alert on file"
  - `has_epipen` → "EpiPen on file"
  - `has_inhaler` → "Inhaler on file"
  - `emergency_contact_on_file` → "Emergency contact on file" (optionally a
    controlled action that **does not reveal the number** — TBD, needs design)
- A restricted-staff setter (extend the existing restricted-medical workflow in
  `More`) to toggle the booleans. No General Leader write path.

No change to Medical Command (stays Andrew-only). No change to the medication,
intake, signature, photo, or audit flows.

## 5. Registration export mapping (`Camp_Quick_View_2`)

| Workbook column | Classification | Phase 2 target |
|---|---|---|
| First/Last Name, Name | safe | `camp_campers.name` |
| Grade | safe | `grade` |
| Room Number | safe | `cabin` |
| Quick Filter (e.g. "Medical + Food/Diet") | derived alert level | informs restricted staff which booleans to set — **not** stored verbatim |
| Medical Notes | restricted free-text | `camp_restricted_medical_records.restricted_notes` (Andrew/Jaci/Joel only) |
| Dietary Requirements | restricted free-text | `camp_restricted_medical_records.allergy_notes` (restricted) |
| "Any other important information…" | restricted free-text | restricted notes |
| Emergency Contact (name + phone) | restricted PII | drives `emergency_contact_on_file` boolean; number stays restricted |
| Registration Contact (name/phone/email/address) | restricted PII | not imported to leader-facing fields |
| All phone / email / address columns | restricted PII | not imported to leader-facing fields |
| Birthdate, Age, Gender, Registration ID | restricted PII | not imported to leader-facing fields |
| All payment columns (Cost, Paid, Balance, Paid by…) | **source-only** | **never imported** |
| T-Shirt Size | operational, non-safety | optional, out of scope |

**Leak guarantee:** the general-leader payload after Phase 2 still contains
**zero** phone, address, email, guardian, payment, medication, medical free-text,
dietary free-text, or signature data — only camper name/photo/grade/team/cabin
and the safety booleans.

## 6. Import workflow (requires explicit approval per step)

1. Restricted staff upload an approved `.xlsx` or `.csv` export through the
   restricted Oakwood import preview.
2. A restricted-only, preview-first importer maps **safe** columns to
   `camp_campers` / `camp_staff` and **restricted** camper columns to
   `camp_restricted_medical_records`.
3. The preview shows real names and source metadata while keeping raw
   medical/contact text out of leader-facing views.
4. Payments, addresses, phones, emails, guardian PII are **dropped at preview**
   and never written.
5. No workbook file is uploaded to Supabase Storage. Only filename, SHA-256,
   worksheet, reviewer, timestamp, and counts are retained for audit.

## 7. Approval gates (all blocked pending Andrew)

- [ ] Approve adding columns (migration 013) and confirm target Supabase project.
- [ ] Approve the four indicators + labels (and whether to include a controlled
      emergency-contact action).
- [ ] Approve the restricted-only import mapping before any data is written.
- [ ] Confirm the approved source export is handled only by Andrew/Jaci/Joel.

Until these are approved, Phase 2 remains a written proposal only.
