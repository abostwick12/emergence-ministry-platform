---
description: Run all required checks before pushing to the remote branch
---

# Pre-Push Checks

Run these commands in sequence. Stop and report the failure if any step fails — do not skip to the next step.

## Step 1 — TypeScript

```bash
npm run typecheck
```

Expected output: no output, exit 0. Any error means the push must not proceed.

## Step 2 — ESLint

```bash
npm run lint
```

Expected output: `✔ No ESLint warnings or errors`. Any warning or error must be fixed first.

## Step 3 — Production Build

```bash
npm run build
```

Expected output: clean build table with no red errors. New `next/image` warnings from unoptimized images are acceptable. Build failures must be fixed.

## Step 4 — End-to-End Tests

```bash
npx playwright test
```

The `playwright.config.ts` already sets `executablePath` to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. All tests should pass. Current baseline: 76 passed, 1 skipped, 0 failed.

If new test failures appear, confirm they are caused by this change (not pre-existing). Pre-existing failures are documented in AGENTS.md.

## Step 5 — Push

Once all checks pass:

```bash
git push -u origin <current-branch>
```

If push fails due to network error, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

## Completion Report

End with:
- branch name
- commit hash(es) pushed
- typecheck: pass / fail
- lint: pass / fail
- build: pass / fail
- e2e: N passed / N failed
