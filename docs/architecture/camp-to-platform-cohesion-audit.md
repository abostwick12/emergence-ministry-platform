# Camp-to-Platform Cohesion Audit

Date: 2026-07-06
Branch: `audit/platform-cohesion-camp-refactor`
Scope: audit only. No files were deleted, no migrations were applied, no production data was mutated, and no deployment was created.

## Executive Summary

Camp Command Center is ministry-critical and should not be removed wholesale. It contains the strongest end-to-end operational workflows in the app: roster import, safe roster display, transportation, teams, schedule, restricted medication workflows, signatures, audit behavior, access management, and controlled EMMA actions.

The cohesion problem is not that Camp exists. The problem is that several platform-grade ideas are trapped in Camp-specific names, Camp-specific route/API boundaries, and Camp Oakwood launch assumptions. The next phase should preserve working Camp operations while extracting reusable patterns into shared layers for Lead Emergence, EMMA, SAGE, and future Scripture engagement / discipleship planning work.

Priority recommendation:

1. Keep Camp as an isolated operational module for now.
2. Move shared primitives out in thin, testable slices only after behavior is covered.
3. Deprecate one-off Oakwood launch scaffolding and orphaned UI after reference value is captured.
4. Do not add YouVersion/Gloo-specific features until platform naming, AI boundaries, access control, and shared command-center patterns are cleaner.

## Camp Module Boundary Findings

### What Is Actively Useful

- `app/(app)/camp/**` is an active route group, not an abandoned prototype. The live route set includes home, roster, teams, schedule, vehicles, forms, safety, more, settings/import, medical command, medication intake, medication schedule, medication history, medical quick view, and staff/settings workflows.
- `app/api/camp/**` is the correct server boundary for Camp. It consistently routes through `requireCampAccessForRequest()` and domain repository functions rather than calling Supabase or providers directly from UI components.
- `components/camp/**` holds the current live Camp shell, navigation, provider, student cards, team cards, roster view, leader safety view, medical command, access admin, EMMA sheet, and tool pages.
- `lib/camp/repository.ts` and `lib/camp/store.ts` provide a useful Supabase/mock boundary. The fallback pattern is valuable for tests and local development.
- `lib/camp/public-safety.ts`, `lib/camp/access.ts`, `lib/camp/leader-safety.ts`, and related tests encode a strong data-minimization model. General leader and driver surfaces avoid medication names, dosages, insurance, guardian contact, physician data, signatures, and raw medical notes.
- `lib/camp/oakwood-import.ts`, `lib/camp/oakwood-upload-source.ts`, and import tests are operationally useful. The parser is deliberately defensive: it does not persist uploaded workbooks, treats Registration ID as household-level, blocks ambiguous matches, and splits safe operational indicators from restricted medical/contact payloads.
- Medication workflows are high-value and should remain intact: intake sessions, guardian signatures, medication photos, grouped administration, student acknowledgement, correction/void/archive history, and return checklist behavior.
- `lib/camp/emma-actions.ts` is useful because it models a safe AI-controlled action lifecycle: parse intent, validate permissions, create a pending action, require confirmation, write through application code, and audit the outcome.
- Camp E2E and unit tests are active boundary coverage. They are particularly important around leader safety, medication photo boundaries, imports, mobile navigation, and EMMA controlled actions.

### What Was One-Off Oakwood Launch Scaffolding

- `lib/camp/public-data.ts` hardcodes `Camp Oakwood`, `2026-06-29`, six color teams, vans, schedule rows, document owners, and seed camper names. This should remain as test/mock fixture data, not platform truth.
- `lib/camp/oakwood-*` is specific to the Oakwood Quick View workbook. The parser is worth keeping, but it should be treated as a source-specific adapter under a more general import pipeline.
- `CAMP_OAKWOOD_LIVE_IMPORT_APPROVED` and Oakwood schema readiness checks are launch-specific. Keep them while Oakwood import remains live, but avoid spreading that approval flag into generic roster import work.
- `docs/camp/CAMP_BLUEPRINT.md` explicitly says the Camp module is purpose-built for Camp Oakwood 2026 and not a general camp management product. That statement conflicts with long-term platform aspirations and should be revised once refactoring begins.
- Placeholder pages `/camp/announcements` and `/camp/checkout` are intentional but incomplete. They should either graduate into real reusable workflows or be relabeled as read-only planning views.

### What Is Hardcoded To Oakwood

