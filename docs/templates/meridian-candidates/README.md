# Meridian candidate templates

These templates add a curated overlay to an existing Obsidian vault without moving or renaming the vault's source notes. Copy only the template needed into `10 Meridian Candidates/` inside the vault, replace every placeholder, and run:

```bash
npm run rag:obsidian:dry-run
```

`meridian_ingest: candidate` is an explicit request for review, never approval. The importer keeps every accepted note private, unreviewed, authority-none, never-quote, and discovery-only. A candidate cannot reach the Supabase review queue while any required field or Scripture locator fails the versioned readiness contract.

The templates propose seven distinct object types:

- `passage`: observations and atomic claims tied to specific Scripture locators;
- `doctrine`: attributed doctrinal claims with tradition and consensus boundaries;
- `formation`: reviewed ministry practices constrained by Scripture and doctrine;
- `question`: question aliases and explicit facets, never a hidden answer key;
- `relationship_proposal`: a typed, scoped edge with rationale and confidence;
- `guardrail_proposal`: conclusions the evidence does not permit;
- `derived_journey`: a review artifact that remains authority-none.

Do not place personal, pastoral-care, safeguarding, medical, student-identifying, or raw private journal material in a candidate. Do not paste canonical Bible text; store Scripture locators only. Promotion remains a separate human-reviewed Supabase transaction.
