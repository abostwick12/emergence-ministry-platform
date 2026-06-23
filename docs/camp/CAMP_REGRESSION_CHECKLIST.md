# Camp Regression Checklist

Copy and paste this checklist into any Camp-related PR prompt or code review. All items must pass before a Camp change is considered safe to merge.

Verified against codebase state as of 2026-06-23. Update this file when new routes, workflows, or access requirements are added.

---

## Navigation

- [ ] `/camp` loads for all roles — home dashboard renders without crash
- [ ] CampNav tabs (Home / Teams / EMMA / Roster / More) render correctly
- [ ] EMMA icon (`EmmaWaveOrb`) visible in nav for all roles
- [ ] CampAccessSwitcher hidden in production (`VERCEL_ENV=production`); visible only in dev/test
- [ ] `/camp/more` shows correct gated tool tiles — restricted tiles not visible to general leaders or drivers

---

## Roster

- [ ] `/camp/roster` displays student list
- [ ] Student cards show safe indicator tags (hasMedicalAlert, hasDietaryAlert, emergencyContactOnFile) — boolean badge only, no medical detail
- [ ] Search filters correctly
- [ ] Medication names, dosages, and restricted notes are NOT visible on any roster card

---

## Teams

- [ ] `/camp/teams` shows all teams with student counts
- [ ] `/camp/teams/[teamId]` shows correct team members and leader
- [ ] Student cards on team detail show safe tags only

---

## Schedule

- [ ] `/camp/schedule` shows correct schedule blocks for selected day
- [ ] `CampDaySelector` changes the day view

---

## Vehicles

- [ ] `/camp/vehicles` shows rider lists per vehicle
- [ ] Driver role shows only their own vehicle's riders

---

## My Team

- [ ] `/camp/my-team` shows team roster for leaders
- [ ] `/camp/my-team` shows vehicle riders (scoped) for drivers

---

## Safety (General Leader)

- [ ] `/camp/safety` renders `CampLeaderSafetyView`
- [ ] Safety view shows NO medication names, dosages, or medical notes
- [ ] Emergency contact field visible (boolean on-file indicator, not phone number) — confirm what is shown per product intent
- [ ] Boolean safe indicators (hasMedicalAlert, hasDietaryAlert) visible as flags, not as medical detail

---

## Forms and Documents

- [ ] `/camp/forms` renders without crash
- [ ] Document status shows form presence (received/missing) — not medical content

---

## Announcements (Placeholder — must not regress)

- [ ] `/camp/announcements` renders without crash
- [ ] Subtitle explicitly indicates it is a placeholder — confirm no new live features were accidentally added
- [ ] No restricted data is accessible from this page

---

## Checkout (Placeholder — must not regress)

- [ ] `/camp/checkout` renders without crash
- [ ] Vehicle/rider data displays for planning purposes
- [ ] Subtitle explicitly indicates return-home workflow is not yet live
- [ ] No restricted data is accessible from this page

---

## Medicine Intake (Restricted: Andrew / Jaci / Joel)

- [ ] `/camp/medicine-intake` requires restricted authentication — general leader gets 403
- [ ] Parent/guardian handoff signature pad (`SignaturePad`) renders and captures strokes
- [ ] Signature serializes as `json_strokes_v1` format in submission payload
- [ ] Intake form records medication details in restricted table
- [ ] Correction flow creates new row (does NOT overwrite the existing intake record)
- [ ] `supersedes_intake_id` links correction to prior record

---

## Medication Photo (Live backend; verify frontend status)

- [ ] `POST /api/camp/medication/photos` → uploads file and returns signed URL (backend)
- [ ] `GET /api/camp/medication/photos` → returns signed URL for viewing (backend)
- [ ] Frontend upload widget: confirm whether it is present in live intake pages or only in the orphaned `camp-command-center.tsx`
- [ ] If frontend gap remains, confirm it is documented in `docs/camp/CAMP_KNOWN_GAPS.md`

---

## Medication Schedule (Restricted)

- [ ] `/camp/medication-schedule` shows schedule items
- [ ] General leader → 403

---

## Medication History (Restricted)

- [ ] `/camp/medication-history` shows intake + admin + return audit records
- [ ] Corrected records show correction indicator with link to superseded row
- [ ] Voided records show void indicator (never disappear from history)
- [ ] General leader → 403

---

## Medical Quick View (Restricted)

- [ ] `/camp/medical-quick-view` shows boolean flags per student — no free-text medical detail
- [ ] General leader → 403

---

## Medical Command (Andrew Only)

- [ ] `/camp/medical-command` loads for Andrew only
- [ ] Medication time blocks display with correct state (Due / Completed / Needs Attention / Intake Missing)
- [ ] `CampDaySelector` functions on medical command page
- [ ] Jaci → 403 (Medical Command is Andrew-only — Jaci has restricted medical but NOT Medical Command)
- [ ] Joel → 403
- [ ] General leader → 403
- [ ] Driver → 403

---

## Administer Medicine (Andrew Only)

