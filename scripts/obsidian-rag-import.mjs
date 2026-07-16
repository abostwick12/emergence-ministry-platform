import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const STUDENT_VISIBLE_INPUT_VISIBILITIES = new Set(["contest-candidate", "student_visible"]);
const PRIVATE_VISIBILITIES = new Set([
  "private-review",
  "private_review",
  "leader-review",
  "leader_only",
  "scholar-citation-only",
  "internal_grounding",
  "internal-grounding"
]);
const RISK_PATTERNS = [
  /\babuse\b/i,
  /\bcounsel(or|ing)\b/i,
  /\bfamily\b/i,
  /\bhealth\b/i,
  /\bmedical\b/i,
  /\bmedication\b/i,
  /\bmilitary\b/i,
  /\bpersonal\b/i,
  /\bprivate\b/i,
  /\bsupport information form\b/i,
  /\btrauma\b/i
];

const DEFAULT_VAULT = path.join(os.homedir(), "Desktop", "two-hemisphere brain");
const DEFAULT_OUT = path.join(process.cwd(), "tmp", "obsidian-rag-launch-pack-preview.json");
const DEFAULT_MAX_SOURCES = 80;
const MAX_BODY_LENGTH = 3600;
const MAX_SUMMARY_LENGTH = 280;
const MAX_TITLE_LENGTH = 180;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const vaultPath = path.resolve(args.vault ?? process.env.OBSIDIAN_RAG_VAULT ?? DEFAULT_VAULT);
const outPath = path.resolve(args.out ?? DEFAULT_OUT);
const ministryId = args.ministryId ?? process.env.SUPABASE_MINISTRY_ID;

const plan = await buildLaunchPackPlan(vaultPath);
await writePreview(outPath, plan);

printSummary(plan, outPath);

if (args.apply) {
  if (!args.confirmProductionWrite) {
    throw new Error("Refusing to write to Supabase without --confirm-production-write.");
  }
  if (!ministryId) {
    throw new Error("Set SUPABASE_MINISTRY_ID or pass --ministry-id before applying.");
  }
  await applyPlan(plan, { ministryId });
}

export async function buildLaunchPackPlan(vaultRoot) {
  const ownVoiceDir = path.join(vaultRoot, "01 Source Notes", "01 Own Voice", "Generated");
  const scholarDir = path.join(vaultRoot, "01 Source Notes", "02 Scholar Hemisphere", "Generated");
  const files = [
    ...(await listMarkdownFiles(ownVoiceDir, "own_voice")),
    ...(await listMarkdownFiles(scholarDir, "scholar"))
  ];

  const sources = [];
  const skipped = [];
  const seenSourceKeys = new Set();
  const seenTitleKeys = new Set();

  for (const file of files) {
    const raw = await readFile(file.fullPath, "utf8");
    const note = parseSourceNote(raw, file);
    const decision = decideSourceVisibility(note);

    if (!decision.include) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: decision.reason
      });
      continue;
    }

    const source = toKnowledgeSource(note, vaultRoot);
    if (seenSourceKeys.has(source.sourceKey)) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: "duplicate_source"
      });
      continue;
    }

    seenSourceKeys.add(source.sourceKey);
    const titleKey = canonicalTitleKey(source.title);
    if (seenTitleKeys.has(titleKey)) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: "duplicate_title_cluster"
      });
      continue;
    }

    seenTitleKeys.add(titleKey);
    sources.push(source);
  }

  sources.sort((a, b) => b.launchScore - a.launchScore || a.title.localeCompare(b.title));
  const maxSources = args.maxSources;
  const cappedSources = maxSources === "all" ? sources : sources.slice(0, maxSources);
  const cappedOut = maxSources === "all" ? [] : sources.slice(maxSources);
  for (const source of cappedOut) {
    skipped.push({
      title: source.title,
      file: source.sourceUri,
      reason: "launch_pack_cap"
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    vaultRoot,
    mode: args.apply ? "apply" : "dry-run",
    sources: cappedSources,
    chunks: cappedSources.flatMap((source) => source.chunks.map((chunk) => ({ ...chunk, sourceKey: source.sourceKey }))),
    skipped,
    counts: {
      scanned: files.length,
      eligibleSources: sources.length,
      sources: cappedSources.length,
      chunks: cappedSources.reduce((total, source) => total + source.chunks.length, 0),
      skipped: skipped.length
    }
  };
}

function parseSourceNote(raw, file) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const sourceTitle = frontmatter.source_title ?? titleFromHeading(body) ?? path.basename(file.fullPath, ".md");
  const visibility = normalizeVisibility(frontmatter.visibility ?? "");
  const hemisphere = frontmatter.hemisphere ?? (file.kind === "scholar" ? "Scholar Hemisphere" : "Own Voice");
  const sourceCategory = frontmatter.source_category ?? "";
  const sourceType = frontmatter.source_type ?? "";
  const sourcePath = frontmatter.source_path ?? "";
  const concepts = extractWikiLinks(section(body, "Mind Map Links"));
  const scriptureReferences = extractListItems(section(body, "Detected Scripture References"));
  const ownVoiceSignals = extractListItems(section(body, "Own-Voice Signals"));
  const sourceOrientation = plainText(section(body, "Source Orientation"));
  const launchUse = plainText(section(body, "Launch Use"));

  return {
    title: sourceTitle,
    body,
    file,
    frontmatter,
    visibility,
    hemisphere,
    sourceCategory,
    sourceType,
    sourcePath,
    concepts,
    scriptureReferences,
    ownVoiceSignals,
    sourceOrientation,
    launchUse
  };
}

