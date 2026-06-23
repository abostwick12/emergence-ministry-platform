# Camp Feature Inventory

Verified from codebase inspection on 2026-06-23.

Status labels:
- **Live** — route renders and the full workflow is functional
- **Placeholder** — route is live and renders without error; the workflow it hosts is incomplete. Placeholder is not the same as Orphaned. These routes are reachable, navigable, and intentional.
- **Orphaned/Reference-only** — file exists in the codebase but is not imported by any live route
- **Known gap** — documented missing functionality (see `CAMP_KNOWN_GAPS.md`)

Source of truth for all route and component status. Update this file when routes, components, or status changes.

---

## Page Routes (20 verified)

Routes enumerated from `app/(app)/camp/**/*.tsx` glob as of 2026-06-23.

---

### `/camp`
| | |
|---|---|
| **Route** | `/camp` |
| **Purpose** | Home dashboard; entry point for all Camp roles. Displays team carousel, next schedule item, and mode selector (home / medical). Medical mode shows Medical Command for Andrew. |
| **File(s)** | `app/(app)/camp/page.tsx`, `components/camp/camp-home.tsx` |
| **Visible to** | All authenticated Camp roles |
| **Reads from** | `useCamp()` → `GET /api/camp` overview |
| **Writes to** | None (navigation only) |
| **Interactive features** | CampTeamCarousel (team navigation), CampNextUpCard (upcoming schedule), mode toggle (home/medical for Andrew) |
| **Links** | → /camp/teams, /camp/medical-command, /camp/roster |
| **Regression risks** | Medical mode must only render for Andrew; general leaders must never see Medical Command entry |
| **Status** | **Live** |

---

### `/camp/roster`
| | |
|---|---|
| **Route** | `/camp/roster` |
| **Purpose** | Searchable, filterable full student roster. Shows safe student cards with team, vehicle, and safe indicator tags. |
| **File(s)** | `app/(app)/camp/roster/page.tsx` |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.students |
| **Writes to** | None |
| **Interactive features** | Text search, filter by team/vehicle/indicator |
| **Links** | Student cards deep-link within roster context |
| **Regression risks** | Must never show medication names, dosages, or restricted medical notes on student cards |
| **Status** | **Live** |

---

### `/camp/teams`
| | |
|---|---|
| **Route** | `/camp/teams` |
| **Purpose** | Grid of all teams with student counts and missing-assignment indicators. |
| **File(s)** | `app/(app)/camp/teams/page.tsx`, `components/camp/camp-team-card.tsx` |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.teams, overview.students |
| **Writes to** | None |
| **Interactive features** | Navigate to team detail |
| **Links** | → /camp/teams/[teamId] |
| **Regression risks** | None specific |
| **Status** | **Live** |

---

### `/camp/teams/[teamId]`
| | |
|---|---|
| **Route** | `/camp/teams/[teamId]` |
| **Purpose** | Team detail: roster, leader, room assignment, vehicle, and per-student safe indicators. |
| **File(s)** | `app/(app)/camp/teams/[teamId]/page.tsx`, `components/camp/camp-student-card.tsx` |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.teams, overview.students |
| **Writes to** | None |
| **Interactive features** | Student cards with safe tag display |
| **Links** | ← /camp/teams |
| **Regression risks** | Must not show medication or restricted detail on student cards |
| **Status** | **Live** |

---

