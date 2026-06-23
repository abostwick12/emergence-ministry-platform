# Camp Access Model

Verified from codebase inspection on 2026-06-23. Sources: `lib/camp/access-control.ts`, `lib/camp/permissions.ts`, `lib/camp/access.ts`, `supabase/migrations/007_camp_persistence.sql`, `supabase/migrations/008_camp_restricted_data_audit.sql`, `supabase/migrations/014_camp_access_roles.sql`.

---

## 1. Role Tiers

Two parallel systems exist simultaneously: durable table assignments (migration 014) and legacy email-based inference (migration 007). They map to the same internal capability model.

### Durable Table Tiers (`camp_access_members`, migration 014)

| Stored Role | Maps to Internal Actor | Capabilities |
|---|---|---|
| `camp_admin` | Andrew | Full: Medical Command + import admin + restricted medical + EMMA smart search + access management |
| `medical_coordinator` | Jaci | Restricted medical workflows + EMMA smart search; **NO Medical Command** |
| `restricted_assistant` | Joel | Restricted medical workflows only; **NO EMMA smart search, NO Medical Command** |
| `leader` | (any) | Safe operational views only |
| `driver` | (any) | Safe operational + vehicle-scoped |

### Legacy Email-Based Inference (migration 007/008, transitional fallback)

Fires only when no durable `camp_access_members` row exists for the signed-in user.

| Email Local Part Pattern | Internal Actor | Capabilities |
|---|---|---|
| `andrew`, `andrew.*`, `andrew-*`, `andrew_*` | Andrew | Same as `camp_admin` |
| `jaci`, `jaci.*`, `jaci-*`, `jaci_*` | Jaci | Same as `medical_coordinator` |
| `joel`, `joel.*`, `joel-*`, `joel_*` | Joel | Same as `restricted_assistant` |
| All other authenticated users | (none) | Leader / Driver based on `session.user.role` |

Email pattern matching is implemented in `lib/camp/permissions.ts → restrictedActorForSession()`. The email local part is compared to hardcoded names — never inferred from display name (migrated from 007 pattern to stricter 008 pattern to prevent spoofing).

---

## 2. Capability Matrix

| Capability | Andrew | Jaci | Joel | Leader | Driver |
|---|---|---|---|---|---|
| View Camp overview (roster, teams, schedule, vehicles, forms) | ✓ | ✓ | ✓ | ✓ | ✓ |
| View safety alerts (safe flags, emergency contact guidance) | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own team / vehicle | ✓ | ✓ | ✓ | ✓ | ✓ (vehicle only) |
| View restricted medical workflows (medicine-intake, medication-schedule, medication-history, medical-quick-view) | ✓ | ✓ | ✓ | ✗ | ✗ |
| EMMA smart search (restricted-safe data) | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Medical Command dashboard | ✓ | ✗ | ✗ | ✗ | ✗ |
| Administer medication (admin form + student signature) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Access settings and import | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage `camp_access_members` (grant/revoke roles) | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 3. What Each Role Can See

### Andrew (`camp_admin`)
- All safe operational pages
- Full restricted medical records (emergency contact, guardian, insurance, dietary notes, medical notes)
- Medication schedules, intake records, administration logs, return items
- Medical Command time blocks and status
- Medication administration form (with student signature collection)
- Oakwood import tool (preview and commit)
- `camp_access_members` management
- EMMA smart search (restricted-safe flags + operational data)
- EMMA in `andrew_medical` mode when medicalCommandActive (medication time block summary, no dosage)

### Jaci (`medical_coordinator`)
- All safe operational pages
- Full restricted medical records (excluding Medical Command)
- Medication schedules, intake records, administration logs, return items
- **NOT** Medical Command dashboard
- **NOT** Oakwood import settings
- **NOT** access management
- EMMA smart search (restricted-safe flags + operational data)

### Joel (`restricted_assistant`)
- All safe operational pages
- Full restricted medical records (excluding Medical Command)
- Medication schedules, intake records, administration logs, return items
- **NOT** Medical Command dashboard
- **NOT** Oakwood import settings
- **NOT** access management
- **NOT** EMMA smart search (finder mode only)

### Leader (`leader`)
- All safe operational pages (roster, teams, schedule, vehicles, forms, my-team, safety, more, announcements placeholder, checkout placeholder)
- Safe indicator booleans only (hasMedicalAlert, hasDietaryAlert, emergencyContactOnFile) — never free text
- **NOT** any restricted medical or medication pages
- EMMA finder mode (safe operational data only)

### Driver (`driver`)
- Same safe operational pages as leader
- Vehicle view scoped to their own vehicle
- EMMA finder mode (safe operational data only, scoped to their vehicle)

---

## 4. What Each Role Cannot See

### Leaders and Drivers Must Never Receive:
- Medication names or dosages
- Medical notes (free text)
- Insurance information
- Guardian/parent phone numbers
- Free-text dietary requirements
- Intake signatures or signature data
- Administration log details
- Correction or void reason text

The safe flags (`hasMedicalAlert`, `hasDietaryAlert`, `emergencyContactOnFile`) are the maximum medical-adjacent information a leader receives.

---

## 5. Server-Side Enforcement

### Enforcement Chain (production)

1. **Session authentication** (`lib/auth/server → getServerSession()`) — request rejected if no valid session
2. **Durable role lookup** (`getStoredCampRole()`) — checks `camp_access_members` table; returns stored role or null
3. **Role mapping** (`buildCampAccessFromStoredRole()`) — converts stored role to `CampAccessContext`
4. **Fallback** (`resolveCampAccessContext()`) — fires only if no durable assignment; uses email inference; never trusts client `?role=` param in production
5. **Capability assertion** — API handlers call specific assertion functions before fetching data:
   - `assertCampRestrictedAccess(context)` — restricted medical and medication routes
   - `assertCampMedicalCommandAccess(context)` — Medical Command routes
   - `assertCampAdminAccess(context)` — import and access management routes