- Camp name, dates, teams, schedule, documents, vehicles, and sample campers in `lib/camp/public-data.ts`.
- Import type names and function names such as `CampOakwoodImportPreview`, `buildOakwoodImportPreviewFromCsv`, `detectOakwoodWorkbook`, `extractOakwoodCsv`, and `MAX_OAKWOOD_UPLOAD_BYTES`.
- API and UI copy around "Camp Oakwood registration export" and "Oakwood import preview".
- Migration seed data in `supabase/migrations/007_camp_persistence.sql`, `012_camp_oakwood_teams.sql`, and `013_camp_oakwood_operational_data.sql`.
- Tests named `camp-oakwood-import.spec.ts` and `oakwood-*.test.ts`.

### What Is Hardcoded To Andrew, Jaci, Or Joel

- `lib/camp/permissions.ts` still exposes internal access roles as `andrew`, `jaci`, `joel`, `general_leader`, and `driver`, and maps restricted actors to named people.
- `lib/camp/access-control.ts` has `BOOTSTRAP_CAMP_ADMIN_EMAIL = "andrew.w.bostwick12@gmail.com"`.
- Medical Command is Andrew-only by product rule. That rule is currently correct, but the implementation should eventually express "Camp Admin / Medical Command owner" as a durable capability rather than a named actor.
- Jaci and Joel are encoded as named restricted actors in permission checks, docs, and tests. Durable roles now exist (`camp_admin`, `medical_coordinator`, `restricted_assistant`, `leader`, `driver`), so future code should prefer those capability names.
- Tests assert visible person names such as Andrew, Jaci, and Joel. Some tests should stay as regression coverage for the launch identities, but platform-level tests should shift to role labels and capability fixtures.

### What Leaks Camp Assumptions Into The Broader App

- `components/app-shell.tsx` imports `AppShellAccessState` from `lib/camp/shell-access` and uses Camp-specific app-shell blocking logic. This makes the global shell depend on a Camp module.
- `lib/app-area-access.ts` imports Camp access resolution to block camp-only users from non-Camp management APIs. The behavior is useful, but the ownership should be a shared app-area access layer rather than Camp owning the platform gate.
- Main navigation includes Camp as a first-class module, which is fine. The leak is not navigation visibility; it is Camp-specific access code deciding global platform availability.
- `app/shell-continuity.css` and `app/globals.css` contain Camp shell and orphaned `camp-command-center` selectors. Camp styling can remain isolated, but dead selectors should not live indefinitely in global CSS.
- Core event types include `camp`, and task baseline logic treats `camp` as high priority. That is a reasonable ministry event category, but it should not depend on Camp Oakwood implementation details.

### What Should Become Shared Platform Infrastructure

- App-area access gating and capability resolution.
- Sensitive-data classification and safe-display helpers.
- Repository pattern for Supabase live mode plus deterministic mock fallback.
- Operation dialog / sheet pattern for mobile command centers.
- Pending action plus confirmation plus audit lifecycle from Camp EMMA.
- Provider-safe adapter result shape: configured/unavailable/provider_error/invalid_output/timeout.
- Import pipeline skeleton: source inspection, checksum metadata, preview, warning rows, ambiguous blocking, commit, audit.
- Signature/stroke capture primitives, if future workflows need signatures or acknowledgement.
- Audit status helpers for corrected/superseded/voided/archive visibility.

### What Should Stay Isolated Under Camp

- Camp medical and medication schema.
- Camp restricted RLS policy logic until a general sensitive-record framework exists.
- Camp-specific roster, team, vehicle, cabin, medication, and guardian handoff workflows.
- Oakwood Quick View field mapping and source-specific import parser.
- Medical Command user experience and Andrew-only restriction until product requirements define a broader capability model.
- Camp EMMA safe search answer logic until shared AI routing can prove it preserves Camp data boundaries.

### What Should Be Deprecated Or Removed Later

- `components/camp-command-center.tsx` is orphaned and should not be restored. First capture any still-useful medication photo UI ideas into active components or docs, then remove the component in a focused cleanup PR.
- Orphaned global CSS for `.camp-command-center` should be removed with the orphaned component.
- Legacy Camp EMMA command routes `app/api/camp/emma/command` and `app/api/camp/emma/confirm` should be deprecated after confirming the live UI uses `app/api/camp/emma/actions` for controlled actions.
- Email-local-part inference for Andrew/Jaci/Joel should be retired after durable `camp_access_members` assignments are confirmed in production.
- Docs that still describe Camp EMMA as having no provider calls should be refreshed. Current code supports provider-assisted controlled actions and conversational fallback behavior.

## Shared Platform Extraction Candidates