function decideSourceVisibility(note) {
  if (PRIVATE_VISIBILITIES.has(note.visibility)) {
    return { include: false, reason: `visibility:${note.visibility}` };
  }

  if (!STUDENT_VISIBLE_INPUT_VISIBILITIES.has(note.visibility)) {
    return { include: false, reason: note.visibility ? `visibility:${note.visibility}` : "missing_visibility" };
  }

  if (normalizeHemisphere(note.hemisphere) === "scholar") {
    return { include: false, reason: "scholar_sources_require_citation_review" };
  }

  const riskText = [
    note.title,
    note.sourceCategory,
    note.sourceType,
    note.sourcePath,
    note.sourceOrientation,
    note.launchUse,
    note.ownVoiceSignals.join(" ")
  ].join(" ");
  const risk = RISK_PATTERNS.find((pattern) => pattern.test(riskText));

  if (risk) {
    return { include: false, reason: `risk_filter:${risk.source}` };
  }

  if (!note.ownVoiceSignals.length && !note.sourceOrientation) {
    return { include: false, reason: "no_excerpt_safe_summary" };
  }

  return { include: true };
}

function toKnowledgeSource(note, vaultRoot) {
  const concepts = unique(note.concepts.map(toConceptSlug));
  const topicTags = unique([...concepts, ...tagsFromText(note.title), ...tagsFromText(note.sourceCategory)]).slice(0, 12);
  const title = limitText(note.title, MAX_TITLE_LENGTH);
  const body = chunkBodyFor(note);
  const studentSummary = limitText(note.sourceOrientation || body, MAX_SUMMARY_LENGTH);

  return {
    sourceKey: stableSourceKey(note),
    title,
    sourceKind: "own_voice",
    hemisphere: "own_voice",
    visibility: "student_visible",
    sourceUri: path.relative(vaultRoot, note.file.fullPath).replace(/\\/g, "/"),
    citation: "",
    summary: studentSummary,
    tags: topicTags,
    launchScore: scoreLaunchSource(note, concepts, topicTags),
    chunks: [
      {
        chunkIndex: 0,
        title,
        body,
        studentSummary,
        topicTags,
        concepts,
        scriptureReferences: note.scriptureReferences,
        visibility: "student_visible"
      }
    ]
  };
}

