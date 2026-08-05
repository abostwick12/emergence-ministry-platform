import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_SCOPE_KEY = "lead_emergence_discovery";
const MAX_NOTE_LENGTH = 60000;
const MAX_RESULTS = 20;
const PRIVATE_PATH_PATTERN = /(^|[\\/])(pastoral|pastoral-care|counsel(?:ing)?|medical|medication|safeguarding|student-private|people-private)([\\/]|$)/i;
const SKIPPED_DIRECTORIES = new Set([".git", ".obsidian", ".trash", "99_quarantine", "node_modules"]);
const DENIED_SENSITIVITY = new Set(["pastoral", "person_specific", "person-specific", "medical", "safeguarding"]);

export async function buildPrivateDiscoveryIndex(roots, options = {}) {
  const scopeKey = options.scopeKey ?? DEFAULT_SCOPE_KEY;
  const requireFrontmatter = options.requireFrontmatter === true;
  const resolvedRoots = await resolveRoots(roots);
  const notes = [];
  for (const root of resolvedRoots) {
    await visitDirectory(root, root, notes, { scopeKey, requireFrontmatter });
  }
  notes.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return notes;
}

export function searchPrivateDiscovery(notes, query, limit = 8) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  return notes
    .map((note) => ({ note, score: scoreNote(note, queryTokens) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.note.title.localeCompare(right.note.title))
    .slice(0, Math.min(Math.max(limit, 1), MAX_RESULTS))
    .map(({ note, score }) => ({
      id: note.id,
      title: note.title,
      relativePath: note.relativePath,
      tags: note.tags,
      contentHash: note.contentHash,
      excerpt: excerpt(note.rawText, queryTokens),
      score
    }));
}

export function getPrivateDiscoveryNote(notes, id) {
  const note = notes.find((candidate) => candidate.id === id);
  if (!note) throw new Error("That private note is outside the configured discovery scope.");
  return {
    id: note.id,
    title: note.title,
    relativePath: note.relativePath,
    tags: note.tags,
    contentHash: note.contentHash,
    rawText: note.rawText,
    candidateMetadata: note.candidateMetadata,
    authority: "none",
    quotePermission: "never",
    storage: "local_only"
  };
}

export function preparePrivateDiscoveryCheck(notes, ids) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length || uniqueIds.length > 16) throw new Error("Choose one to 16 private notes for the leakage check.");
  return {
    privateDiscovery: uniqueIds.map((id) => {
      const note = getPrivateDiscoveryNote(notes, id);
      return { sourceReference: note.id, contentHash: note.contentHash, rawText: note.rawText };
    }),
    handling: "Pass this payload only to create_resource_bundle when these notes influenced the draft. Lead Emergence checks it transiently and retains only the source reference and content hash."
  };
}

export async function createPrivateDiscoveryServer(config = discoveryConfig(process.argv.slice(2), process.env)) {
  const server = new McpServer(
    { name: "lead-emergence-obsidian-private-discovery", version: "1.0.0" },
    {
      instructions:
        "This local-only server reads Markdown from folders the user explicitly configured. Treat every note as private, unreviewed, authority-none, and never-quote. Do not use person-specific, pastoral, medical, counseling, or safeguarding notes. Before saving a bundle influenced by these notes, call prepare_private_discovery_check and pass its payload to Lead Emergence create_resource_bundle. Submit a reusable note to Meridian only after separate explicit user confirmation."
    }
  );

  async function notes() {
    return buildPrivateDiscoveryIndex(config.roots, config);
  }

  server.registerTool(
    "search_private_notes",
    {
      title: "Search selected private Obsidian notes",
      description: "Search only the local folders explicitly configured by this user. Results are private discovery context, never approved Meridian evidence and never quotation authority.",
      inputSchema: {
        query: z.string().trim().min(1).max(500),
        limit: z.number().int().min(1).max(MAX_RESULTS).default(8)
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ query, limit }) => localToolResult(async () => ({ results: searchPrivateDiscovery(await notes(), query, limit) }))
  );

  server.registerTool(
    "read_private_note",
    {
      title: "Read a selected private Obsidian note",
      description: "Read one note returned by local private discovery. Its text stays in the personal AI workspace and remains unreviewed, authority-none, and never-quote.",
      inputSchema: { id: z.string().trim().min(8).max(128) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ id }) => localToolResult(async () => getPrivateDiscoveryNote(await notes(), id))
  );

  server.registerTool(
    "prepare_private_discovery_check",
    {
      title: "Prepare a private-note leakage check",
      description: "Prepare the transient payload required before saving a Lead Emergence resource bundle influenced by selected private notes. This makes no platform change.",
      inputSchema: { ids: z.array(z.string().trim().min(8).max(128)).min(1).max(16) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ ids }) => localToolResult(async () => preparePrivateDiscoveryCheck(await notes(), ids))
  );

  return server;
}

