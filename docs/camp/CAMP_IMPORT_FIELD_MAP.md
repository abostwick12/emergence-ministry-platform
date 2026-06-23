# Camp Import Field Map

Verified from codebase inspection on 2026-06-23.

**Source files inspected:**
- `lib/camp/oakwood-source-format.ts` — defines expected column headers
- `lib/camp/oakwood-import.ts` — parsing and field mapping logic
- `lib/camp/oakwood-upload-source.ts` — file upload handling (xlsx/csv)

---

## Important Framing

The EMERGE import tool processes the Oakwood **"Camp Quick View" workbook** — a specific 17-column worksheet that Oakwood generates for operational use. This is **not** the same as the full Oakwood registration export.

The full Oakwood registration report contains many more columns (financial data, demographic data, additional contact fields). Those columns are **not in the Quick View workbook** and are never seen by the parser.

This document maps the **17 Quick View columns** (the actual import source) and separately notes which full-registration-export fields are not captured.

---

## Quick View Workbook: 17 Columns

### Field Status Categories

- **Captured (safe)** — stored in `camp_campers` table, accessible to all staff
- **Captured (restricted)** — stored in `camp_restricted_medical_records` table, accessible only to Andrew / Jaci / Joel
- **Captured (derived)** — value drives downstream state but raw column value is not stored as a dedicated field
- **Gated** — stored in restricted table **only if the corresponding safe indicator is present**; blank otherwise
- **Not captured** — present in the Quick View workbook but not stored anywhere

### Field Map

| # | Oakwood Quick View Column | Status | Target Table / Field | Notes |
|---|---|---|---|---|
| 1 | Registration ID | **Captured (safe)** | `camp_campers.registration_external_id` | Household-level ID — not a unique person key. Two siblings share an ID. Must be ≥5 digits or row is skipped as a non-person row. |
| 2 | Name | **Captured (safe)** | `camp_campers.name` | Combined name. Parser also accepts "First Name" + "Last Name" as fallback alternatives. |
| 3 | Selection | **Captured (derived)** | Determines `personType` (student vs. adult) | "adult" keyword → adult; otherwise → student. Person type drives import scope routing. Raw "Selection" text not stored as a dedicated field. |
| 4 | Grade | **Captured (safe)** | `camp_campers.grade` | Warning generated if blank for a student-type row. Stored as-is. |
| 5 | Room Number | **Captured (safe)** | `camp_campers.cabin` | Also accepts "Cabin" or "Room" as alternate column names. Left blank if source is blank — never fabricated. Warning generated if blank. |
| 6 | T-Shirt Size | **Captured (safe)** | `camp_campers.shirt_size` | Also accepts "T Shirt Size" or "Shirt Size". Stored as-is. |
| 7 | Quick Filter | **Captured (derived)** | Drives `hasMedicalAlert` and `hasDietaryAlert` boolean indicators | Raw text not stored. Indicators set to true if "medical" (for medical alert) or "food/diet" / "diet" (for dietary alert) found in the Quick Filter value. This is the ONLY safe way to set these indicators from import — never from parsing free text. |
| 8 | Emergency Contact | **Captured (restricted)** | `camp_restricted_medical_records.emergency_contact_name` + `.emergency_contact_phone` | Parsed via regex to split name and phone. Sets `emergencyContactOnFile = true` indicator if non-blank. Warning generated if blank. Restricted table. |
| 9 | Medical Notes | **Gated** | `camp_restricted_medical_records.restricted_notes` | Stored ONLY if `hasMedicalAlert` is true (from Quick Filter or note presence). Otherwise stored as empty string. Restricted table. |
| 10 | Dietary Requirements | **Gated** | `camp_restricted_medical_records.dietary_requirements` | Stored ONLY if `hasDietaryAlert` is true. Otherwise stored as empty string. Restricted table. |
| 11 | Team | **Captured (safe)** | `camp_campers.team_name` (matched to team record) | Also accepts "Team Name". Left blank if source is blank. Warning generated if blank. |
| 12 | Vehicle | **Captured (safe)** | `camp_campers.vehicle_name` (matched to vehicle record) | Also accepts "Vehicle Name", "Transportation", "Van". Left blank if source is blank. Warning generated if blank. |
| 13 | Registration Contact First Name | **Captured (restricted)** | `camp_restricted_medical_records.guardian_name` (combined with Last Name) | Restricted table. |
| 14 | Registration Contact Last Name | **Captured (restricted)** | `camp_restricted_medical_records.guardian_name` (combined with First Name) | Restricted table. |
| 15 | Registration Contact Phone Number | **Captured (restricted)** | `camp_restricted_medical_records.guardian_phone` | Restricted table. |
| 16 | Insurance | **Captured (restricted)** | `camp_restricted_medical_records.insurance_status` | Also accepts "Insurance Status". N/A values (n/a, na, none, no, -, n.a, tbd, .) are stripped to empty. Restricted table. |
| 17 | Any other important information you would like us to know about your child? | **Captured (restricted)** | `camp_restricted_medical_records.parent_medical_notes` | Also accepts "Other Important Information" or "Notes". N/A values stripped. Restricted table. |

### Field Count Verification (Quick View workbook)

| Category | Count | Columns |
|---|---|---|
| Captured (safe, stored in camp_campers) | 6 | Registration ID, Name, Grade, Room Number, T-Shirt Size, Team (+ Vehicle = 7? — see note) |
| Captured (safe) — including Vehicle | 7 | Registration ID, Name, Grade, Room Number, T-Shirt Size, Team, Vehicle |
| Captured (derived — not a stored field) | 2 | Selection (person type), Quick Filter (drives indicators) |
| Captured (restricted, stored in camp_restricted_medical_records) | 6 | Emergency Contact, Reg Contact First, Reg Contact Last, Reg Contact Phone, Insurance, Other Info |
| Gated (restricted, stored only if indicator present) | 2 | Medical Notes, Dietary Requirements |
| **Total** | **17** | All 17 Quick View columns accounted for |