function scoreLaunchSource(note, concepts, topicTags) {
  const text = [note.title, note.sourceCategory, note.sourceType, note.sourceOrientation, note.launchUse, concepts.join(" "), topicTags.join(" ")].join(" ").toLowerCase();
  let score = 0;

  if (/\b(youth ministry|uploaded|platform|wider personal|sermon|lesson|leader handout)\b/.test(text)) score += 20;
  if (/\b(student|discipleship|scripture|question|small group|leader review|keep reading)\b/.test(text)) score += 18;
  if (/\b(contest|launch|platform|rag|metanarrative)\b/.test(text)) score += 12;
  if (/\b(genesis|exodus|romans|psalm|gospel|kingdom|covenant)\b/.test(text)) score += 8;
  if (/\bdraft\b/.test(text)) score -= 4;

  return score;
}

function chunkBodyFor(note) {
  const lines = [];
  if (note.sourceOrientation) lines.push(note.sourceOrientation);
  if (note.ownVoiceSignals.length) {
    lines.push(`Own-voice signals: ${note.ownVoiceSignals.slice(0, 4).join(" ")}`);
  }
  if (note.launchUse) lines.push(note.launchUse);
  if (note.scriptureReferences.length) lines.push(`Scripture references: ${note.scriptureReferences.join(", ")}`);
  return limitText(lines.join("\n\n").replace(/\s+/g, " ").trim(), MAX_BODY_LENGTH);
}

