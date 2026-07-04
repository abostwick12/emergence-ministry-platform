#!/usr/bin/env node
// Deterministic design-system guardrail.
//
// Scans component and CSS files for the anti-patterns the design system
// retired, so drift is caught automatically instead of relying on an agent
// (or a human) remembering the conventions. Runs from the Claude Code
// PostToolUse hook after edits, and can be run directly: `npm run design-check`.
//
// Scope:
//   - no args  -> checks files changed vs. git HEAD (staged, unstaged, untracked)
//   - with args -> checks the given file paths
//
// Exit codes:
//   0 = clean
//   2 = violations found (stderr lists them; hook feeds this back to the agent)

import { execSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

// Retired one-off class names -> their unified replacement.
const RETIRED_CLASSES = {
  "calendar-nav-btn": 'className="button icon"',
  "event-title-btn": 'className="button ghost"',
  "progress-chip": 'className="pill blue" (or green/amber/red)'
};

// Inline-style overrides that now have a modifier class.
const INLINE_STYLE_PATTERNS = [
  {
    re: /style=\{\{\s*margin:\s*0\s*\}\}/,
    msg: "inline `margin: 0` — use the `flush` modifier (e.g. `section-title flush`)"
  },
  {
    re: /style=\{\{\s*marginTop:\s*0\s*\}\}/,
    msg: "inline `marginTop: 0` — use the `flush` modifier (e.g. `section-title flush`)"
  },
  {
    re: /style=\{\{\s*justifyContent:\s*["']space-between["']\s*\}\}/,
    msg: "inline `justifyContent: space-between` — use the `toolbar split` modifier"
  }
];

function changedFiles() {
  const out = [];
  try {
    const tracked = execSync("git diff --name-only HEAD", { encoding: "utf8" });
    const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" });
    for (const line of (tracked + untracked).split("\n")) {
      const f = line.trim();
      if (f) out.push(f);
    }
  } catch {
    // Not a git repo or git unavailable — nothing to scan.
  }
  return [...new Set(out)];
}

function inScope(file) {
  if (!/\.(tsx|jsx|css)$/.test(file)) return false;
  return file.startsWith("app/") || file.startsWith("components/");
}

function checkFile(file, findings) {
  const abs = join(ROOT, file);
  if (!existsSync(abs) || !statSync(abs).isFile()) return;

  // A new CSS Module anywhere is a violation — this codebase uses global CSS only.
  if (file.endsWith(".module.css")) {
    findings.push(`${file}:1 — CSS Modules are not used in this codebase; move styles into app/globals.css`);
    return;
  }

  const lines = readFileSync(abs, "utf8").split("\n");
  lines.forEach((line, i) => {
    const n = i + 1;

    if (/\.(tsx|jsx)$/.test(file)) {
      if (/from\s+["'][^"']*\.module\.css["']/.test(line)) {
        findings.push(`${file}:${n} — imports a CSS Module; use global classes in app/globals.css instead`);
      }
      if (line.includes("className")) {
        for (const [cls, replacement] of Object.entries(RETIRED_CLASSES)) {
          if (new RegExp(`["'\\s]${cls}["'\\s]`).test(line)) {
            findings.push(`${file}:${n} — retired class \`${cls}\` — use ${replacement}`);
          }
        }
      }
      for (const { re, msg } of INLINE_STYLE_PATTERNS) {
        if (re.test(line)) {
          findings.push(`${file}:${n} — ${msg}`);
        }
      }
    }
  });
}

function main() {
  const args = process.argv.slice(2);
  const targets = (args.length ? args : changedFiles()).filter(inScope);

  const findings = [];
  for (const file of targets) checkFile(file, findings);

  if (findings.length === 0) {
    // Quiet on success so the hook doesn't add noise.
    process.exit(0);
  }

  process.stderr.write(
    "\nDesign system check found issues (see .claude/skills/design-audit.md):\n" +
      findings.map((f) => `  • ${f}`).join("\n") +
      "\n\nFix these or run /design-audit for the full token audit.\n"
  );
  process.exit(2);
}

main();
