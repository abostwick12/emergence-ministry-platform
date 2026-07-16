# Meridian Scripture Knowledge Spine

The student Scripture flow uses the Meridian's curated knowledge spine before it ever exposes retrieved material to students.

## What Goes In

Use only launch-safe, excerpt-safe material:

- student ministry lessons, sermons, and platform vision notes from Andrew's own voice
- short scholar/reference summaries with citation metadata
- Scripture reading practices and leader-approved discussion guidance

Do not ingest raw leadership conflict, military transition material, personal journal content, care/medical details, or student-identifying information.

## Visibility Levels

- `student_visible`: safe for student recommendations and Keep Reading cards
- `internal_grounding`: Admin-only Meridian grounding for theology, voice, question shape, journeys, and resource direction; never shown to students
- `leader_only`: useful for leader review, not directly shown to students
- `private_review`: held out of product retrieval until Andrew explicitly promotes it
- `scholar_citation_only`: used for accountable synthesis/citation context, not copied into student-facing prose

## Launch Flow

1. Build a small curated pack from Obsidian source notes.
2. Promote only contest-safe chunks into `knowledge_sources` and `knowledge_chunks`.
3. Mark student-facing chunks as `student_visible`.
4. Let the student question route retrieve matching chunks for immediate digging questions and reading direction.
5. Keep leader review as the publishing gate for group discussion prompts and Slack delivery.

## Current App Behavior

If Supabase has student-visible knowledge chunks, the question flow uses them first.

If the table is empty or the migration is not applied yet, the app falls back to a small launch-safe knowledge pack covering garden/trust, suffering/lament, honest doubt, Exodus formation, and identity/belonging.

Embeddings are schema-ready through `knowledge_chunks.embedding`, but the first production slice uses safe metadata matching so the tryout does not depend on embedding generation being configured.

## Obsidian Importer

Dry-run the importer before writing anything to Supabase:

```bash
npm run rag:obsidian:dry-run
```

The dry-run reads the default Meridian vault folder at `~/Desktop/two-hemisphere brain` and writes a preview to `tmp/obsidian-rag-launch-pack-preview.json`.

Use a custom vault or output file when needed:

```bash
node scripts/obsidian-rag-import.mjs --vault "C:\Users\awbostwick\Desktop\two-hemisphere brain" --out tmp/launch-pack-preview.json
```

The importer only promotes own-voice notes marked `contest-candidate` or `student_visible`, then applies risk filters for private, leadership-review, military, personal, medical/care, counseling, family, abuse, and trauma material. Scholar notes marked `scholar-citation-only` are skipped for student-visible import until they receive citation review.

By default, the launch pack is capped to 80 sources and near-duplicate lesson title clusters are collapsed so the first contest dataset stays broad and reviewable. Use `--max-sources all` only after reviewing the preview output.

Production writes require all of these:

```bash
node scripts/obsidian-rag-import.mjs --apply --confirm-production-write --ministry-id "<ministry uuid>"
```

Apply mode also requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not run apply mode until the dry-run preview has been reviewed.