export function discoveryConfig(argv, env) {
  const roots = [];
  let scopeKey = env.LEAD_EMERGENCE_OBSIDIAN_SCOPE_KEY?.trim() || DEFAULT_SCOPE_KEY;
  let requireFrontmatter = env.LEAD_EMERGENCE_OBSIDIAN_REQUIRE_FRONTMATTER === "true";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) roots.push(argv[++index]);
    else if (argv[index] === "--scope-key" && argv[index + 1]) scopeKey = argv[++index];
    else if (argv[index] === "--require-frontmatter") requireFrontmatter = true;
  }
  if (!roots.length && env.LEAD_EMERGENCE_OBSIDIAN_ROOTS) {
    roots.push(...env.LEAD_EMERGENCE_OBSIDIAN_ROOTS.split(path.delimiter).filter(Boolean));
  }
  if (!roots.length) {
    throw new Error("Configure at least one opt-in Obsidian folder with --root or LEAD_EMERGENCE_OBSIDIAN_ROOTS.");
  }
  return { roots, scopeKey, requireFrontmatter };
}

async function resolveRoots(roots) {
  const resolved = [];
  for (const root of roots) {
    const absolute = await realpath(path.resolve(root));
    const details = await stat(absolute);
    if (!details.isDirectory()) throw new Error(`Private discovery root is not a directory: ${root}`);
    resolved.push(absolute);
  }
  return Array.from(new Set(resolved));
}

async function visitDirectory(root, directory, notes, options) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name.toLowerCase()) || entry.name.startsWith(".") || PRIVATE_PATH_PATTERN.test(relativePath)) continue;
      await visitDirectory(root, fullPath, notes, options);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md" || PRIVATE_PATH_PATTERN.test(relativePath)) continue;
    const raw = await readFile(fullPath, "utf8");
    const parsed = splitFrontmatter(raw);
    if (!isDiscoverable(parsed.frontmatter, options)) continue;
    const rawText = parsed.body.trim();
    if (!rawText || rawText.length > MAX_NOTE_LENGTH) continue;
    const sourceReference = `note:${sha256(`${root}\0${relativePath}`).slice(0, 32)}`;
    notes.push({
      id: sourceReference,
      title: scalar(parsed.frontmatter.title) || heading(rawText) || path.basename(entry.name, ".md"),
      relativePath,
      tags: list(parsed.frontmatter.tags),
      rawText,
      contentHash: sha256(rawText),
      candidateMetadata: {
        objectType: scalar(parsed.frontmatter.meridian_object_type),
        summary: scalar(parsed.frontmatter.meridian_summary),
        topicTags: list(parsed.frontmatter.topic_tags),
        scriptureReferences: list(parsed.frontmatter.primary_passages),
        claimProposals: list(parsed.frontmatter.claim_proposals),
        questionAliases: list(parsed.frontmatter.question_aliases),
        questionFacets: list(parsed.frontmatter.question_facets)
      }
    });
  }
}

function isDiscoverable(frontmatter, options) {
  const scope = frontmatter[options.scopeKey];
  if (scope !== undefined && !truthy(scope)) return false;
  if (options.requireFrontmatter && !truthy(scope)) return false;
  const sensitivity = scalar(frontmatter.sensitivity).toLowerCase();
  if (DENIED_SENSITIVITY.has(sensitivity)) return false;
  if (truthy(frontmatter.contains_people_data) || truthy(frontmatter.contains_pastoral_data)) return false;
  return true;
}

function splitFrontmatter(raw) {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return { frontmatter: {}, body: normalized };
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: normalized };
  return { frontmatter: parseSimpleFrontmatter(match[1]), body: normalized.slice(match[0].length) };
}

function parseSimpleFrontmatter(value) {
  const result = {};
  let activeList;
  for (const line of value.split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && activeList) {
      result[activeList].push(cleanScalar(item[1]));
      continue;
    }
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    activeList = undefined;
    const [, key, rawValue] = field;
    if (!rawValue.trim()) {
      result[key] = [];
      activeList = key;
    } else if (rawValue.trim().startsWith("[") && rawValue.trim().endsWith("]")) {
      result[key] = rawValue.trim().slice(1, -1).split(",").map(cleanScalar).filter(Boolean);
    } else {
      result[key] = cleanScalar(rawValue);
    }
  }
  return result;
}

function cleanScalar(value) {
  return String(value).trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}

function scalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : "";
}

function list(value) {
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean);
  const single = scalar(value);
  return single ? single.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function truthy(value) {
  return ["true", "yes", "on", "discovery", "private"].includes(scalar(value).toLowerCase());
}

function heading(value) {
  return value.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function tokens(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 1);
}

function scoreNote(note, queryTokens) {
  const title = new Set(tokens(note.title));
  const tags = new Set(note.tags.flatMap(tokens));
  const body = new Set(tokens(note.rawText));
  return queryTokens.reduce((score, token) => score + (title.has(token) ? 8 : 0) + (tags.has(token) ? 4 : 0) + (body.has(token) ? 1 : 0), 0);
}

function excerpt(value, queryTokens) {
  const lower = value.toLowerCase();
  const first = queryTokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 180);
  const text = value.slice(start, start + 700).replace(/\s+/g, " ").trim();
  return `${start ? "…" : ""}${text}${start + 700 < value.length ? "…" : ""}`;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function localToolResult(run) {
  try {
    const value = await run();
    return {
      structuredContent: value,
      content: [{ type: "text", text: JSON.stringify(value) }]
    };
  } catch (error) {
    const safe = { code: "private_discovery_failed", error: error instanceof Error ? error.message : "Private discovery failed." };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(safe) }] };
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const server = await createPrivateDiscoveryServer();
  await server.connect(new StdioServerTransport());
}