**Math check**: 7 safe captured + 2 derived + 6 restricted captured + 2 gated = **17** ✓

Note: "derived" columns (Selection, Quick Filter) are processed and their effects are persisted (personType determines import scope; derived indicators stored as booleans on `camp_campers`), but the raw column values are not stored as dedicated fields.

---

## Full Oakwood Registration Export: Additional Fields Not In Quick View

The following fields appear in the full Oakwood registration report but are **not in the Quick View workbook** and are therefore never processed by the parser. They are included here to prevent confusion about intentional vs. accidental omission.

| Oakwood Registration Column | Present in Quick View? | Reason Not Captured |
|---|---|---|
| First Name (separate) | No (Quick View uses combined "Name") | Quick View combines first + last into "Name" |
| Last Name (separate) | No | Same as above |
| Birthdate | No | Not in Quick View workbook |
| Age | No | Not in Quick View workbook |
| Gender | No | Not in Quick View workbook |
| Mobile Phone Number | No | Not in Quick View workbook |
| Home Phone Number | No | Not in Quick View workbook |
| Home Email Address | No | Not in Quick View workbook |
| Work Email Address | No | Not in Quick View workbook |
| Other Email Address | No | Not in Quick View workbook |
| Home Address Street | No | Not in Quick View workbook |
| Home Address City | No | Not in Quick View workbook |
| Home Address State | No | Not in Quick View workbook |
| Home Address Zip | No | Not in Quick View workbook |
| Registration Contact Address | No | Not in Quick View workbook |
| Registration Contact Home Email | No | Not in Quick View workbook |
| Registration Contact Work Email | No | Not in Quick View workbook |
| Registration Contact Other Email | No | Not in Quick View workbook |
| Status | No | Not in Quick View workbook |
| Submitted | No | Not in Quick View workbook |
| Registration Cost | No | Not in Quick View workbook |
| Attendee Balance Due | No | Not in Quick View workbook |
| Registration Amount Paid | No | Not in Quick View workbook |
| Balance Due | No | Not in Quick View workbook |
| Paid by Check | No | Not in Quick View workbook |
| Paid by Credit | No | Not in Quick View workbook |
| Paid by Cash | No | Not in Quick View workbook |
| Paid by Other | No | Not in Quick View workbook |
| Paid by Scholarships | No | Not in Quick View workbook |

These fields exist in the Oakwood registration system but the ministry has chosen to use the Quick View workbook for import because it is the operational format used for camp operations. Financial data (balance, payment methods) is managed in Oakwood and is not replicated to this platform.

---

## Parser Safety Guarantees

1. **No fabrication**: Blank source fields stay blank in the DB. The parser generates warnings for blank recommended fields but never fills them.

2. **Safe indicators from Quick Filter only**: `hasMedicalAlert` and `hasDietaryAlert` are set from the Quick Filter category keyword (e.g., "Medical Alert", "Food/Diet Restriction"), not from parsing medical note content. The only additional trigger is the presence (not content) of a non-blank medical/dietary note.

3. **Registration ID is a household key**: Multiple siblings share an ID. The parser uses a composite match (name + Registration ID) to avoid sibling confusion. Name-only matches are flagged as "ambiguous" even if unique.

4. **Ambiguous rows block commit**: Match status "ambiguous" prevents that row from being auto-committed. Rows must be reviewed and resolved manually before re-importing.

5. **Restricted and safe fields always separate**: The parser builds a `restricted` payload (for `camp_restricted_medical_records`) and a `person` payload (for `camp_campers`) independently. They are committed to separate tables.

6. **Buffer never persisted**: Upload file is parsed in-memory (ExcelJS for xlsx, plain text for csv). The source file is never stored. Only the SHA-256 checksum and filename are logged in `camp_import_batches`.

---

## Import Match Status

| Status | Condition | Auto-Committed? |
|---|---|---|
| `new` | No existing record by (name + Registration ID) or unique name | Yes |
| `matched` | Unique match by (name + Registration ID) composite | Yes |
| `ambiguous` | Multiple candidates by name, or name matches with different Registration ID | **No** — requires manual resolution |
| `invalid` | Missing name or non-numeric Registration ID | **No** |
| `skipped` | Row type doesn't match import scope (e.g., staff row on camper tab) | No (excluded from counts) |

---

## Known Import Warnings (Not Yet in UI)

The following operational risks have no UI warning today:

1. **Sibling household IDs**: When the same Registration ID appears for multiple students, there is no UI callout that this is expected (siblings share an ID). A future import UI improvement should display a note: "Registration ID shared by multiple rows — this is normal for siblings."

2. **Missing Grade for students**: The parser generates a backend warning but the import preview UI may not surface this prominently. Grades are needed for team assignment context.

3. **No column validation summary before preview**: The UI does not show which expected columns were found vs. missing from the source file before the preview table renders.

See `docs/camp/CAMP_KNOWN_GAPS.md` for the full gap list.

---

## File Upload Handling

- Accepted formats: `.csv` and `.xlsx` (max 10 MB each)
- For `.xlsx`: worksheet selector appears when the workbook has multiple sheets
- ExcelJS parses in-memory; buffer never persisted to disk or Supabase storage
- SHA-256 logged in `camp_import_batches.source_checksum`; filename retained for display
- Route: `POST /api/camp/import/upload` (preview) → `POST /api/camp/import` (commit)
- Access gate: Andrew only (`assertCampAdminAccess()`)