| Candidate | Current Camp home | Classification | Recommendation |
|---|---|---|---|
| App-area access gating | `lib/camp/shell-access.ts`, `lib/app-area-access.ts`, `components/app-shell.tsx` | Move to Shared Platform | Create `lib/access/app-area.ts` or similar. Camp can provide one capability source, but global shell should not import Camp-specific types. |
| Durable role and capability labels | `lib/camp/access-roles.ts`, `lib/camp/access-control.ts` | Needs redesign before reuse | Keep Camp durable roles, but design a platform capability model before using this for ministry, SAGE, or future discipleship modules. |
| Person-name restricted actors | `lib/camp/permissions.ts` | Duplicate should be removed | Replace named actors in new code with durable capability names. Keep compatibility until production role rows are verified. |
| Safe-data display helpers | `lib/camp/public-safety.ts`, `lib/camp/access.ts`, `lib/camp/leader-safety.ts` | Move to Shared Platform | Extract sensitive-data category helpers and safe indicator formatting. Keep Camp-specific fields in Camp. |
| Medical/guardian restricted boundaries | `lib/camp/restricted-data.ts`, RLS migrations | Keep in Camp | This is high-sensitivity Camp-specific behavior. Reuse principles, not the concrete schema. |
| Supabase/mock repository fallback | `lib/camp/repository.ts`, `lib/camp/store.ts` | Move to Shared Platform | Extract a small pattern or helper for "live when configured, deterministic mock otherwise." Do not move the whole repository. |
| Mobile command-center shell | `components/camp/camp-shell.tsx`, `components/camp/camp-nav.tsx`, `components/camp/camp-provider.tsx` | Move to Shared Platform | Derive shared primitives for operational module shells, bottom nav, command sheet launcher, and day/context provider. Keep Camp chrome/colors as Camp theme. |
| Operation dialog/sheet workflows | `components/camp/camp-operation-dialog.tsx`, `camp-tool-pages.tsx` | Move to Shared Platform | Extract modal/sheet primitives after untangling Camp-specific form code. |
| Bulletin board patterns | `app/api/camp/bulletins`, team bulletin types | Needs redesign before reuse | Concept fits platform-wide updates. Current implementation is team/Camp scoped and should not become the general announcement model unchanged. |
| Schedule/event display patterns | `lib/camp/days.ts`, `components/camp/camp-day-selector.tsx`, Camp schedule pages | Move to Shared Platform | Reuse day selector and schedule grouping for retreats, events, discipleship plans, and Scripture engagement calendars. |
| Audit status helpers | `CampAuditStatus`, supersedes/void/archive helpers in `store.ts` and `repository.ts` | Move to Shared Platform | Extract generic audit lifecycle helpers. Keep medication schema and regulatory-like workflows in Camp. |
| Student safety indicators | `hasMedicalAlert`, `hasDietaryAlert`, `emergencyContactOnFile`, leader safety docs | Needs redesign before reuse | Useful pattern, but future Planning Center/student work needs its own source-of-truth and consent model. Do not generalize as a parallel student database. |
| AI prompt-loading conventions | `lib/command-center/sage.ts`, `lib/ai/prompts`, `lib/camp/emma*.ts`, `lib/emma/skills` | Move to Shared Platform | Move common prompt assembly, provider result wrappers, and skill metadata into `lib/ai`; keep assistant identity prompts separate. |
| Controlled AI action lifecycle | `lib/camp/emma-actions.ts`, migrations 022/017 | Move to Shared Platform | This is a platform-grade pattern: parse, validate, propose, confirm, write, audit. Generalize after Camp action routes are reconciled. |
| Camp EMMA deterministic search | `lib/camp/emma.ts`, `app/api/camp/emma/route.ts` | Keep in Camp | Keep until shared AI routing can enforce Camp-specific minimization and access. |
| Provider adapters | `lib/camp/emma-azure-provider.ts`, `lib/camp/emma-openai-provider.ts`, `lib/command-center/sage.ts`, `lib/emma/providers/*` | Needs redesign before reuse | Normalize provider interfaces in `lib/ai/providers` without merging assistant trust models. |
| Import preview/commit/audit pipeline | `lib/camp/import.ts`, `lib/camp/oakwood-import.ts`, `app/api/camp/import/*` | Move to Shared Platform | Extract generic import pipeline. Keep Oakwood parser as one adapter. |
| Workbook upload parsing | `lib/camp/oakwood-upload-source.ts` | Move to Shared Platform | Generalize file kind detection, sheet selection, checksum, size limits, and non-persistence guarantees. |
| Camp Oakwood field mapping | `lib/camp/oakwood-source-format.ts`, `docs/camp/CAMP_IMPORT_FIELD_MAP.md` | Keep in Camp | Source-specific adapter only. |
| Signature pad | `components/camp/camp-tool-pages.tsx`, `CampSignatureTouchBridge` | Move to Shared Platform | Extract reusable signature/acknowledgement component if another workflow needs signatures. |
| Camp access admin UI | `components/camp/camp-access-admin.tsx`, `lib/camp/access-admin.ts` | Needs redesign before reuse | Useful admin pattern, but platform roles and app areas should be modeled first. |
| Test helpers for sensitive boundaries | `lib/camp/*test.ts`, `tests/camp*.spec.ts` | Move to Shared Platform | Extract test fixtures/assertions for "safe view must not contain restricted strings." Keep Camp scenario tests. |
| Orphaned monolithic command center | `components/camp-command-center.tsx` | Duplicate should be removed | Remove after active medication photo UI/reference gaps are resolved. |

