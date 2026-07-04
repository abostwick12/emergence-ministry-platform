# Shared AI Layer

`lib/ai` is reserved for reusable AI architecture shared by EMMA, Camp EMMA,
SAGE, and future Lead Emergence assistants.

No runtime code has been moved here yet. This folder exists to mark the target
home for shared skill contracts, prompt fragments, provider-safe helpers, and
routing utilities once a focused refactor can preserve existing behavior.

Target structure:

```text
lib/ai/
  skills/
    shared/
    ministry/
    camp/
    command-center/
  prompts/
    shared/
    emma/
    sage/
  routing/
    skill-router.ts
```

See [`docs/architecture/ai-skill-system.md`](../../docs/architecture/ai-skill-system.md)
for the governing rules.
