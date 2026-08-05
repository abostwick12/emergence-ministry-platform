# Private Obsidian discovery

## Boundary

Private Obsidian discovery runs as a local STDIO MCP server inside the user's Codex environment. The hosted Lead Emergence MCP never receives a vault path, lists vault files, or reads the vault.

Every discovered note remains:

- private and user-owned;
- unreviewed and authority-none;
- never-quote;
- unavailable to normal Meridian generation; and
- excluded from organizational reuse unless the user separately confirms candidate submission and an administrator later promotes it.

Person-specific, pastoral, counseling, medical, safeguarding, and similarly sensitive folders or frontmatter values fail closed and are not returned by the connector.

## Configure selected folders

Install project dependencies, then add the local connector to Codex with one or more explicitly selected folders:

```powershell
codex mcp add lead-emergence-obsidian-private -- node C:\path\to\lead-emergence\scripts\obsidian-private-discovery-mcp.mjs --root C:\path\to\vault\SelectedFolder
```

Repeat `--root` to select more than one folder. Folder selection is itself opt-in. A note can still opt out:

```yaml
---
lead_emergence_discovery: false
---
```

For a stricter scope, require per-note opt-in:

```powershell
codex mcp add lead-emergence-obsidian-private -- node C:\path\to\lead-emergence\scripts\obsidian-private-discovery-mcp.mjs --root C:\path\to\vault\SelectedFolder --require-frontmatter
```

Each eligible note must then declare:

```yaml
---
lead_emergence_discovery: true
---
```

The equivalent project command is `npm run mcp:obsidian-private -- --root <selected-folder>`.

## Draft workflow

1. Use `search_private_notes` and `read_private_note` only in the user's personal Codex workspace.
2. Ground shared theology, culture, and policy in the hosted Meridian `search` and `fetch` tools, not in private notes.
3. If a private note influenced a resource bundle, call `prepare_private_discovery_check`.
4. Pass the returned `privateDiscovery` payload to hosted `create_resource_bundle`.
5. The hosted server performs deterministic exact and fuzzy overlap checks before any bundle save.
6. Unsafe overlap returns `private_discovery_leakage` and stores no bundle.
7. A passing save discards transient raw text and retains only opaque source references, SHA-256 content hashes, and the passed-check timestamp.

Changing a local note changes its content hash. Retrying a bundle with different private provenance under the same idempotency key fails as an idempotency conflict.

## Candidate workflow

`submit_private_discovery_candidate` is a separate hosted write capability. It requires:

- an explicit `can_submit_candidates` grant;
- a leader or administrator MCP access level;
- the opaque source reference and exact hash returned by the local connector;
- explicit confirmation for the exact note; and
- bounded review metadata.

The candidate is stored as private, unreviewed, authority-none, discovery-only, and never-quote. It cannot enter approved Meridian retrieval until an administrator uses the existing candidate review and promotion workflow. Candidate submission does not approve, publish, quote, or externally communicate the note.

## Deployment and verification

Application activation requires the additive `20260805171914_platform_mcp_private_discovery.sql` migration and the matching application deployment. Do not enable candidate submission until both are present.

Verify with synthetic notes only:

1. confirm unselected and sensitive notes never appear;
2. confirm a safe local note can be searched and read;
3. confirm exact and high-similarity draft overlap is blocked before storage;
4. confirm a clean bundle stores only source references and hashes;
5. revoke `can_submit_candidates` and confirm nomination is denied; and
6. confirm a nominated note remains unreviewed until a different administrator completes human promotion.
