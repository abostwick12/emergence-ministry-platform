# Camp Blueprint — Lead Emergence Automated Platform

> **Pre-development rule**: Before making any Camp change, read this file. Then read:
> - `docs/camp/CAMP_ACCESS_MODEL.md` — access roles and enforcement
> - `docs/camp/CAMP_REGRESSION_CHECKLIST.md` — required checks before any Camp PR
> - `docs/camp/CAMP_FEATURE_INVENTORY.md` — route-by-route and component-by-component inventory

---

## 1. Product Purpose

The Camp module is the operational command center for Camp Oakwood 2026 (June 29 – July 3). It gives ministry staff and leaders a real-time view of the camp roster, teams, schedule, vehicles, safety flags, and medication workflows from mobile-friendly pages.

This is not a general camp management product. It is purpose-built for EMERGE at Community Life Church to run one specific camp event with a known roster.

---

## 2. Non-Negotiable Design Principles

These rules must be preserved across every future Camp change:

1. **Medication and insurance data is restricted to Andrew, Jaci, and Joel — server-enforced.** No UI gating alone is sufficient. API routes must call `assertCampRestrictedAccess()` or equivalent before any restricted data is fetched.

2. **Medical Command is Andrew-only.** Jaci and Joel retain restricted medical access but must never reach the Medical Command dashboard or medication administration pages. `assertCampMedicalCommandAccess()` and `assertCampAdminAccess()` enforce this server-side.

3. **General leaders and drivers see only safe operational information.** No medication names, dosages, medical notes, insurance, guardian phone numbers, or restricted dietary free text. Safe indicators (boolean flags: hasMedicalAlert, hasDietaryAlert, emergencyContactOnFile) are the maximum information a leader receives.

4. **Durable role table (`camp_access_members`) is authoritative in production.** The legacy email-inference fallback (migration 007) exists only for transitional rollout. Once all named users have durable assignments, the email fallback is redundant. Do not remove it until that is confirmed.

5. **Production role override is blocked.** `isCampRolePreviewEnabled()` returns false in production (`VERCEL_ENV=production`). Client `?role=` params are ignored. Only the durable assignment or server-resolved email match determines access.

6. **EMMA must respect access boundaries.** The Camp EMMA route gates modes by `restrictedActor`. `finder` mode is safe-only. `smart_search` and `ask_emma` modes are restricted to Andrew and Jaci only. Andrew in Medical Command mode (`andrew_medical`) is the only access tier allowed to receive medication time block data from EMMA.

7. **Corrections and voids are append-only.** No hard deletes on medication tables. Corrections create new rows linked via `supersedes_*_id` fields. Voided records retain `voided_at`, `voided_by_user_id`, `voided_by_name`, `void_reason` immutably.

8. **Import parser never fabricates values.** Blank source fields (Team, Vehicle, Room) stay blank in the DB. Registration ID is treated as a household-level ID, not a unique person key.

9. **Safe indicators come only from Quick Filter category.** `hasMedicalAlert` and `hasDietaryAlert` are derived from the explicit Quick Filter category field (or presence of a restricted note) — never by parsing free-text medical content.

10. **Signature pads must not be removed.** Parent/guardian handoff signature (medicine intake) and student acknowledgement initials (medication administration) are live workflow requirements.

---

## 3. Route / Page Inventory

See `docs/camp/CAMP_FEATURE_INVENTORY.md` for full detail. Summary:

**Verified route count: 20 page routes** (from `app/(app)/camp/**`) as of 2026-06-23.

Status legend:
- **Live** — route renders and the full workflow is functional
- **Placeholder** — route is live and renders without error, but the workflow it hosts is incomplete (e.g., no form submission, no confirmation step). A placeholder is not orphaned — it is reachable, navigable, and intentionally present. Do not remove placeholder pages.
- **Orphaned** — file exists in the repo but is not imported or reachable by any live route. Only `components/camp-command-center.tsx` is orphaned.

