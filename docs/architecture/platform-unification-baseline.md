# Platform Unification Baseline

This baseline defines how future Lead Emergence modules should connect to one
cohesive platform instead of becoming isolated feature areas.

## Platform Areas

| Area | User-facing purpose | Current primary code |
|---|---|---|
| Core ministry operations | Events, tasks, communication previews, budgets, integration activity, and activity logs | `app/(app)`, `components/`, `lib/` |
| Camp Command Center | Camp Oakwood operational control center | `app/(app)/camp`, `components/camp`, `lib/camp` |
| EMMA | Ministry and Camp AI command layer | `lib/emma`, `lib/camp/emma*.ts`, `app/api/*/emma*` |
| Personal Command Center / SAGE | Andrew-only personal command center now; future personal executive assistant | `app/(app)/command-center`, `components/command-center`, `lib/command-center` |
| Reusable AI workflows | Shared skill contracts, prompts, routing, and provider-safe helpers | Target: `lib/ai` |

## Naming Rules

- Product brand: **Lead Emergence Automated Platform**.
- Shell wordmark: **Lead Emergence** and **AUTOMATED PLATFORM**.
- Use "core ministry operations" for the main event/task platform area.
- Use "Camp Command Center" for Camp Oakwood operations.
- Use "EMMA" for ministry and Camp AI assistance.
- Use "SAGE" only for Andrew's Personal Command Center assistant.
- Use "skill" for reusable AI workflow instructions or developer-agent
  automation guidance, and always identify which kind of skill is meant.

Do not reuse retired product names or old app-shell branding.

## Shared App Shell Rules

Future modules should connect through the protected app shell unless their
access model intentionally requires a separate shell:

- Core ministry modules use the main Lead Emergence shell.
- Camp uses the Camp shell and Camp navigation because it is a mobile-first
  operational tool with separate role behavior.
- Personal Command Center uses its own command-center layout because it is
  Andrew-only and not a ministry staff tool.

New modules should avoid creating a fourth shell unless the access model,
navigation model, and visual density truly require it. Prefer shared primitives,
global tokens, existing repository patterns, and intentional route groups.

## Access Control Baseline

Access control is intentionally layered:

| Layer | Current home | Applies to | Rule |
|---|---|---|---|
| Auth session | `lib/auth/server.ts` | All protected routes and APIs | Every protected request must resolve a server session |
| Core role access | `lib/authorization.ts`, `lib/app-area-access.ts` | Core ministry operations | Admin/Leader active, Student/Parent inactive |
| Ministry scope | `lib/ministry/scope.ts`, Supabase RLS | Core ministry and EMMA audit tables | Server resolves `ministry_id`; browser values are not trusted |
| Camp access | `lib/camp/access-control.ts`, `lib/camp/permissions.ts` | Camp pages and APIs | Durable Camp roles first, email fallback only as transitional behavior |
| Personal Command Center | `lib/command-center/access.ts` | SAGE and Andrew-only personal tools | Single configured Andrew email, no delegation |
| AI risk/access | `lib/emma/risk.ts`, target `lib/ai` | Runtime AI workflows | Context categories, risk, approval, and audit govern execution |

Future modules should add access through a small server-only gate in `lib/<area>`
or a shared access package. UI checks are allowed for navigation polish, but
server routes must enforce the real boundary.

## Repository Pattern Rules

New module code should follow this shape:

```text
app/(app)/<module>/          route entry and server components
app/api/<module>/            server-only API boundary
components/<module>/         module UI components
lib/<module>/types.ts        domain types
lib/<module>/repository.ts   Supabase/mock persistence boundary
lib/<module>/access.ts       server-side access helpers
lib/<module>/*.test.ts       unit tests for behavior and boundaries
docs/<module>/               module-specific docs
tests/<module>*.spec.ts      end-to-end tests when user flows are visible
```

Keep provider APIs, Supabase writes, and secret handling out of React
components. Components should call API routes, server actions, or repository
helpers through established boundaries.

## Environment Config Rules

- Client-readable variables must be limited to values safe for browser bundles.
- Provider secrets must be server-only and must never use `NEXT_PUBLIC_`.
- Shared provider variables should be documented in `.env.example` by owner:
  core EMMA, Camp EMMA, SAGE, or future integration.
- Reusing one provider variable across assistants is allowed only when the docs
  explain the shared behavior and the more restrictive assistant still passes
  its access and data-minimization rules.
- Tests must default to mock/stub behavior without live provider credentials.

## Documentation Rules

Canonical architecture docs now live in `docs/architecture/`.

Architecture Evolution docs in `docs/` define the long-term platform north
star and should be read before broad hub, Meridian, retrieval, or Vision
Platform work:

- `docs/Architecture_Vision.md`
- `docs/Architecture_Roadmap.md`
- `docs/Meridian.md`
- `docs/Vision_Platform.md`
- `docs/Decision_Center_Design.md`
- `docs/Obsidian_Knowledge_Model.md`

Module docs should describe implementation details, current gaps, and
regression risks, then link back to the canonical architecture docs for shared
rules. Avoid copying long policy blocks into multiple module docs; copied
guidance drifts quickly.

When behavior changes, update the closest module doc and the architecture doc
only if the shared rule changes.

## Testing Baseline

Before a module is considered complete, it should have:

- unit tests for repository, access, routing, and sensitive-data boundaries
- end-to-end tests for visible user flows
- mock/stub tests for external providers
- schema or migration tests when database shape changes
- design-check coverage when `app/` or `components/` are touched

The full release verification remains:

```bash
npm install
npm run design-check
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

If dependencies are already installed and unchanged, `npm install` can be
skipped with that reason stated.

## Cleanup Queue

These are known unification follow-ups. Do not fold them into unrelated feature
work.

| Item | Why it matters | Suggested future PR |
|---|---|---|
| Introduce shared `lib/ai` contracts | Future SAGE work should reuse the shared skill/prompt conventions instead of recreating assistant-local playbooks | Move only common contracts first |
| Reconcile Camp EMMA command routes | Multiple command/action paths increase maintenance risk | Route audit and deprecation plan |
| Refresh stale Camp AI docs | Some docs describe old missing-provider state | Focused Camp doc correction |
| Audit orphaned Camp component | `components/camp-command-center.tsx` is retained as reference | Decide archive/remove path when safe |
| Align environment docs by assistant owner | Camp fallback and SAGE Phase 1B can use server-only `OPENAI_API_KEY`; Command Center chat degrades gracefully when it is missing | Keep provider keys out of client code |
| Add shared access documentation | Access gates are correct but scattered | Create `docs/architecture/access-control.md` if needed |
| Add AI registry tests for future shared skills | Prevent duplicate skill keys and prompt drift | Add when `lib/ai` contains runtime code |