### `/camp/schedule`
| | |
|---|---|
| **Route** | `/camp/schedule` |
| **Purpose** | Day-by-day schedule view with CampDaySelector. |
| **File(s)** | `app/(app)/camp/schedule/page.tsx`, `components/camp/camp-day-selector.tsx` |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` scheduleForSelectedDay |
| **Writes to** | None |
| **Interactive features** | CampDaySelector changes selected day; schedule blocks render per day |
| **Links** | None |
| **Regression risks** | Day selector state must persist across navigation within session |
| **Status** | **Live** |

---

### `/camp/vehicles`
| | |
|---|---|
| **Route** | `/camp/vehicles` |
| **Purpose** | Transportation view: rider lists per vehicle with driver info. |
| **File(s)** | `app/(app)/camp/vehicles/page.tsx` |
| **Visible to** | All roles (drivers scoped to their vehicle) |
| **Reads from** | `useCamp()` overview.vehicles, overview.students |
| **Writes to** | None |
| **Interactive features** | None |
| **Links** | None |
| **Regression risks** | Drivers must only see their own vehicle's riders |
| **Status** | **Live** |

---

### `/camp/forms`
| | |
|---|---|
| **Route** | `/camp/forms` |
| **Purpose** | Forms and documents status: whether students have medical forms on file. |
| **File(s)** | `app/(app)/camp/forms/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampDocumentsToolPage`) |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.documents |
| **Writes to** | None |
| **Interactive features** | None |
| **Links** | None |
| **Regression risks** | Document status must not expose restricted medical content — form presence (boolean) only |
| **Status** | **Live** |

---

### `/camp/announcements`
| | |
|---|---|
| **Route** | `/camp/announcements` |
| **Purpose** | Surfaces schedule items as leader signals. Intended for a future announcement board. |
| **File(s)** | `app/(app)/camp/announcements/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampAnnouncementsToolPage`) |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.schedule |
| **Writes to** | None |
| **Interactive features** | None (display only) |
| **Links** | None |
| **Subtitle in component** | "A focused announcement board is not live yet. Use these schedule signals for leader huddles." |
| **Regression risks** | Do not add live features here without a focused task — treat as placeholder |
| **Status** | **Placeholder** |

---

### `/camp/checkout`
| | |
|---|---|
| **Route** | `/camp/checkout` |
| **Purpose** | Shows vehicle/rider data for return-home planning. Return checklist workflow is not yet live. |
| **File(s)** | `app/(app)/camp/checkout/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampCheckoutToolPage`) |
| **Visible to** | All roles |
| **Reads from** | `useCamp()` overview.vehicles, overview.students |
| **Writes to** | None |
| **Interactive features** | None (data display only) |
| **Links** | None |
| **Subtitle in component** | "Return-home workflow is not split into a live checklist yet. Transportation data is shown for planning." |
| **Regression risks** | Do not add live features here without a focused task |
| **Status** | **Placeholder** |

---

### `/camp/my-team`
| | |
|---|---|
| **Route** | `/camp/my-team` |
| **Purpose** | Role-scoped view of the user's own assignments: team roster (for leaders) or vehicle riders (for drivers). |
| **File(s)** | `app/(app)/camp/my-team/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampAssignmentsToolPage`) |
| **Visible to** | All roles (scoped to their assignment) |
| **Reads from** | `useCamp()` overview.students filtered by role |
| **Writes to** | None |
| **Interactive features** | None |
| **Links** | None |
| **Regression risks** | Leaders must see only their team; drivers must see only their vehicle's riders |
| **Status** | **Live** |

---

### `/camp/safety`
| | |
|---|---|
| **Route** | `/camp/safety` |
| **Purpose** | General-leader-safe view of alerts and emergency contact guidance. No medication names, dosages, or restricted medical detail. |
| **File(s)** | `app/(app)/camp/safety/page.tsx`, `components/camp/camp-leader-safety-view.tsx` |
| **Visible to** | All roles (same data for all — safe only) |
| **Reads from** | `GET /api/camp` safe overview (not the restricted medical endpoint) |
| **Writes to** | None |
| **Interactive features** | None |
| **Links** | None |
| **Regression risks** | Must never show medication names, dosages, insurance, or free-text medical notes. Boolean flags (hasMedicalAlert, hasDietaryAlert) only. |
| **Status** | **Live** |

---

### `/camp/more`
| | |
|---|---|
| **Route** | `/camp/more` |
| **Purpose** | Tool launcher menu. Shows available tools based on role capabilities. Restricted tiles hidden for general leaders/drivers. |
| **File(s)** | `app/(app)/camp/more/page.tsx` |
| **Visible to** | All roles (tiles gated by capabilities) |
| **Reads from** | `useCamp()` capabilities |
| **Writes to** | None |
| **Interactive features** | Tile navigation to tool pages |
| **Links** | → all tool pages |
| **Regression risks** | Restricted tiles (medical command, medicine intake, etc.) must only appear for roles with capability; must not be merely hidden — backend still enforces the gate |
| **Status** | **Live** |

---

### `/camp/settings`
| | |
|---|---|
| **Route** | `/camp/settings` |
| **Purpose** | Admin entry point for camp settings. Gate: requires Medical Command capability (Andrew only). |
| **File(s)** | `app/(app)/camp/settings/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampSettingsToolPage`) |
| **Visible to** | Andrew only (`capabilities.medicalCommand` gate) |
| **Reads from** | `useCamp()` capabilities |
| **Writes to** | None directly |
| **Interactive features** | Navigation to import |
| **Links** | → /camp/settings/import |
| **Regression risks** | General leaders/drivers must receive 403 if accessing directly |
| **Status** | **Live** |

---

### `/camp/settings/import`
| | |
|---|---|
| **Route** | `/camp/settings/import` |
| **Purpose** | Oakwood Quick View workbook upload, preview, and commit. Andrew only. |
| **File(s)** | `app/(app)/camp/settings/import/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampSettingsImportToolPage`) |
| **Visible to** | Andrew only |
| **Reads from** | `POST /api/camp/import/upload` (preview), `GET /api/camp/import` (status) |
| **Writes to** | `POST /api/camp/import` (commit) |
| **Interactive features** | File drop/upload (.csv or .xlsx), worksheet selector (xlsx multi-sheet), preview table, ambiguous row review, commit button |
| **Links** | ← /camp/settings |
| **Regression risks** | Ambiguous rows must BLOCK commit (not silently skip). Safe and restricted fields must split correctly. Non-Andrew users must get 403. |
| **Status** | **Live** |

---

### `/camp/medical-command`
| | |
|---|---|
| **Route** | `/camp/medical-command` |
| **Purpose** | Andrew-only dashboard showing medication time blocks with status (Due / Completed / Needs Attention / Intake Missing). |
| **File(s)** | `app/(app)/camp/medical-command/page.tsx`, `components/camp/camp-medical-command.tsx` |
| **Visible to** | Andrew only (`assertCampMedicalCommandAccess()`) |
| **Reads from** | `GET /api/camp/medical-command` |
| **Writes to** | None |
| **Interactive features** | Day selector, time block status display, deep link to administer |
| **Links** | → /camp/medical-command/administer |
| **Regression risks** | Jaci and Joel must receive 403. General leaders must receive 403. Do not relax this gate without explicit approval. |
| **Status** | **Live** |

---

### `/camp/medical-command/administer`
| | |
|---|---|
| **Route** | `/camp/medical-command/administer` |
| **Purpose** | Andrew-only medication administration form. Records the dose given, any notes, and collects student acknowledgement initials via signature pad. |
| **File(s)** | `app/(app)/camp/medical-command/administer/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampAdministerMedicineToolPage`) |
| **Visible to** | Andrew only |
| **Reads from** | `GET /api/camp/medication?role=andrew` |
| **Writes to** | `POST /api/camp/medication` (creates administration log row) |
| **Interactive features** | Student selector, dose confirmation, student acknowledgement signature pad (`SignaturePad`), unavailable reason flow |
| **Links** | ← /camp/medical-command (deep-link from time blocks) |
| **Regression risks** | Student acknowledgement signature must be preserved. Signature stored as `DRAWN_INITIALS:JSON` or `"Unavailable/declined:reason"`. Administration log is immutable (append-only). |
| **Status** | **Live** |

---

### `/camp/medicine-intake`
| | |
|---|---|
| **Route** | `/camp/medicine-intake` |
| **Purpose** | Restricted staff workflow for receiving medications from parents at check-in and processing medication returns at checkout. Includes parent/guardian signature pad. |
| **File(s)** | `app/(app)/camp/medicine-intake/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampMedicineIntakeToolPage`) |
| **Visible to** | Andrew / Jaci / Joel (`assertCampRestrictedAccess()`) |
| **Reads from** | `GET /api/camp/medication` |
| **Writes to** | `POST /api/camp/medication` (create intake record), `PATCH /api/camp/medication` (update return) |
| **Interactive features** | Student list, intake form with medication details, parent/guardian signature pad (`SignaturePad`), return workflow checklist |
| **Links** | None |
| **Regression risks** | Parent/guardian handoff signature must be preserved. Signature stored as JSON strokes. Correction flow must create new row (not update existing). |
| **Status** | **Live** |

---

### `/camp/medication-schedule`
| | |
|---|---|
| **Route** | `/camp/medication-schedule` |
| **Purpose** | Restricted staff view of upcoming scheduled medication windows. |
| **File(s)** | `app/(app)/camp/medication-schedule/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampMedicationScheduleToolPage`) |
| **Visible to** | Andrew / Jaci / Joel |
| **Reads from** | `GET /api/camp/medication` (restricted payload includes schedule) |
| **Writes to** | None |
| **Interactive features** | Schedule list by time window |
| **Links** | None |
| **Regression risks** | General leaders must receive 403 |
| **Status** | **Live** |

---

### `/camp/medication-history`
| | |
|---|---|
| **Route** | `/camp/medication-history` |
| **Purpose** | Restricted audit history of intake records, administration logs, and return items. Includes correction and void indicators. |
| **File(s)** | `app/(app)/camp/medication-history/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampMedicationHistoryToolPage`) |
| **Visible to** | Andrew / Jaci / Joel |
| **Reads from** | `GET /api/camp/medication` (full restricted payload) |
| **Writes to** | None |
| **Interactive features** | Audit trail with correction/void tags |
| **Links** | None |
| **Regression risks** | Voided and corrected records must remain visible (append-only audit). Must not allow hard-delete display. |
| **Status** | **Live** |

---

### `/camp/medical-quick-view`
| | |
|---|---|
| **Route** | `/camp/medical-quick-view` |
| **Purpose** | Restricted quick summary of each student's medical flags. Boolean indicators only — no free-text medical detail, no dosages, no insurance. |
| **File(s)** | `app/(app)/camp/medical-quick-view/page.tsx`, `components/camp/camp-tool-pages.tsx` (`CampMedicalQuickViewToolPage`) |
| **Visible to** | Andrew / Jaci / Joel |
| **Reads from** | `GET /api/camp/medication` |
| **Writes to** | None |
| **Interactive features** | Student list with flag indicators |
| **Links** | None |
| **Regression risks** | Must never show raw medical notes, dosage, or insurance in this view |
| **Status** | **Live** |

---

## Components

### Live Components

| Component | File | Purpose | Imported By |
|---|---|---|---|
| `CampShell` | `components/camp/camp-shell.tsx` | App wrapper: header, nav, layout, mobile shell | `app/(app)/camp/layout.tsx` |
| `CampProvider` / `useCamp` | `components/camp/camp-provider.tsx` | Context for overview, schedule, role, day | All Camp pages |
| `CampHome` | `components/camp/camp-home.tsx` | Home dashboard (home / medical modes) | `/camp/page.tsx` |
| `CampNav` | `components/camp/camp-nav.tsx` | Top navigation (Home / Teams / EMMA / Roster / More) | `CampShell` |
| `CampAccessSwitcher` | `components/camp/camp-access-switcher.tsx` | Role preview picker — **dev/non-production only** | `CampHome` |
| `CampDaySelector` | `components/camp/camp-day-selector.tsx` | Day picker for schedule views | Multiple pages |
| `CampTeamCarousel` | `components/camp/camp-team-carousel.tsx` | Team carousel on home dashboard | `CampHome` |
| `CampTeamCard` | `components/camp/camp-team-card.tsx` | Team card (carousel and list variants) | `CampTeamCarousel`, teams page |
| `CampStudentCard` | `components/camp/camp-student-card.tsx` | Student row card with safe indicator tags | Roster, team detail, lists |
| `CampNextUpCard` | `components/camp/camp-next-up-card.tsx` | Next scheduled event summary | `CampHome` |
| `CampMedicalCommand` | `components/camp/camp-medical-command.tsx` | Andrew-only medication time blocks | Medical command page, home |
| `CampLeaderSafetyView` | `components/camp/camp-leader-safety-view.tsx` | Safe leader alerts — no restricted detail | `/camp/safety/page.tsx` |
| `CampEmmaSheet` | `components/camp/camp-emma-sheet.tsx` | EMMA Camp search bottom-sheet modal | `CampNav` |
| `EmmaWaveOrb` | `components/camp/emma-wave-orb.tsx` | Animated EMMA icon in nav | `CampNav` |
| `camp-tool-pages.tsx` (multiple) | `components/camp/camp-tool-pages.tsx` | All restricted/placeholder tool page components, `SignaturePad`, `MedicationDataGate` | Multiple page files |

### Signature Pad (Live — embedded in `camp-tool-pages.tsx`)

`SignaturePad` is a canvas-based component (640×220px default) used in two live workflows:

1. **Parent/guardian handoff signature** — in `CampMedicineIntakeToolPage` / `MedicineIntakeReturnWorkflow`
   - Serialized to `json_strokes_v1` format
   - Stored in `camp_medication_intake_records.signature_data`

2. **Student acknowledgement initials** — in `CampAdministerMedicineToolPage`
   - Stored as `DRAWN_INITIALS:JSON` or `"Unavailable/declined:<reason>"`
   - Constrained: exactly one of (initials OR unavailable+reason) must be present

**Do not remove or bypass signature pads without explicit product approval.**

---

### Orphaned / Reference-only Components

| Component | File | Status | Notes |
|---|---|---|---|
| `CampCommandCenter` | `components/camp-command-center.tsx` | **Orphaned** | 2338-line component; zero live imports confirmed. All functionality now distributed across route pages. Do not restore. |

---

## API Routes

See `CAMP_BLUEPRINT.md` Section 7 for the API inventory table.

All Camp API routes enforce server-side access checks before fetching data. RLS at the Supabase layer provides a second enforcement layer.