| Route | Access | Status |
|---|---|---|
| `/camp` | All roles | Live |
| `/camp/roster` | All roles | Live |
| `/camp/teams` | All roles | Live |
| `/camp/teams/[teamId]` | All roles | Live |
| `/camp/schedule` | All roles | Live |
| `/camp/vehicles` | All roles | Live |
| `/camp/forms` | All roles | Live |
| `/camp/my-team` | All roles (scoped) | Live |
| `/camp/more` | All roles (gated tiles) | Live |
| `/camp/safety` | All roles | Live |
| `/camp/announcements` | All roles | Placeholder |
| `/camp/checkout` | All roles | Placeholder |
| `/camp/settings` | Andrew only | Live |
| `/camp/settings/import` | Andrew only | Live |
| `/camp/medical-command` | Andrew only | Live |
| `/camp/medical-command/administer` | Andrew only | Live |
| `/camp/medicine-intake` | Andrew / Jaci / Joel | Live |
| `/camp/medication-schedule` | Andrew / Jaci / Joel | Live |
| `/camp/medication-history` | Andrew / Jaci / Joel | Live |
| `/camp/medical-quick-view` | Andrew / Jaci / Joel | Live |

---

## 4. Access Model Summary

See `docs/camp/CAMP_ACCESS_MODEL.md` for full detail.

| Role | DB Tier | Capabilities |
|---|---|---|
| `camp_admin` (Andrew) | migration 014 | Full: Medical Command + import + restricted medical + EMMA smart search + access management |
| `medical_coordinator` (Jaci) | migration 014 | Restricted medical workflows + EMMA smart search; NO Medical Command |
| `restricted_assistant` (Joel) | migration 014 | Restricted medical workflows only; NO EMMA smart search, NO Medical Command |
| `leader` | migration 014 | Safe operational only |
| `driver` | migration 014 | Safe operational + vehicle-scoped |

Fallback: legacy email inference (migration 007) fires only when no durable assignment exists.

---

## 5. Core Workflows

1. **Roster management** — view, search, and assign students to teams and vehicles
2. **Team view** — per-team roster with leader and missing-assignment counts
3. **Schedule view** — day-by-day schedule with day selector
4. **Vehicle / transportation view** — rider lists per vehicle
5. **Safety view** — leader-safe boolean alerts and emergency contact (no medication detail)
6. **Medicine intake** — restricted staff receive medications from parents; parent signature collected; restricted notes recorded
7. **Medication administration** — Andrew administers scheduled medications; student acknowledgement/initials collected
8. **Medication return** — restricted staff return medications to parent/guardian
9. **Medication schedule view** — restricted staff view upcoming medication windows
10. **Medication history / audit** — correction, void, and administration audit trail
11. **Oakwood import** — Andrew uploads "Quick View" workbook; parser previews; admin commits safe + restricted fields separately
12. **EMMA Camp search** — natural-language query against safe data (all roles) or restricted-safe flags (Andrew/Jaci)

---

## 6. Data Objects (Key Tables)

| Table | Restricted? | Description |
|---|---|---|
| `camp_sessions` | No | Camp session metadata |
| `camp_teams` | No | Teams with leader and room |
| `camp_vehicles` | No | Vehicles with driver and capacity |
| `camp_campers` | No | Student roster with safe indicators |
| `camp_staff` | No | Staff roster (no medical data) |
| `camp_restricted_medical_records` | Yes | Emergency contact, guardian, insurance, dietary, medical notes |
| `camp_medication_records` | Yes | Medication metadata (check-in, clarification) |
| `camp_medication_schedule_items` | Yes | Scheduled medication windows |
| `camp_medication_administration_logs` | Yes | Administration audit (immutable) |
| `camp_medication_intake_records` | Yes | Parent handoff records with signature (append-only) |
| `camp_medication_photo_records` | Yes | Photo metadata registry |
| `camp_medication_return_items` | Yes | Medication return audit |
| `camp_import_batches` | Yes (post-008) | Import audit (source checksum, row counts) |
| `camp_access_members` | Admin-only | Durable user → role assignments |
| `camp_access_audit` | Admin-only | Role change audit |

---

## 7. API Inventory

| Endpoint | Method | Access | Purpose |
|---|---|---|---|
| `/api/camp` | GET | All auth | Camp overview (teams, schedule, students, docs, vehicles) |
| `/api/camp/medication` | GET | Restricted | Restricted medication payload |
| `/api/camp/medication` | POST | Restricted | Log intake, admin, void |
| `/api/camp/medication` | PATCH | Restricted | Update return items |
| `/api/camp/medication/photos` | GET | Restricted | Signed URL for photo |
| `/api/camp/medication/photos` | POST | Restricted | Upload medication photo |
| `/api/camp/restricted-medical` | GET | Restricted | Restricted medical records |
| `/api/camp/restricted-medical` | PATCH | Restricted | Update restricted medical record |
| `/api/camp/medical-command` | GET | Andrew only | Medication time blocks with state |
| `/api/camp/students` | GET / POST / PATCH | Staff | Roster CRUD and assignments |
| `/api/camp/access` | GET / PATCH | Andrew only | List and manage role assignments |
| `/api/camp/emma` | POST | Role-gated | EMMA Camp search |
| `/api/camp/import` | POST | Andrew only | Oakwood import preview/commit |
| `/api/camp/import/upload` | POST | Andrew only | Oakwood workbook file inspect |