## Refactor And Deprecation Plan

### Phase 0: Audit Stabilization

- Keep this audit branch code-free except documentation.
- Do not remove or migrate anything yet.
- Mark `components/camp-command-center.tsx` as deprecated in docs if not already clear.
- Refresh stale docs that now conflict with SAGE Phase 1B and Camp EMMA provider-assisted actions.

### Phase 1: Boundary Cleanup

- Move global app-area access concepts out of Camp-owned types.
- Introduce shared app-area/capability language: `core_operations`, `camp_operations`, `personal_command_center`, future `discipleship_planning`.
- Keep Camp route/API enforcement behavior unchanged while changing ownership of shared access types.
- Add tests proving camp-only users remain blocked from non-Camp APIs and full users still see the core platform shell.

### Phase 2: AI Cohesion

- Create the first real shared `lib/ai` runtime contracts: skill metadata, prompt assembly fragments, provider result categories, sensitive-context categories, and audit-safe logging helpers.
- Keep EMMA, Camp EMMA, and SAGE identities separate.
- Reconcile Camp EMMA actions so `app/api/camp/emma/actions` is canonical, then deprecate `command` and `confirm`.
- Decide whether Camp EMMA search queries should log to shared AI audit tables or a Camp search audit table.

### Phase 3: Operational UI Extraction

- Extract reusable operational shell primitives from Camp: command nav, bottom sheet launcher, mode tabs, day selector, operation dialog, status chips, and save feedback.
- Keep the deep-blue Camp shell as a Camp theme.
- Use extracted primitives for future ministry command-center modules rather than duplicating Camp UI.

### Phase 4: Data And Import Pipeline

- Split generic import infrastructure from source-specific Oakwood logic.
- Rename generic concepts from `Oakwood` to `registrationImport` or `sourceImport` where safe.
- Keep Oakwood field mapping as `lib/camp/import-sources/oakwood-quick-view.ts` or equivalent.
- Preserve non-persistence of raw workbooks, checksum audit, ambiguous-row blocking, and safe/restricted field split.

### Phase 5: Deprecation Cleanup

- Remove `components/camp-command-center.tsx` after active UI has equivalent medication photo support or the reference value is captured elsewhere.
- Remove orphaned `.camp-command-center` global CSS at the same time.
- Retire email-local-part fallback after durable role rows are confirmed and a rollback plan exists.
- Move outdated Camp docs into `docs/archive/` only after the current docs are updated.

## Competition-Readiness Implications

For a possible YouVersion/Gloo submission, the platform should present as one coherent ministry operating system:

- Lead Emergence is the platform brand.
- Camp is one module that proves the operational model under real pressure.
- EMMA is the ministry operations assistant family.
- SAGE is Andrew-only and should not appear as a staff-facing ministry assistant.
- Future Scripture engagement and discipleship planning should reuse shared event/task/schedule/AI/action/audit patterns rather than becoming a new isolated feature island.

Do not add YouVersion or Gloo integrations until the shared AI, access, and command-center boundaries are clean enough to explain simply.

## Verification Notes

This audit inspected:

- Camp routes under `app/(app)/camp/**`
- Camp APIs under `app/api/camp/**`
- Camp UI under `components/camp/**`
- Orphaned legacy UI at `components/camp-command-center.tsx`
- Camp domain code under `lib/camp/**`
- Camp docs under `docs/camp/**` and related root docs
- Camp tests under `tests/camp*.spec.ts` and `lib/camp/*.test.ts`
- Camp and EMMA migrations under `supabase/migrations`
- Shared AI, EMMA, SAGE, app shell, and platform unification docs

No runtime verification was run because this was an audit-only documentation task with no code behavior changes.
