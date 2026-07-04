---
description: Create a new component that follows the established design system and architecture
---

# New Component

Follow this checklist when adding any new React component to this codebase.

## File Placement

- UI components → `components/<component-name>.tsx` (kebab-case filename)
- Camp-specific components → `components/camp/<component-name>.tsx`
- Page-level components (used inside `app/`) → same as above
- No new CSS Module files (`.module.css`) — use global CSS classes only

## Styling Rules

Do NOT create a new CSS module. Do NOT use Tailwind utility classes (the codebase uses Tailwind only as a CSS reset). Add component styles to `app/globals.css` under a namespaced selector.

Use existing token variables for every value:

```css
.my-component-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  color: var(--text);
  font-size: var(--text-base);
}
```

Available tokens (all in `app/globals.css` `:root`):
- Colors: `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--line`, `--primary`, `--primary-soft`, `--success`, `--warning`, `--danger`
- Parchment: `--parchment-ivory`, `--parchment-warm`, `--parchment-light`, `--parchment-aged`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
- Radii: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-pill` (999px)
- Type: `--text-xs` (11px) through `--text-2xl` (28px)

## Class Reuse

Before writing new CSS, check if an existing class covers the need:

| Need | Class to use |
|---|---|
| Container with shadow + radius | `.panel` (add `.panel.large` for 12px radius) |
| Smaller floating card | `.liquid-card` or `.liquid-card-strong` |
| Section heading row with action | `<div class="toolbar split">` |
| Heading with no margin | `<h2 class="section-title flush">` |
| Small all-caps label | `<p class="eyebrow">` |
| Muted body text | `<p class="muted">` |
| Primary action | `<button class="button primary">` |
| Secondary action | `<button class="button">` |
| Text/link button | `<button class="button ghost">` |
| 32×32 icon button | `<button class="button icon">` |
| Full-width row button | `<button class="button row">` |
| Compact button | `<button class="button compact">` or `<button class="compact-button">` |
| Status badge | `<span class="pill">`, `<span class="pill blue/green/amber/red">` |

## Layout Context

- Pages inside the main app shell render inside `.app-content.app-scroll-region`
- Camp pages render inside `.camp-shell-body` with the `.camp-cc` namespace active
- Worship page uses `.worship-page.liquid-page-panel.liquid-workspace` wrapper
- Do not add a custom scroll container inside a page — the shell handles scrolling

## TypeScript

- Use named exports only (`export function MyComponent()`) — no default exports
- Keep `"use client"` directive at the top only when the component needs browser APIs or event handlers
- Server Components are the default for data-display components

## After Writing

Run `/design-audit` to check the new component for token compliance before committing.