---

## 8. AI / EMMA Behavior Summary

See `docs/camp/CAMP_AI_EMMA_BEHAVIOR.md` for full detail.

- Entry point: `CampEmmaSheet` (bottom-sheet modal triggered from `CampNav`)
- Route: `POST /api/camp/emma`
- Modes: `finder` (all), `smart_search` (Andrew + Jaci only), `ask_emma` (Andrew + Jaci only)
- Access tiers: `leader`, `jaci`, `andrew_operations`, `andrew_medical`
- Restricted needles blocked from non-andrew_medical access: medication, dose, allergy details, insurance, parent phone, guardian, physician, medical notes
- No live AI provider calls — `buildCampEmmaAnswer()` in `lib/camp/emma.ts` is deterministic pattern matching, not an LLM call

---

## 9. Import Field Map Summary

See `docs/camp/CAMP_IMPORT_FIELD_MAP.md` for full detail.

The import tool processes the Oakwood "Camp Quick View" workbook — a specific 17-column export, **not** the full Oakwood registration report.

- 17 columns recognized by the parser
- 9 captured (safe fields in `camp_campers`)
- 6 captured (restricted fields in `camp_restricted_medical_records`)
- 2 gated (Medical Notes, Dietary Requirements — stored only if indicator is present)
- The full Oakwood registration report has additional financial, demographic, and contact columns not in the Quick View format and therefore not processed by the parser

---

## 10. Known Gaps

See `docs/camp/CAMP_KNOWN_GAPS.md` for full detail.

1. Medication photo frontend — API live; frontend upload widget in `camp-tool-pages.tsx` intake flow not yet implemented
2. Announcements page — placeholder (no announcement board yet)
3. Checkout / Return-home — placeholder (vehicle data visible; no checklist workflow)
4. Phase 2 leader safety booleans — spec written, migration not yet applied
5. Import UI sibling warning — no UI warning for household-ID duplicates
6. Durable role assignments may be empty — migration 014 table exists; actual user grants depend on Andrew having set them

---

## 11. Active Migrations (Camp/EMMA)

| Migration | Purpose |
|---|---|
| 006 | EMMA foundation (ai_requests, ai_runs, ai_proposals, ai_approvals, RLS) |
| 007 | Camp persistence (all core camp tables, email-based RLS restriction function) |
| 008 | Camp restricted data audit (tightened email pattern matching for restricted access) |
| 009 | Medication intake signature (camp_medication_intake_records with guardian signature) |
| 010 | Camper archive + medication photo records (soft-archive fields, photo metadata table) |
| 011 | Medication correction audit (supersedes/void fields on all medication tables) |
| 012 | Camp Oakwood teams (real team upsert, soft-archive demo teams) |
| 013 | Camp Oakwood operational data (registration_external_id, shirt_size, safe indicator booleans, emergency contact fields, dietary, camp_staff table, import batch audit fields) |
| 014 | Camp access roles (durable camp_access_members table, role tiers, audit table, guard functions) |
| 015 | Medication student acknowledgement (student_acknowledgement_initials on admin logs, with constraint) |

---

## 12. Regression Risks

- **Orphaned `camp-command-center.tsx`**: 2338-line component at `components/camp-command-center.tsx` (root-level, not in `components/camp/`). Not imported anywhere. Do not restore it — all functionality now lives in route pages and `camp-tool-pages.tsx`.
- **Email fallback + durable table coexistence**: If a new user's email starts with `andrew`/`jaci`/`joel` but has no durable `camp_access_members` row, email inference still fires. See CAMP_ACCESS_MODEL.md Known Inconsistencies.
- **Placeholder pages (announcements, checkout)**: Subtitles explicitly note they are not live. Do not add features to these pages without a focused task.
- **Append-only medication audit**: Any change to medication tables must preserve the append-only correction model. Never introduce UPDATE-in-place on medication records.

---

## 13. Change Log

| Date | Change |
|---|---|
| 2026-06-23 | Initial blueprint created from verified codebase inspection |

---

*This document is the master reference for Camp development. Update it when routes, components, migrations, access rules, or known gaps change.*
