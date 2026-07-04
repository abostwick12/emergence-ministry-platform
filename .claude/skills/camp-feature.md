---
description: Add a feature to the Camp subsystem following its architecture and token conventions
---

# Camp Feature

The Camp subsystem has its own shell, data layer, and design namespace. Follow these rules when adding anything to it.

## Architecture

```
app/camp/                   ← route tree (Next.js App Router)
components/camp/            ← all Camp-specific components
lib/camp/                   ← data, adapters, EMMA logic, types
app/globals.css (.camp-cc)  ← Camp token namespace and dark aquatic theme
```

## Token Namespace

Camp components render inside `.camp-cc`, which provides these semantic aliases:

```css
.camp-cc {
  --camp-accent: var(--primary);   /* bridges to global primary */
  --camp-ink:    var(--text);      /* bridges to global text */
  --camp-muted:  var(--muted);     /* bridges to global muted */
}
```

The dark aquatic override (`.camp-cc.deep-blue` or `@media prefers-color-scheme: dark`) replaces these with deep navy/slate values. When adding new camp-specific color rules, always use `--camp-accent`, `--camp-ink`, or `--camp-muted` rather than hardcoding so they adapt to both modes.

For backgrounds and borders in the aquatic theme, use `.camp-cc-card`, `.camp-cc-surface`, `.camp-cc-panel` — check `app/globals.css` for the existing class definitions before adding new ones.

## EMMA (Conversational AI)

EMMA routes live in `app/api/camp/emma/` and `app/api/camp/emma/actions/`.

- Search queries → `lib/camp/emma-finder.ts` (keyword-based, no AI required)
- Action commands → `lib/camp/emma-command-interpreter.ts` → `lib/camp/emma-action-runner.ts`
- Provider fallback order: Azure → OpenAI → keyword-only finder
- NEVER print or log `OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY`
- Leader role: finder only, gracefully deny write commands
- Admin role: full search + write actions via confirmation flow

When adding new EMMA commands, add:
1. A pattern in `emma-command-interpreter.ts`
2. A handler in `emma-action-runner.ts`
3. A test case in `tests/camp-mobile-command-center.spec.ts`

## Data Layer

Camp data uses stub adapters in `lib/camp/` during development. When the data layer is live (Supabase), adapters are swapped at the module level — do not write business logic that talks to Supabase directly from a component.

Never call `supabase.from()` inside a React component. Use server actions or API routes.

## Stub Mode

Camp pages show `<span class="pill stub">Preview only</span>` badges when running against stub data. Do not remove these badges — they are intentional safety signals for the ministry team.

## Access Control

Camp has role-based visibility:
- `shellAccess.kind === "full"` — full Emerge shell (admin/leader)
- `shellAccess.kind === "camp-only"` — camp UI only, no main nav
- `shellAccess.kind === "unresolved"` — readiness check failed

Check `lib/camp/shell-access.ts` before adding any UI that should be gated.

## CSS Additions

Add camp-specific styles to the `.camp-cc` block in `app/globals.css`. Namespace all new selectors with `.camp-cc-*` or `.camp-emma-*` to avoid collisions with main app CSS.

Use the shadow and radius tokens: `var(--shadow-md)`, `var(--radius-md)`, etc. — they work inside `.camp-cc` just as in the main shell.

## After Adding a Camp Feature

1. Test visually at 390px (mobile) — camp is primarily a mobile tool
2. Verify the aquatic dark theme renders correctly
3. Run `/pre-push` before committing
