# Claude Code Instructions

Read and follow [`AGENTS.md`](AGENTS.md) before editing this repository. `AGENTS.md` is the shared source of truth for product identity, architecture, safety, testing, visual acceptance, branching, pull requests, and deployment behavior.

This file adds Claude Code-specific workflow guidance only.

## Start-of-Session Checklist

Before changing code, run:

```bash
git status
git branch --show-current
git log --oneline -8
```

Then inspect:

- the current branch and its relationship to `main`
- open and recently merged pull requests
- unpushed commits
- uncommitted changes
- files already changed by prior Claude Code or Codex sessions

Do not recreate work that is already committed or merged.

When the user starts a new session, first report the repository state and relevant implementation files before making changes unless the user explicitly asks for immediate execution.

## Scope Discipline

- Make the smallest coherent change that satisfies the request.
- Do not combine unrelated refactors with a focused feature or correction.
- Preserve working functionality unless the task explicitly changes it.
- Do not replace an existing implementation merely because a new approach seems cleaner without first proving the current implementation cannot meet the requirement.
- When requirements conflict with the current architecture, explain the tradeoff before making a destructive change.

## Visual Work

For dashboard and UI work:

- treat the approved screenshot or mockup as the visual source of truth
- capture a fresh screenshot at the requested viewport
- compare the result directly against the acceptance criteria
- do not claim a visual task is complete only because typecheck, lint, build, and e2e pass
- do not describe a simple gradient as watercolor, liquid glass, or another requested visual treatment unless the screenshot visibly supports that description
- show the exact component, SVG, asset, or CSS tokens used when the user asks for implementation proof

When a user says the screenshot is still wrong, do not repeat minor opacity or spacing tweaks indefinitely. Reassess whether the implementation structure is preventing the requested result.

## Branch, PR, and Merge Rules

- Start new code work from the latest `main` unless explicitly instructed otherwise.
- Use a focused feature branch.
- Do not merge without explicit user approval.
- Do not force-push or rewrite shared history.
- Do not merge an older branch that would remove newer approved work.
- If the requested work is already merged, report that clearly and do not manufacture another merge.
- When opening or updating a PR, report the PR number, branch, base branch, commit hashes, checks, and preview status.

## Deployment Rules

- Vercel normally deploys production from `main` through the GitHub integration.
- Do not create a new Vercel project for an ordinary release.
- Do not change production domains, environment variables, or scopes without explicit approval.
- Do not claim production is verified unless the deployed environment and commit were actually confirmed.
- If Vercel access is unavailable, distinguish clearly between:
  - code merged to `main`
  - deployment expected to trigger
  - deployment actually verified

## Supabase Rules

- Treat Supabase Auth and Postgres as live production capabilities, not Stub Mode.
- Confirm the target project before applying migrations.
- Prefer additive, idempotent migrations.
- Never print secrets.
- Never run destructive or write-enabled tests against live ministry data without explicit approval.
- If a test would create or modify production records, stop and explain the limitation.

## Verification

Before marking code complete, run the checks required by `AGENTS.md`:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Run `npm install` when dependencies are missing or changed.

Do not skip checks simply because the requested change appears small. If a check cannot be run, say exactly why.

Do not weaken tests to hide regressions. Update tests only for intentional behavior changes while preserving equivalent coverage.

## Completion Report

End implementation work with a concise factual report containing:

- branch name
- files changed
- commit hash
- typecheck result
- lint result
- build result
- e2e result
- PR status
- deployment status, if actually verified
- remaining risks or manual checks

Avoid claiming actions were completed when they were only expected, inferred, or unavailable through the current tool connection.