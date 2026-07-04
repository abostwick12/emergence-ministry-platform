---
description: Checklist to run before and after any dependency upgrade or major refactor
---

# Upgrade Checklist

Run this before merging any branch that upgrades a dependency, changes global CSS significantly, or refactors shared infrastructure.

## Before Upgrading

1. **Read `AGENTS.md` and `CLAUDE.md`** — confirm the upgrade doesn't conflict with stated product identity, architecture decisions, or safety rules.

2. **Check stub vs live** — confirm the upgrade doesn't accidentally enable live integrations. Stub mode is intentional. Look for `process.env.OPENAI_API_KEY`, `process.env.SUPABASE_URL`, etc. — these should stay server-side only and never appear in client bundles or logs.

3. **Read the current `package.json` diff** — note every version change. Flag any that change major version (potential breaking changes).

## CSS / Design System

After any change to `app/globals.css` or `app/shell-continuity.css`:

- Confirm the `:root` block in `globals.css` is the single source of truth — there must be NO `:root` block in `shell-continuity.css`
- Confirm `.camp-cc` light-mode block still bridges to global tokens (`--camp-accent: var(--primary)` etc.)
- Run `/design-audit` on all changed component files

## After Upgrading

Run these commands in this order and fix failures before merging:

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
```

Expected baseline: 76 passed, 1 skipped, 0 failed (Playwright).

## Visual Spot-Check (5 routes)

Open the app and verify these pages look correct:
- `/dashboard` — parchment shell, sidebar, dashboard metrics visible
- `/events` — event board with card grid
- `/worship` — worship planning page with status badges
- `/camp` — aquatic dark shell, Camp Command Center
- `/tasks` — task kanban

Focus on:
- Consistent shadows and border radii across cards
- Eyebrow text uppercase in primary blue
- Buttons use consistent shape
- Mobile bottom nav shows icons above labels
- Camp dark theme doesn't bleed into main shell

## Supabase Migration Rules

- Never run destructive migrations against the live production DB without explicit approval
- Prefer additive, idempotent migrations
- Confirm the target project before running `supabase db push`
- After applying: run `npm run typecheck` to catch any type drift from schema changes