async function applyPlan(plan, { ministryId }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before applying.");
  }

  let insertedSources = 0;
  let updatedSources = 0;
  let insertedChunks = 0;

  for (const source of plan.sources) {
    const existing = await supabaseFetch(url, key, `/rest/v1/knowledge_sources?ministry_id=eq.${ministryId}&source_uri=eq.${encodeURIComponent(source.sourceUri)}&select=id`);
    let sourceId = existing[0]?.id;

    const sourceRow = {
      ministry_id: ministryId,
      title: source.title,
      source_kind: source.sourceKind,
      hemisphere: source.hemisphere,
      visibility: source.visibility,
      source_uri: source.sourceUri,
      citation: source.citation,
      summary: source.summary,
      tags: source.tags
    };

    if (sourceId) {
      await supabaseFetch(url, key, `/rest/v1/knowledge_sources?id=eq.${sourceId}`, {
        method: "PATCH",
        body: JSON.stringify(sourceRow),
        headers: { Prefer: "return=minimal" }
      });
      await supabaseFetch(url, key, `/rest/v1/knowledge_chunks?source_id=eq.${sourceId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      updatedSources += 1;
    } else {
      const inserted = await supabaseFetch(url, key, "/rest/v1/knowledge_sources", {
        method: "POST",
        body: JSON.stringify(sourceRow),
        headers: { Prefer: "return=representation" }
      });
      sourceId = inserted[0]?.id;
      insertedSources += 1;
    }

    if (!sourceId) throw new Error(`Supabase did not return a source id for ${source.title}.`);

    const chunkRows = source.chunks.map((chunk) => ({
      ministry_id: ministryId,
      source_id: sourceId,
      chunk_index: chunk.chunkIndex,
      title: chunk.title,
      body: chunk.body,
      student_summary: chunk.studentSummary,
      topic_tags: chunk.topicTags,
      concepts: chunk.concepts,
      scripture_references: chunk.scriptureReferences,
      visibility: chunk.visibility
    }));

    if (chunkRows.length) {
      await supabaseFetch(url, key, "/rest/v1/knowledge_chunks", {
        method: "POST",
        body: JSON.stringify(chunkRows),
        headers: { Prefer: "return=minimal" }
      });
      insertedChunks += chunkRows.length;
    }
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        insertedSources,
        updatedSources,
        insertedChunks
      },
      null,
      2
    )
  );
}

async function supabaseFetch(url, key, endpoint, init = {}) {
  const response = await fetch(`${url}${endpoint}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed ${response.status}: ${text}`);
  }

  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function listMarkdownFiles(dir, kind) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => ({ kind, fullPath: path.join(dir, entry.name) }));
}

function splitFrontmatter(raw) {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: {}, body: raw };

  const frontmatterText = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  return { frontmatter: parseSimpleYaml(frontmatterText), body };
}

function parseSimpleYaml(input) {
  const result = {};
  const lines = input.split(/\r?\n/);
  let currentKey = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const keyValue = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (keyValue) {
      currentKey = keyValue[1];
      const value = keyValue[2].trim();
      result[currentKey] = value ? unquote(value) : [];
      continue;
    }

    const listItem = /^\s*-\s*(.*)$/.exec(line);
    if (listItem && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(unquote(listItem[1].trim()));
    }
  }

  return result;
}

function section(body, heading) {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "im");
  const match = pattern.exec(body);
  if (!match) return "";

  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function extractWikiLinks(input) {
  return unique(Array.from(input.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1].trim()).filter(Boolean));
}

function extractListItems(input) {
  return input
    .split(/\r?\n/)
    .map((line) => /^-\s+(.*)$/.exec(line.trim())?.[1]?.trim() ?? "")
    .filter(Boolean);
}

function plainText(input) {
  return input.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function titleFromHeading(body) {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
}

function stableSourceKey(note) {
  return `${normalizeHemisphere(note.hemisphere)}:${note.title}:${note.sourcePath || note.file.fullPath}`.toLowerCase();
}

function canonicalTitleKey(title) {
  return title
    .toLowerCase()
    .replace(/\b(final|expanded|scripture|study|bible|lesson|draft|v\d+)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagsFromText(input) {
  return unique(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 3 && !["source", "files", "study", "notes", "voice"].includes(token))
  ).slice(0, 6);
}

function toConceptSlug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHemisphere(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes("scholar")) return "scholar";
  if (normalized.includes("own")) return "own_voice";
  return "platform";
}

function normalizeVisibility(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function limitText(value, maxLength) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function writePreview(outputPath, plan) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

function printSummary(plan, outputPath) {
  console.log(
    JSON.stringify(
      {
        mode: plan.mode,
        vaultRoot: plan.vaultRoot,
        outputPath,
        counts: plan.counts,
        firstSources: plan.sources.slice(0, 8).map((source) => ({
          title: source.title,
          sourceUri: source.sourceUri,
        chunks: source.chunks.length,
        launchScore: source.launchScore,
        tags: source.tags.slice(0, 5)
      })),
        skippedReasons: summarizeSkipped(plan.skipped)
      },
      null,
      2
    )
  );
}

function summarizeSkipped(skipped) {
  const counts = new Map();
  for (const item of skipped) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  return Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]));
}

function parseArgs(argv) {
  const parsed = {
    apply: false,
    confirmProductionWrite: false,
    dryRun: true,
    help: false,
    maxSources: DEFAULT_MAX_SOURCES,
    ministryId: undefined,
    out: undefined,
    vault: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      parsed.apply = true;
      parsed.dryRun = false;
    } else if (arg === "--confirm-production-write") {
      parsed.confirmProductionWrite = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
      parsed.apply = false;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--ministry-id") {
      parsed.ministryId = argv[++index];
    } else if (arg === "--max-sources") {
      const value = argv[++index];
      parsed.maxSources = value === "all" ? "all" : Number.parseInt(value, 10);
      if (parsed.maxSources !== "all" && (!Number.isFinite(parsed.maxSources) || parsed.maxSources < 1)) {
        throw new Error("--max-sources must be a positive number or all.");
      }
    } else if (arg === "--out") {
      parsed.out = argv[++index];
    } else if (arg === "--vault") {
      parsed.vault = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/obsidian-rag-import.mjs [options]

Options:
  --vault <path>                  Meridian Obsidian vault path. Defaults to the existing ~/Desktop/two-hemisphere brain folder.
  --out <path>                    Preview JSON output path. Defaults to tmp/obsidian-rag-launch-pack-preview.json.
  --dry-run                       Build preview only. Default.
  --max-sources <number|all>      Limit launch pack size. Defaults to ${DEFAULT_MAX_SOURCES}.
  --apply                         Write eligible sources/chunks to Supabase.
  --confirm-production-write      Required with --apply.
  --ministry-id <uuid>            Ministry id for Supabase rows. Or set SUPABASE_MINISTRY_ID.
  --help                          Show this help.

Apply also requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
`);
}
