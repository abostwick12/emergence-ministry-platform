---
description: Audit CSS and components for design token compliance and pattern violations
---

# Design Audit

Scan the files touched in this task (or the entire `app/` and `components/` tree if no specific files) for design system violations. Report each finding with file path and line number.

## Token Compliance

Flag any hardcoded value that has a token equivalent in `app/globals.css`:

**Colors — should use tokens:**
- `#f3eadb`, `#eee3d1`, `#f7f0e5`, `#e8dcc7` → `var(--parchment-ivory/warm/light/aged)`
- `#f6f7f9` → `var(--bg)`
- `#ffffff` / `white` (in non-reset contexts) → `var(--surface)`
- `#111827` / `#0f2c54` → `var(--text)`
- `#64748b` → `var(--muted)`
- `#1d4ed8` → `var(--primary)`
- `#dbeafe` → `var(--primary-soft)`
- `#15803d` → `var(--success)`, `#b45309` → `var(--warning)`, `#b91c1c` → `var(--danger)`
- `#d8dee8` → `var(--line)`

**Shadows — should use token scale:**
- Any `box-shadow` literal in a component rule → `var(--shadow-sm/md/lg/xl)`

**Radii — should use token scale:**
- `border-radius: 6px` → `var(--radius-sm)`
- `border-radius: 8px` → `var(--radius-md)`
- `border-radius: 12px` → `var(--radius-lg)`
- `border-radius: 999px` → `var(--radius-pill)`

**Font sizes — should use token scale:**
- `font-size: 11px` → `var(--text-xs)`, `13px` → `var(--text-sm)`, `14px` → `var(--text-base)`, etc.

## Pattern Violations

Flag these anti-patterns in JSX:

- `style={{ margin: 0 }}` or `style={{ marginTop: 0 }}` on a `.section-title` → use `className="section-title flush"`
- `style={{ justifyContent: "space-between" }}` on a `.toolbar` → use `className="toolbar split"`
- `className="calendar-nav-btn"` → use `className="button icon"`
- `className="event-title-btn"` → use `className="button ghost"`
- `className="progress-chip"` → use `className="pill blue"` (or appropriate color)
- Any `import styles from "*.module.css"` in a new file → this codebase uses global CSS only; no new CSS modules

## CSS Module Detection

Check for any `.module.css` files. There should be none — the only module (`worship-planning-page.module.css`) was deleted. If you find a new one, flag it.

## Report Format

List each violation as:
```
[file:line] VIOLATION_TYPE — description
```

End with a summary: "N violations found" or "No violations found."

After reporting, ask the user whether to auto-fix the violations.