- [ ] `/camp/medical-command/administer` loads for Andrew only
- [ ] Student acknowledgement signature pad renders and captures strokes
- [ ] Signature stores as `DRAWN_INITIALS:JSON` when drawn
- [ ] Unavailable reason flow captures `"Unavailable/declined:<reason>"` string
- [ ] Constraint enforced: exactly one of (initials OR unavailable+reason) must be present
- [ ] Submitting creates an immutable administration log row (no UPDATE-in-place)
- [ ] Correction creates new log row linked via `supersedes_medication_administration_log_id`
- [ ] Jaci → 403 | Joel → 403 | Leader → 403

---

## Student Initials Signature

- [ ] Student acknowledgement initials on admin logs: confirm `student_acknowledgement_initials` field is present in schema (migration 015)
- [ ] Unavailable boolean + reason field present when student cannot sign
- [ ] Field NOT null in any submitted admin log

---

## Correction / Void History

- [ ] Medication intake corrections: new row links to prior via `supersedes_intake_id`
- [ ] Void records: `voided_at`, `voided_by_user_id`, `voided_by_name`, `void_reason` set — never null on voided records
- [ ] Hard delete is NOT available on any medication table through the UI
- [ ] History pages surface both active and voided/corrected records

---

## Settings and Import (Andrew Only)

- [ ] `/camp/settings` accessible for Andrew, 403 for all other roles
- [ ] `/camp/settings/import` loads file upload UI for Andrew
- [ ] XLSX worksheet selector appears for multi-sheet workbooks
- [ ] Import preview table renders new/matched/ambiguous/invalid/skipped rows
- [ ] **Ambiguous rows BLOCK the commit button** — do not silently skip
- [ ] Commit stores safe fields in `camp_campers` and restricted fields in `camp_restricted_medical_records` separately
- [ ] Non-Andrew users → 403 on all import API calls

---

## API Access Denial: General Leader

- [ ] `GET /api/camp/medication` → 403
- [ ] `POST /api/camp/medication` → 403
- [ ] `GET /api/camp/restricted-medical` → 403
- [ ] `GET /api/camp/medical-command` → 403
- [ ] `GET /api/camp/medication/photos` → 403
- [ ] `POST /api/camp/import` → 403
- [ ] `POST /api/camp/import/upload` → 403

---

## API Access Denial: Driver

- [ ] Same restricted API denials as general leader above

---

## API Access Denial: Joel

- [ ] `GET /api/camp/medical-command` → 403
- [ ] `POST /api/camp/import` → 403
- [ ] `POST /api/camp/import/upload` → 403
- [ ] `POST /api/camp/emma` with mode `smart_search` → 403

---

## Andrew (camp_admin) Access

- [ ] All restricted medical routes return data (not 403)
- [ ] `GET /api/camp/medical-command` returns time blocks
- [ ] `POST /api/camp/import` and `POST /api/camp/import/upload` succeed
- [ ] `GET /api/camp/access` returns member list
- [ ] `PATCH /api/camp/access` grants/revokes roles

---

## Jaci (medical_coordinator) Access

- [ ] Restricted medical routes return data
- [ ] `GET /api/camp/medical-command` → 403
- [ ] Import routes → 403
- [ ] `POST /api/camp/emma` with mode `smart_search` → OK (returns safe-flag data, not free text)

---

## Joel (restricted_assistant) Access

- [ ] Restricted medical routes return data
- [ ] `GET /api/camp/medical-command` → 403
- [ ] Import routes → 403
- [ ] `POST /api/camp/emma` with mode `smart_search` → 403 (Joel excluded from smart search)

---

## EMMA

- [ ] EMMA icon opens `CampEmmaSheet` for all roles
- [ ] `finder` mode: leader query returns team/room/vehicle/schedule data — no medication detail
- [ ] `finder` mode: query containing "medication", "dose", "insurance", etc. returns restricted-content refusal
- [ ] `smart_search` mode (Andrew / Jaci): returns safe flag indicators — NOT free-text medical notes
- [ ] `smart_search` mode requested by Joel → 403
- [ ] `andrew_medical` mode (Andrew, medicalCommandActive=true): returns time block summary — NOT dosages or signatures
- [ ] General leader with `smart_search` request → server downgrades to `finder` (mode normalized server-side)
- [ ] Unknown camper name query → "not found" response, not a full roster enumeration

---

## Role Preview (Dev / Preview Only)

- [ ] `CampAccessSwitcher` renders in non-production environments (local dev, E2E)
- [ ] `CampAccessSwitcher` does NOT render in production (`VERCEL_ENV=production`)
- [ ] Client `?role=` override ignored in production (server resolves from durable table or email)

---

## Append-Only Audit Invariants

- [ ] No hard deletes available on any medication table through the current UI
- [ ] Correction flows always create new rows, never UPDATE the original
- [ ] Voided records remain in history with void metadata visible
- [ ] `camp_access_audit` records all role changes (confirm row added after any role grant/revoke)