6. **RLS layer** — Supabase `current_user_can_access_camp_restricted()` function (SECURITY DEFINER) enforces at database level

### Key Enforcement Functions

| Function | Location | What it checks | Returns |
|---|---|---|---|
| `resolveCampAccessForRequest()` | `lib/camp/access-control.ts` | Session → durable role → fallback; never trusts client param in prod | `CampAccessContext` |
| `isCampRolePreviewEnabled()` | `lib/camp/access-control.ts` | Returns false in production; true in test/E2E/local | boolean |
| `canAccessCampMedicalCommand()` | `lib/camp/permissions.ts` | `restrictedActor === "Andrew"` only | boolean |
| `assertCampRestrictedAccess()` | `lib/camp/permissions.ts` | `canAccessRestricted` flag | allowed or 403 |
| `assertCampMedicalCommandAccess()` | `lib/camp/permissions.ts` | Andrew only | allowed or 403 |
| `assertCampAdminAccess()` | `lib/camp/permissions.ts` | Andrew only | allowed or 403 |
| `canManageCampAccess()` | `lib/camp/access-control.ts` | `restrictedActor === "Andrew"` only | boolean |

---

## 6. Dev-Only Preview Behavior

`isCampRolePreviewEnabled()` returns true ONLY when:
- `process.env.NODE_ENV === "test"` (Vitest unit tests)
- `process.env.E2E_MOCK_AUTH === "true"` (Playwright E2E)
- `process.env.ENABLE_CAMP_ROLE_PREVIEW === "true"` (explicit local opt-in)
- Supabase is not configured AND not in production (local dev without Supabase)

When preview is enabled, `CampAccessSwitcher` renders in the UI and allows role switching for testing.

**In production (`VERCEL_ENV=production`)**: preview is always disabled, the switcher never renders, and the client `?role=` param is never honored.

---

## 7. EMMA Access Tiers

EMMA adds a second layer of access scoping on top of Camp roles. Resolved in `app/api/camp/emma/route.ts → resolveEmmaAccess()`:

| Internal Actor | medicalCommandActive | EMMA Access Tier | What EMMA returns |
|---|---|---|---|
| Andrew | true | `andrew_medical` | Medical time blocks + counts (no dosage, no signatures, no insurance) |
| Andrew | false | `andrew_operations` | Same as Jaci (restricted-safe operational data) |
| Jaci | — | `jaci` | Restricted-safe operational data (team/room/vehicle/schedule) |
| Anyone else | — | `leader` | Safe operational data only |

Non-`finder` EMMA modes are blocked unless `canAccessRestricted` is true AND `restrictedActor` is "Andrew" or "Jaci" (Joel explicitly excluded from smart_search).

---

## 8. RLS Layer (Supabase)

The Supabase RLS `current_user_can_access_camp_restricted()` function (SECURITY DEFINER, migration 007/008) provides a database-layer backstop. Even if application code is bypassed, restricted tables are protected at the row level.

**Restricted tables (RLS-enforced)**:
- `camp_restricted_medical_records`
- `camp_medication_records`
- `camp_medication_schedule_items`
- `camp_medication_administration_logs`
- `camp_medication_intake_records`
- `camp_medication_photo_records`
- `camp_medication_return_items`
- `camp_import_batches` (moved to restricted in migration 008)
- `camp-medication-photos` storage bucket

**Staff-accessible tables (all authenticated, not restricted)**:
- `camp_sessions`, `camp_teams`, `camp_vehicles`, `camp_campers`, `camp_staff`

---

## 9. Known Inconsistencies and Risks

### Inconsistency 1: Dual enforcement systems coexist
Migration 014 (durable table) and migration 007 (email inference) both run. If a user with no durable assignment has an `andrew`-prefixed email, they gain Medical Command access via fallback. **Risk**: accidental elevation for any email starting with `andrew`. **Mitigation**: Assign durable roles to all named staff as soon as possible to eliminate fallback dependency.

### Inconsistency 2: Joel's EMMA access
In the legacy email-inference path, Joel resolves to `restrictedActor = "Joel"`, which gives `canAccessRestricted = true` but NOT EMMA smart search (the EMMA route checks `restrictedActor !== "Andrew" && restrictedActor !== "Jaci"` and blocks Joel explicitly). In the durable path, `restricted_assistant` maps to Joel's access context which also blocks EMMA smart search. **These are consistent — documenting for clarity**, not as a bug.

### Inconsistency 3: Durable role grants may not exist yet
Migration 014 created the `camp_access_members` table but does not seed rows. If Andrew has not yet granted durable roles to Jaci, Joel, and himself, the entire system runs on email inference alone. This is a deployment gap, not a code gap. See `docs/camp/CAMP_KNOWN_GAPS.md`.

### Product Rule (from user)
Andrew alone is the intended full Medical Command user. Jaci and Joel have restricted medical access but must never reach Medical Command. This is **correctly enforced in current code** — `assertCampMedicalCommandAccess()` explicitly checks `restrictedActor === "Andrew"` only.

---

## 10. Audit Trail for Role Changes

`camp_access_audit` table (migration 014) records all role grants, revocations, and updates:
- `actor_user_id` / `actor_email` — who made the change
- `target_user_id` / `target_email` — whose role changed
- `action` — granted / revoked / updated
- `old_camp_role` / `new_camp_role`
- `changed_at` — immutable timestamp

A guard function `camp_access_guard_last_admin()` prevents removing or demoting the final `camp_admin`, ensuring Andrew cannot be locked out.
