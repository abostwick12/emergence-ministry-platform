import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_ARCHIVE = path.join(os.homedir(), "Desktop", "Apple notes Two_Hemisphere_Brain_Extraction.zip");
const DEFAULT_VAULT = path.join(os.homedir(), "Desktop", "two-hemisphere brain");
const DEFAULT_OUT = path.join(process.cwd(), "tmp", "apple-notes-brain-compiler-preview.json");
const DEFAULT_REVIEW_OVERRIDES = path.join(process.cwd(), "tmp", "apple-notes-review-overrides.json");
const DEFAULT_PREVIEW_LIMIT = 80;

const BIBLE_BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "Samuel",
  "Kings",
  "Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalm",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Songs",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "Thessalonians",
  "Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "Peter",
  "Jude",
  "Revelation"
];

const TOPIC_RULES = [
  { topic: "Biblical Theology", tags: ["biblical-theology"], pattern: /\b(biblical theology|metanarrative|covenant|kingdom|temple|eden|garden|creation|new creation|image of god)\b/i },
  { topic: "Old Testament", tags: ["old-testament"], pattern: /\b(genesis|exodus|leviticus|numbers|deuteronomy|torah|abraham|moses|israel|psalm|proverbs|isaiah|jonah|daniel)\b/i },
  { topic: "New Testament", tags: ["new-testament"], pattern: /\b(matthew|mark|luke|john|acts|romans|paul|jesus|gospel|church|revelation)\b/i },
  { topic: "Leadership", tags: ["leadership"], pattern: /\b(leader|leadership|decision|organization|team|intercession|vision|strategy)\b/i },
  { topic: "Youth Ministry", tags: ["youth-ministry"], pattern: /\b(youth ministry|student ministry|students|small group|camp|lesson|leader guide|discipleship)\b/i },
  { topic: "Sermons", tags: ["sermon"], pattern: /\b(sermon|teaching outline|message|devotion|devo|lesson plan|leader handout)\b/i },
  { topic: "Research", tags: ["research"], pattern: /\b(research|citation|bibliography|turabian|paper|essay|seminary|scholar|commentary)\b/i },
  { topic: "Projects", tags: ["project"], pattern: /\b(project|proposal|platform|workflow|automation|plan|roadmap)\b/i },
  { topic: "Personal", tags: ["personal"], pattern: /\b(personal|journal|dream|family|son|daughter|wife|friend|health|appointment)\b/i }
];

const THEME_RULES = [
  { slug: "kingdom", label: "Kingdom", pattern: /\bkingdom\b/i },
  { slug: "eden", label: "Eden", pattern: /\beden|garden\b/i },
  { slug: "temple", label: "Temple", pattern: /\btemple|tabernacle|sacred space\b/i },
  { slug: "image-of-god", label: "Image of God", pattern: /\bimage of god|imago dei\b/i },
  { slug: "rest", label: "Rest", pattern: /\brest|sabbath\b/i },
  { slug: "wisdom", label: "Wisdom", pattern: /\bwisdom|proverbs\b/i },
  { slug: "mission", label: "Mission", pattern: /\bmission|sent|nations\b/i },
  { slug: "leadership", label: "Leadership", pattern: /\bleader|leadership\b/i },
  { slug: "formation", label: "Formation", pattern: /\bformation|discipleship|formed\b/i },
  { slug: "covenant", label: "Covenant", pattern: /\bcovenant\b/i },
  { slug: "exodus", label: "Exodus", pattern: /\bexodus|deliverance|wilderness\b/i },
  { slug: "suffering", label: "Suffering", pattern: /\bsuffer|suffering|grief|lament|pain\b/i }
];

const RISK_RULES = [
  { category: "secrets", severity: "high", pattern: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|api[_ -]?key|secret|token|password|passcode|login|credential)\b/i },
  { category: "emails", severity: "high", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { category: "phone_numbers", severity: "high", pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/ },
  { category: "addresses", severity: "high", pattern: /\b\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way|circle|cir)\b/i },
  { category: "medical", severity: "high", pattern: /\b(medical|medication|medicine|doctor|oncology|urology|ct scan|gabapentin|oxy|lorazepam|pcos|malpractice|wound care|labs?|prosthetic|therapy|diagnos)\b/i },
  { category: "financial", severity: "high", pattern: /\b(tax|taxes|usaa|bank|credit|debit|mortgage|per diem|invoice|payment|order #|routing|account number|verizon pin|\$\s?\d)\b/i },
  { category: "military_va", severity: "high", pattern: /\b(cv-22|usaf|va\.gov|dav|les|military|aircraft|tail number|checkride|telework|deployment|brief|operating guidance)\b/i },
  { category: "student_or_family", severity: "medium", pattern: /\b(student|parent|guardian|kid|kids|son|daughter|family|pastoral care|counseling|abuse|trauma)\b/i },
  { category: "personal_names", severity: "medium", pattern: /\b(?:Pastor|Hey|Hi|Dear)\s+[A-Z][a-z]{2,}\b|\b(?:Gabriel|Jaci|Joel|Marty|Andrew)\b/ }
];

export async function compileAppleNotesBrain(input = {}) {
  const importDate = input.importDate ?? todayStamp();
  const previewLimit = input.previewLimit ?? DEFAULT_PREVIEW_LIMIT;
  const vaultRoot = path.resolve(input.vaultRoot ?? DEFAULT_VAULT);
  const reviewOverrides = input.reviewOverrides
    ? normalizeReviewOverrides(input.reviewOverrides)
    : await loadReviewOverrides(path.resolve(input.reviewOverridesPath ?? DEFAULT_REVIEW_OVERRIDES));
  const loaded = input.sourceDir
    ? await loadAppleNotesDirectory(path.resolve(input.sourceDir))
    : await loadAppleNotesArchive(path.resolve(input.archivePath ?? DEFAULT_ARCHIVE));

  const normalizedNotes = normalizeImportedNotes(loaded.notes);
  const duplicateHashes = findDuplicateHashes(normalizedNotes);
  const compiledNotes = normalizedNotes.map((note) => compileNote(note, { duplicateHashes, importDate, vaultRoot, reviewOverrides }));
  const inventory = buildInventory(compiledNotes, loaded);
  const reviewQueues = buildReviewQueues(compiledNotes, previewLimit);
  const generatedVault = buildVaultArtifacts(compiledNotes, { importDate, vaultRoot });
  const meridianGrounding = buildMeridianGroundingArtifacts(compiledNotes, { importDate, vaultRoot });

  return {
    generatedAt: new Date().toISOString(),
    mode: input.apply ? "apply" : "dry-run",
    archivePath: loaded.archivePath ?? null,
    sourceRoot: loaded.sourceRoot,
    vaultRoot,
    importDate,
    inventory,
    reviewQueues,
    generatedVaultPreview: generatedVault.artifacts.slice(0, previewLimit).map(toArtifactPreview),
    internalGroundingPreview: meridianGrounding.artifacts.slice(0, previewLimit).map(toArtifactPreview),
    manifests: {
      normalizedNotes: compiledNotes.map(toManifestRow),
      internalGroundingSources: meridianGrounding.manifest,
      reviewOverrides: Array.from(reviewOverrides.values())
    },
    writePlan: {
      vaultArtifacts: generatedVault.artifacts.length,
      meridianGroundingArtifacts: meridianGrounding.artifacts.length,
      reviewOverridesApplied: compiledNotes.filter((note) => note.reviewDecision).length,
      guardedApplyRequired: true,
      writesSupabase: false
    },
    artifacts: {
      vault: generatedVault.artifacts,
      meridianGrounding: meridianGrounding.artifacts
    }
  };
}

export async function loadAppleNotesArchive(archivePath) {
  const entries = await listArchiveEntries(archivePath);
  const rootPrefix = locateArchiveRoot(entries);
  const notesPrefix = rootPrefix ? `${rootPrefix}/raw/iCloud Notes/Notes/` : "raw/iCloud Notes/Notes/";
  const detailsEntry = rootPrefix ? `${rootPrefix}/raw/iCloud Notes/Notes Details.csv` : "raw/iCloud Notes/Notes Details.csv";
  const details = entries.includes(detailsEntry) ? parseCsv(await extractArchiveEntry(archivePath, detailsEntry)) : [];
  const metadataByTitle = groupMetadataByTitle(details);
  const files = entries.filter((entry) => entry.startsWith(notesPrefix) && !entry.endsWith("/"));
  const textEntries = files.filter((entry) => entry.toLowerCase().endsWith(".txt"));
  const attachmentEntries = files.filter((entry) => !entry.toLowerCase().endsWith(".txt"));
  const attachmentsByDir = groupArchiveAttachmentsByNoteDir(attachmentEntries);
  const notes = [];
  const unreadableEntries = [];

  for (const entry of textEntries) {
    let body = "";
    try {
      body = await extractArchiveEntry(archivePath, entry);
    } catch (error) {
      unreadableEntries.push({
        sourcePath: archiveRelativePath(entry, rootPrefix),
        reason: error instanceof Error ? error.message : "unknown"
      });
      continue;
    }

    const relativeToNotes = entry.slice(notesPrefix.length);
    const noteRelativeDir = posixDirname(relativeToNotes);
    const title = posixBasename(entry, ".txt").trim() || posixBasename(noteRelativeDir);
    const metadata = nextMetadataForTitle(metadataByTitle, title);
    notes.push({
      title,
      body,
      created: metadata?.["Created On"] ?? "",
      modified: metadata?.["Modified On"] ?? "",
      pinned: metadata?.Pinned ?? "",
      deleted: metadata?.Deleted ?? "",
      drawing: metadata?.["Drawing/Handwriting"] ?? "",
      sourcePath: archiveRelativePath(entry, rootPrefix),
      folder: folderFromNoteRelativeDir(noteRelativeDir),
      attachments: (attachmentsByDir.get(trimTrailingSlash(posixDirname(entry))) ?? []).map((attachment) => archiveRelativePath(attachment, rootPrefix)),
      sourceMetadata: metadata ?? {}
    });
  }

  notes.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return {
    sourceRoot: rootPrefix || ".",
    archivePath,
    notes,
    metadataRows: details.length,
    attachmentCount: attachmentEntries.length,
    unreadableEntries
  };
}

export async function loadAppleNotesDirectory(sourceRoot) {
  const appleRoot = await locateAppleNotesRoot(sourceRoot);
  const notesDir = path.join(appleRoot, "raw", "iCloud Notes", "Notes");
  const detailsPath = path.join(appleRoot, "raw", "iCloud Notes", "Notes Details.csv");
  const details = await readCsvIfPresent(detailsPath);
  const files = await walkFiles(notesDir);
  const textFiles = files.filter((file) => file.toLowerCase().endsWith(".txt"));
  const attachmentFiles = files.filter((file) => !file.toLowerCase().endsWith(".txt"));
  const attachmentsByDir = groupAttachmentsByNoteDir(attachmentFiles);
  const metadataByTitle = groupMetadataByTitle(details);

  const notes = [];
  for (const fullPath of textFiles) {
    const body = await readFile(fullPath, "utf8");
    const relativePath = slash(path.relative(appleRoot, fullPath));
    const title = path.basename(fullPath, ".txt").trim() || path.basename(path.dirname(fullPath));
    const noteDir = path.dirname(fullPath);
    const noteRelativeDir = slash(path.relative(notesDir, noteDir));
    const folder = folderFromNoteRelativeDir(noteRelativeDir);
    const metadata = nextMetadataForTitle(metadataByTitle, title);
    notes.push({
      title,
      body,
      created: metadata?.["Created On"] ?? "",
      modified: metadata?.["Modified On"] ?? "",
      pinned: metadata?.Pinned ?? "",
      deleted: metadata?.Deleted ?? "",
      drawing: metadata?.["Drawing/Handwriting"] ?? "",
      sourcePath: relativePath,
      folder,
      attachments: (attachmentsByDir.get(noteDir) ?? []).map((attachment) => slash(path.relative(appleRoot, attachment))),
      sourceMetadata: metadata ?? {}
    });
  }

  notes.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return {
    sourceRoot: appleRoot,
    notes,
    metadataRows: details.length,
    attachmentCount: attachmentFiles.length
  };
}

async function listArchiveEntries(archivePath) {
  const { stdout } = await execFileAsync("tar", ["-tf", archivePath], { maxBuffer: 1024 * 1024 * 40 });
  return stdout
    .split(/\r?\n/)
    .map((entry) => entry.trimEnd())
    .filter(Boolean);
}

async function extractArchiveEntry(archivePath, entry) {
  const { stdout } = await execFileAsync("tar", ["-xOf", archivePath, entry], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 20
  });
  return Buffer.from(stdout).toString("utf8");
}

function locateArchiveRoot(entries) {
  const marker = "/raw/iCloud Notes/Notes/";
  const match = entries.find((entry) => entry.includes(marker));
  if (!match) throw new Error("Could not locate Apple Notes export in archive. Expected raw/iCloud Notes/Notes.");
  return match.slice(0, match.indexOf(marker));
}

function groupArchiveAttachmentsByNoteDir(entries) {
  const byDir = new Map();
  for (const entry of entries) {
    const noteDir = archiveNoteDirForAttachment(entry);
    const list = byDir.get(noteDir) ?? [];
    list.push(entry);
    byDir.set(noteDir, list);
  }
  return byDir;
}

function archiveNoteDirForAttachment(entry) {
  const sketchesIndex = entry.indexOf("/sketches/");
  if (sketchesIndex > 0) return trimTrailingSlash(entry.slice(0, sketchesIndex));
  return trimTrailingSlash(posixDirname(entry));
}

function archiveRelativePath(entry, rootPrefix) {
  return rootPrefix && entry.startsWith(`${rootPrefix}/`) ? entry.slice(rootPrefix.length + 1) : entry;
}

function posixDirname(value) {
  const trimmed = trimTrailingSlash(value);
  const index = trimmed.lastIndexOf("/");
  return index >= 0 ? trimmed.slice(0, index) : "";
}

function posixBasename(value, ext = "") {
  const base = trimTrailingSlash(value).split("/").pop() ?? "";
  return ext && base.toLowerCase().endsWith(ext.toLowerCase()) ? base.slice(0, -ext.length) : base;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/g, "");
}

export function normalizeImportedNotes(notes) {
  return notes.map((note) => {
    const body = normalizeBody(note.body);
    const bodyHash = sha256(body);
    const contentHash = sha256(`${note.title}\n${body}`);
    const id = `apple-notes-${sha256(note.sourcePath || `${note.title}:${contentHash}`).slice(0, 12)}`;
    return {
      id,
      title: normalizeTitle(note.title),
      body,
      created: note.created ?? "",
      modified: note.modified ?? "",
      sourcePath: slash(note.sourcePath ?? ""),
      contentHash,
      bodyHash,
      attachments: note.attachments ?? [],
      folder: note.folder ?? "",
      sourceMetadata: note.sourceMetadata ?? {}
    };
  });
}

export function detectRisks(note) {
  const text = `${note.title}\n${note.body}\n${note.sourcePath}`;
  return RISK_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => ({
    category: rule.category,
    severity: rule.severity
  }));
}

export function extractScriptureReferences(value) {
  const references = new Set();
  const bookPattern = BIBLE_BOOKS.map(escapeRegExp).join("|");
  const explicit = new RegExp(`\\b(?:[1-3]\\s*)?(?:${bookPattern})\\.?\\s+\\d{1,3}(?::\\d{1,3}(?:-\\d{1,3})?)?\\b`, "gi");
  for (const match of value.matchAll(explicit)) references.add(normalizeReference(match[0]));

  const abbreviation = /\b(?:Gen|Exo|Ex|Lev|Num|Deut|Josh|Judg|Ps|Psa|Pro|Prov|Isa|Jer|Ezk|Ezek|Dan|Mat|Matt|Mar|Mrk|Luk|Jhn|Rom|Rev)\.?\s+\d{1,3}(?::\d{1,3}(?:-\d{1,3})?)?\b/gi;
  for (const match of value.matchAll(abbreviation)) references.add(expandReferenceAbbreviation(match[0]));
  return Array.from(references).slice(0, 20);
}

export function classifyNote(note) {
  const text = `${note.title}\n${note.body}`;
  const matched = TOPIC_RULES.filter((rule) => rule.pattern.test(text));
  const topics = matched.length ? matched.map((rule) => rule.topic) : ["Archive"];
  const tags = unique(matched.flatMap((rule) => rule.tags));
  const themes = THEME_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => ({
    slug: rule.slug,
    label: rule.label
  }));
  const questions = extractQuestions(text);
  const frameworks = extractFrameworkSignals(text, themes);
  return { topics: unique(topics), tags, themes: uniqueBy(themes, "slug"), questions, frameworks };
}

export function scrubPii(value) {
  return value
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, "[SECRET]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way|circle|cir)\b/gi, "[ADDRESS]");
}

export function buildSourceNoteMarkdown(note) {
  const related = note.classification.themes.map((theme) => `[[${theme.label}]]`);
  return [
    "---",
    yamlLine("source_title", note.title),
    yamlLine("hemisphere", "Own Voice"),
    yamlLine("source_category", note.classification.topics[0] ?? "Archive"),
    yamlLine("source_type", "apple_note"),
    yamlLine("visibility", "private_review"),
    yamlLine("audience", "internal_theology_grounding"),
    yamlLine("student_exposure", "prohibited"),
    yamlLine("review_status", note.reviewStatus),
    yamlLine("automatic_review_status", note.automaticReviewStatus),
    yamlLine("risk_level", note.riskLevel),
    yamlLine("import_id", note.importDate),
    yamlLine("source_path", note.sourcePath),
    yamlLine("content_hash", note.contentHash),
    note.reviewDecision ? yamlLine("review_decision", note.reviewDecision.decision) : yamlLine("review_decision", ""),
    note.reviewDecision ? yamlLine("reviewed_at", note.reviewDecision.reviewedAt) : yamlLine("reviewed_at", ""),
    yamlList("tags", unique(["source-note", "own-voice", "apple-notes", ...note.classification.tags])),
    yamlList("scripture_references", note.scriptureReferences),
    yamlList("risk_categories", note.detectedRisks.map((risk) => risk.category)),
    "---",
    "",
    `# ${note.title}`,
    "",
    "## Source Orientation",
    "",
    sourceOrientation(note),
    "",
    "## Review Status",
    "",
    `- Status: ${note.reviewStatus}`,
    `- Automatic status: ${note.automaticReviewStatus}`,
    note.reviewDecision ? `- Human review decision: ${note.reviewDecision.decision}` : "- Human review decision: none",
    note.reviewDecision?.reason ? `- Review reason: ${note.reviewDecision.reason}` : "- Review reason: none",
    `- Risk level: ${note.riskLevel}`,
    `- Visibility: private_review`,
    "- Student exposure: prohibited",
    "- Use: internal theological grounding, question formation, resource guidance, and leader synthesis only",
    note.detectedRisks.length ? `- Risk categories: ${note.detectedRisks.map((risk) => risk.category).join(", ")}` : "- Risk categories: none detected",
    "",
    "## Detected Scripture References",
    "",
    markdownList(note.scriptureReferences),
    "",
    "## Mind Map Links",
    "",
    markdownList(related),
    "",
    "## Extracted Questions",
    "",
    markdownList(note.classification.questions),
    "",
    "## Framework Signals",
    "",
    markdownList(note.classification.frameworks),
    "",
    "## Original Apple Note (Preserved)",
    "",
    quoteMarkdown(note.body || "_Empty note body._"),
    ""
  ].join("\n");
}

export function buildInternalGroundingMarkdown(note) {
  const grounding = buildInternalGroundingSignals(note);
  return [
    "---",
    yamlLine("source_title", note.title),
    yamlLine("hemisphere", "Own Voice"),
    yamlLine("source_type", "apple_note_internal_grounding_candidate"),
    yamlLine("visibility", "internal_grounding"),
    yamlLine("audience", "admin_internal_grounding"),
    yamlLine("student_exposure", "prohibited"),
    yamlLine("review_status", "grounding_candidate_requires_review"),
    yamlLine("source_note_id", note.id),
    yamlLine("content_hash", sha256(JSON.stringify(grounding))),
    yamlList("tags", unique(["meridian-grounding", "internal-grounding", "not-student-facing", ...note.classification.tags])),
    yamlList("scripture_references", note.scriptureReferences),
    "---",
    "",
    `# Internal Grounding: ${note.title}`,
    "",
    "## Internal Grounding Candidate",
    "",
    "This file contains synthesis signals only. It intentionally does not include the original Apple Note body or extracted quotations.",
    "It may ground theological posture, ministry voice, question generation, journal journeys, and resource direction.",
    "",
    "## Source Map",
    "",
    `- Source note ID: ${note.id}`,
    `- Original source path: ${note.sourcePath}`,
    "",
    "## Grounding Signals",
    "",
    markdownList(grounding.signals),
    "",
    "## Rabbinic Question Shape",
    "",
    markdownList(grounding.questionShape),
    "",
    "## Voice And Culture",
    "",
    markdownList(grounding.voiceAndCulture),
    "",
    "## Artistic Texture",
    "",
    markdownList(grounding.artisticTexture),
    "",
    "## Output Boundary",
    "",
    "- Do not quote or summarize this note directly to students.",
    "- Do not assign this note as student reading.",
    "- Use it only to shape age-appropriate questions, pastoral tone, theological guardrails, and resource recommendations.",
    ""
  ].join("\n");
}

function buildInternalGroundingSignals(note) {
  const themes = note.classification.themes.map((theme) => theme.label);
  const topics = note.classification.topics.filter((topic) => topic !== "Archive");
  const references = note.scriptureReferences;
  const frameworks = note.classification.frameworks;
  const signals = unique([
    topics.length ? `Frame this as ${topics.slice(0, 3).join(", ").toLowerCase()} rather than generic devotional content.` : "",
    themes.length ? `Let ${themes.slice(0, 4).join(", ")} shape the theological posture.` : "",
    references.length ? `Attend to the biblical neighborhood around ${references.slice(0, 4).join(", ")} without turning it into trivia.` : "",
    frameworks.length ? `Use framework movement such as ${frameworks.slice(0, 2).join("; ")} as background logic, not as a student-facing formula.` : "",
    "Prefer engagement, wrestling, humility, and formation over quick certainty."
  ]);
  const questionShape = unique([
    "Ask questions that pull students back into the text before asking for application.",
    "Move from observation to deeper attention, then toward relationship with Jesus and community response.",
    themes.includes("Kingdom") ? "Invite students to notice kingdom allegiance and desire without reducing the passage to behavior management." : "",
    themes.includes("Image of God") ? "Invite students to consider identity, vocation, and dignity before performance." : "",
    themes.includes("Suffering") ? "Make room for lament and honest pain without forcing a clean answer." : "",
    "Favor open-ended prompts that continue conversation between student, God, and community."
  ]);
  const voiceAndCulture = unique([
    "Use ministry-local language: pastoral, curious, text-rooted, artistically alive, and relational.",
    "Avoid content-farm certainty, flattening, generic moralism, and academic-paper tone.",
    "Sound like a trusted leader setting a table for conversation, not a quiz engine handing out conclusions.",
    topics.includes("Youth Ministry") ? "Assume students can wrestle with serious theology when the path is concrete and relational." : "",
    topics.includes("Leadership") ? "Let leader-facing outputs clarify posture and guardrails before anything reaches students." : ""
  ]);
  const artisticTexture = unique([
    themes.includes("Eden") || themes.includes("Temple") ? "Use garden, temple, presence, and homecoming imagery when it helps students notice the story." : "",
    themes.includes("Exodus") ? "Use rescue, wilderness, formation, and worship imagery as connective tissue." : "",
    themes.includes("Wisdom") ? "Let wisdom language shape the pace: attention, discernment, patience, and practiced faithfulness." : "",
    "Use vivid but restrained language that deepens attention rather than decorating the answer."
  ]);

  return { signals, questionShape, voiceAndCulture, artisticTexture };
}

export async function writeCompiledVault(plan) {
  for (const artifact of [...plan.artifacts.vault, ...plan.artifacts.meridianGrounding]) {
    const fullPath = path.join(plan.vaultRoot, artifact.relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, artifact.content, "utf8");
  }

  const manifestPath = path.join(plan.vaultRoot, "99 System", "import-manifests", `apple-notes-${plan.importDate}.json`);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...plan, artifacts: undefined }, null, 2)}\n`,
    "utf8"
  );
}

export async function loadReviewOverrides(filePath = DEFAULT_REVIEW_OVERRIDES) {
  try {
    return normalizeReviewOverrides(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

function normalizeReviewOverrides(overrides) {
  const decisions = Array.isArray(overrides)
    ? overrides
    : Array.isArray(overrides?.decisions)
      ? overrides.decisions
      : [];
  const byId = new Map();
  for (const decision of decisions) {
    if (!decision?.id) continue;
    byId.set(decision.id, {
      id: decision.id,
      decision: decision.decision ?? "source_note_approved",
      reason: decision.reason ?? "",
      reviewedAt: decision.reviewedAt ?? overrides?.reviewedAt ?? "",
      reviewedBy: decision.reviewedBy ?? overrides?.reviewedBy ?? ""
    });
  }
  return byId;
}

function compileNote(note, { duplicateHashes, importDate, vaultRoot, reviewOverrides }) {
  const detectedRisks = detectRisks(note);
  const riskLevel = detectedRisks.some((risk) => risk.severity === "high")
    ? "high"
    : detectedRisks.some((risk) => risk.severity === "medium")
      ? "medium"
      : "low";
  const duplicate = duplicateHashes.has(note.bodyHash);
  const classification = classifyNote(note);
  const scriptureReferences = extractScriptureReferences(`${note.title}\n${note.body}`);
  const automaticReviewStatus = reviewStatusFor({ riskLevel, duplicate, note, classification });
  const reviewDecision = reviewOverrides.get(note.id);
  const reviewStatus = applyReviewDecision(automaticReviewStatus, reviewDecision);
  const fileSlug = `${slugify(note.title) || "untitled"}-${note.id.replace("apple-notes-", "")}`;

  return {
    ...note,
    importDate,
    vaultRoot,
    detectedRisks,
    riskLevel,
    duplicate,
    classification,
    scriptureReferences,
    automaticReviewStatus,
    reviewDecision,
    reviewStatus,
    generatedPath: slash(path.join("01 Source Notes", "01 Own Voice", "Generated", "Apple Notes", `${fileSlug}.md`)),
    internalGroundingPath: slash(path.join("05 Meridian Grounding", "PII-Free", "Apple Notes", `${fileSlug}.md`))
  };
}

function applyReviewDecision(reviewStatus, decision) {
  if (!decision) return reviewStatus;
  if (decision.decision === "source_note_approved" || decision.decision === "unquarantine") {
    return "source_note_approved";
  }
  if (decision.decision === "quarantine") return "quarantined";
  return reviewStatus;
}

function buildInventory(notes, loaded) {
  const byRiskCategory = {};
  const byTopic = {};
  const byReviewStatus = {};
  for (const note of notes) {
    for (const risk of note.detectedRisks) byRiskCategory[risk.category] = (byRiskCategory[risk.category] ?? 0) + 1;
    for (const topic of note.classification.topics) byTopic[topic] = (byTopic[topic] ?? 0) + 1;
    byReviewStatus[note.reviewStatus] = (byReviewStatus[note.reviewStatus] ?? 0) + 1;
  }

  return {
    notesScanned: notes.length,
    metadataRows: loaded.metadataRows,
    attachments: loaded.attachmentCount,
    unreadableEntries: loaded.unreadableEntries?.length ?? 0,
    emptyNotes: notes.filter((note) => !note.body.trim()).length,
    duplicateNotes: notes.filter((note) => note.duplicate).length,
    highRiskNotes: notes.filter((note) => note.riskLevel === "high").length,
    mediumRiskNotes: notes.filter((note) => note.riskLevel === "medium").length,
    lowRiskNotes: notes.filter((note) => note.riskLevel === "low").length,
    generatedSourceNoteCandidates: notes.filter((note) => canGenerateSourceNote(note)).length,
    internalGroundingCandidates: notes.filter((note) => canGenerateInternalGroundingNote(note)).length,
    byRiskCategory,
    byTopic,
    byReviewStatus
  };
}

function buildReviewQueues(notes, previewLimit) {
  return {
    quarantined: notes
      .filter((note) => note.reviewStatus === "quarantined")
      .slice(0, previewLimit)
      .map(toReviewQueueItem),
    needsReview: notes
      .filter((note) => note.reviewStatus === "needs_review")
      .slice(0, previewLimit)
      .map(toReviewQueueItem),
    duplicates: notes
      .filter((note) => note.duplicate)
      .slice(0, previewLimit)
      .map(toReviewQueueItem),
    empty: notes
      .filter((note) => !note.body.trim())
      .slice(0, previewLimit)
      .map(toReviewQueueItem)
  };
}

function buildVaultArtifacts(notes, { importDate }) {
  const artifacts = [];
  artifacts.push({
    kind: "raw-manifest",
    relativePath: slash(path.join("00 Raw Sources", "01 Own Voice", "Apple Notes", importDate, "README.md")),
    title: "Apple Notes Raw Source Pointer",
    content: buildRawPointerMarkdown(notes, importDate)
  });

  for (const note of notes.filter(canGenerateSourceNote)) {
    artifacts.push({
      kind: "source-note",
      relativePath: note.generatedPath,
      title: note.title,
      content: buildSourceNoteMarkdown(note)
    });
  }

  artifacts.push(...buildConceptArtifacts(notes));
  artifacts.push(...buildMocArtifacts(notes));
  artifacts.push({
    kind: "launch-synthesis",
    relativePath: slash(path.join("04 Launch Synthesis", `Apple Notes Import - ${importDate}.md`)),
    title: `Apple Notes Import - ${importDate}`,
    content: buildLaunchSynthesis(notes, importDate)
  });

  return { artifacts };
}

function buildMeridianGroundingArtifacts(notes, { importDate }) {
  const groundingNotes = notes.filter(canGenerateInternalGroundingNote);
  const artifacts = groundingNotes.map((note) => ({
    kind: "internal-grounding-candidate",
    relativePath: note.internalGroundingPath,
    title: note.title,
    content: buildInternalGroundingMarkdown(note)
  }));

  artifacts.unshift({
    kind: "internal-grounding-manifest",
    relativePath: slash(path.join("05 Meridian Grounding", "PII-Free", `Apple Notes Meridian Grounding Manifest - ${importDate}.md`)),
    title: `Apple Notes Meridian Grounding Manifest - ${importDate}`,
    content: buildInternalGroundingManifest(groundingNotes, importDate)
  });

  artifacts.unshift({
    kind: "theology-grounding-policy",
    relativePath: slash(path.join("05 Meridian Grounding", "PII-Free", `Apple Notes Meridian Grounding Policy - ${importDate}.md`)),
    title: `Apple Notes Meridian Grounding Policy - ${importDate}`,
    content: buildTheologyGroundingPolicy(importDate)
  });

  return {
    artifacts,
    manifest: groundingNotes.map((note) => ({
      sourceNoteId: note.id,
      sourcePath: note.sourcePath,
      internalGroundingPath: note.internalGroundingPath,
      contentHash: sha256(scrubPii(note.body)),
    approvalRequired: true,
    studentExposure: "prohibited",
    retrievalUse: "internal_grounding"
  }))
  };
}

function buildConceptArtifacts(notes) {
  const themeCounts = new Map();
  for (const note of notes.filter(canGenerateSourceNote)) {
    for (const theme of note.classification.themes) {
      const current = themeCounts.get(theme.slug) ?? { ...theme, notes: [] };
      current.notes.push(note);
      themeCounts.set(theme.slug, current);
    }
  }

  return Array.from(themeCounts.values())
    .filter((theme) => theme.notes.length >= 2)
    .sort((a, b) => b.notes.length - a.notes.length || a.label.localeCompare(b.label))
    .slice(0, 24)
    .map((theme) => ({
      kind: "concept-note",
      relativePath: slash(path.join("02 Concept Notes", "Generated", `${safeFilename(theme.label)}.md`)),
      title: theme.label,
      content: [
        "---",
        yamlLine("source_type", "generated_concept"),
        yamlLine("visibility", "private_review"),
        yamlLine("review_status", "generated_requires_review"),
        yamlLine("theme_slug", theme.slug),
        "---",
        "",
        `# ${theme.label}`,
        "",
        "## Appears In",
        "",
        markdownList(theme.notes.slice(0, 40).map((note) => `[[${path.basename(note.generatedPath, ".md")}]]`)),
        ""
      ].join("\n")
    }));
}

function buildMocArtifacts(notes) {
  const topics = new Map();
  for (const note of notes.filter(canGenerateSourceNote)) {
    for (const topic of note.classification.topics) {
      const current = topics.get(topic) ?? [];
      current.push(note);
      topics.set(topic, current);
    }
  }

  return Array.from(topics.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([topic, topicNotes]) => ({
      kind: "map-of-content",
      relativePath: slash(path.join("03 Maps of Content", `${safeFilename(topic)}.md`)),
      title: topic,
      content: [
        "---",
        yamlLine("source_type", "generated_moc"),
        yamlLine("visibility", "private_review"),
        yamlLine("review_status", "generated_requires_review"),
        yamlLine("topic", topic),
        "---",
        "",
        `# ${topic}`,
        "",
        "## Overview",
        "",
        `Generated from ${topicNotes.length} Apple Notes source-note candidates. Review links before promoting.`,
        "",
        "## Major Notes",
        "",
        markdownList(topicNotes.slice(0, 60).map((note) => `[[${path.basename(note.generatedPath, ".md")}]]`)),
        "",
        "## Related Questions",
        "",
        markdownList(unique(topicNotes.flatMap((note) => note.classification.questions)).slice(0, 20)),
        ""
      ].join("\n")
    }));
}

function buildRawPointerMarkdown(notes, importDate) {
  return [
    "# Apple Notes Raw Source Pointer",
    "",
    `Import date: ${importDate}`,
    "",
    "The original Apple Notes export remains outside the vault source-note pipeline until review.",
    "Generated source notes live under `01 Source Notes/01 Own Voice/Generated/Apple Notes/`.",
    "",
    "## Inventory",
    "",
    `- Notes scanned: ${notes.length}`,
    `- High-risk quarantined notes: ${notes.filter((note) => note.riskLevel === "high").length}`,
    `- Medium-risk review notes: ${notes.filter((note) => note.riskLevel === "medium").length}`,
    `- Low-risk notes: ${notes.filter((note) => note.riskLevel === "low").length}`,
    ""
  ].join("\n");
}

function buildLaunchSynthesis(notes, importDate) {
  const sourceCandidates = notes.filter(canGenerateSourceNote);
  return [
    `# Apple Notes Import - ${importDate}`,
    "",
    "## Summary",
    "",
    `Generated ${sourceCandidates.length} private-review source-note candidates from Apple Notes.`,
    "No raw note was promoted to Supabase or student-visible RAG.",
    "",
    "## Review Priorities",
    "",
    markdownList([
      "Review high-risk quarantine before moving anything into permanent knowledge.",
      "Promote source notes manually from private_review only after confirming PII boundaries.",
      "Use the existing Obsidian RAG importer only after source notes are reviewed."
    ]),
    "",
    "## Largest Topics",
    "",
    markdownList(topCounts(sourceCandidates.flatMap((note) => note.classification.topics), 12).map(([topic, count]) => `${topic}: ${count}`)),
    ""
  ].join("\n");
}

function buildInternalGroundingManifest(notes, importDate) {
  return [
    `# Apple Notes Meridian Grounding Manifest - ${importDate}`,
    "",
    "These are synthesis-only internal grounding candidates.",
    "Human review is still required before retrieval use.",
    "They are not student-facing content and must not be assigned or shown directly to students.",
    "",
    "## Candidate Notes",
    "",
    markdownList(notes.slice(0, 200).map((note) => `[[${path.basename(note.internalGroundingPath, ".md")}]] - source ${note.id}`)),
    ""
  ].join("\n");
}

function buildTheologyGroundingPolicy(importDate) {
  return [
    `# Apple Notes Meridian Grounding Policy - ${importDate}`,
    "",
    "## Boundary",
    "",
    "Meridian Left Hemisphere Apple Notes material is internal theological grounding only.",
    "It must not be exposed directly to students as source text, citations, academic papers, or assigned reading.",
    "",
    "## Allowed Uses",
    "",
    markdownList([
      "Ground the platform's theological posture, style, voice, culture, and artistic texture in local context.",
      "Help formulate age-appropriate abstract questions that draw students deeper into Scripture, Jesus, and community.",
      "Guide journal journeys, reading plan structure, resource selection, and leader-facing synthesis.",
      "Provide guardrails so AI output does not drift into generic theology, content-farm certainty, or answer-first devotionals."
    ]),
    "",
    "## Disallowed Uses",
    "",
    markdownList([
      "Do not quote raw Meridian Left Hemisphere notes to students.",
      "Do not extract quote banks from Meridian Left Hemisphere notes.",
      "Do not summarize private notes as student-facing content.",
      "Do not generate academic-paper-style reading assignments from these notes.",
      "Do not expose note IDs, source paths, import manifests, or private theological drafts to students."
    ]),
    "",
    "## Student Output Shape",
    "",
    "Student-facing output should be brief, pastoral, developmentally appropriate, conversational, and question-forward.",
    "The goal is engagement rather than certainty: help students wrestle with Scripture, Jesus, and community instead of winning Bible trivia.",
    "The AI may use this grounding to ask better questions, shape journal journeys, or recommend resources, but the student should not see the underlying private note.",
    ""
  ].join("\n");
}

function reviewStatusFor({ riskLevel, duplicate, note, classification }) {
  if (!note.body.trim()) return "empty";
  if (duplicate) return "duplicate_review";
  if (riskLevel === "high") return "quarantined";
  if (riskLevel === "medium") return "needs_review";
  if (classification.topics.includes("Archive")) return "needs_review";
  return "private_review_candidate";
}

function canGenerateSourceNote(note) {
  return note.reviewStatus === "private_review_candidate" || note.reviewStatus === "needs_review" || note.reviewStatus === "source_note_approved";
}

function canGenerateInternalGroundingNote(note) {
  return note.reviewStatus === "private_review_candidate" && note.riskLevel === "low" && !note.duplicate && note.body.trim().length > 0;
}

async function locateAppleNotesRoot(root) {
  const rawAtRoot = path.join(root, "raw", "iCloud Notes", "Notes");
  if (await exists(rawAtRoot)) return root;

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    if (await exists(path.join(candidate, "raw", "iCloud Notes", "Notes"))) return candidate;
  }

  throw new Error(`Could not locate Apple Notes export under ${root}. Expected raw/iCloud Notes/Notes.`);
}

async function readCsvIfPresent(file) {
  if (!(await exists(file))) return [];
  return parseCsv(await readFile(file, "utf8"));
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function exists(file) {
  try {
    await readdir(file);
    return true;
  } catch {
    try {
      await readFile(file);
      return true;
    } catch {
      return false;
    }
  }
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((item) => item.some((cell) => cell.trim()));
  return dataRows.map((dataRow) => Object.fromEntries(headers.map((header, index) => [header.trim(), dataRow[index]?.trim() ?? ""])));
}

function groupMetadataByTitle(rows) {
  const byTitle = new Map();
  for (const row of rows) {
    const title = normalizeTitle(row.Title ?? "");
    const list = byTitle.get(title) ?? [];
    list.push(row);
    byTitle.set(title, list);
  }
  return byTitle;
}

function nextMetadataForTitle(byTitle, title) {
  const key = normalizeTitle(title);
  const rows = byTitle.get(key);
  return rows?.shift();
}

function groupAttachmentsByNoteDir(files) {
  const byDir = new Map();
  for (const file of files) {
    const noteDir = noteDirForAttachment(file);
    const list = byDir.get(noteDir) ?? [];
    list.push(file);
    byDir.set(noteDir, list);
  }
  return byDir;
}

function noteDirForAttachment(file) {
  const parts = file.split(path.sep);
  const sketchesIndex = parts.lastIndexOf("sketches");
  if (sketchesIndex > 0) return parts.slice(0, sketchesIndex).join(path.sep);
  return path.dirname(file);
}

function folderFromNoteRelativeDir(relativeDir) {
  const parts = relativeDir.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function findDuplicateHashes(notes) {
  const counts = new Map();
  for (const note of notes) counts.set(note.bodyHash, (counts.get(note.bodyHash) ?? 0) + 1);
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([hash]) => hash));
}

function sourceOrientation(note) {
  const topics = note.classification.topics.join(", ");
  const refs = note.scriptureReferences.length ? note.scriptureReferences.join(", ") : "none detected";
  return `Apple Notes own-voice source imported for review. Topics: ${topics}. Scripture references: ${refs}.`;
}

function extractQuestions(value) {
  return unique(
    value
      .split(/\r?\n|(?<=[?])\s+/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith("?"))
  ).slice(0, 12);
}

function extractFrameworkSignals(value, themes) {
  const signals = [];
  if (/\b(?:leads to|becomes|from .+ to|through|toward|therefore)\b/i.test(value) && themes.length >= 2) {
    signals.push(themes.map((theme) => theme.label).slice(0, 5).join(" -> "));
  }
  if (/\b(order|potential|leadership|kingdom)\b/i.test(value)) signals.push("Order -> Potential -> Leadership -> Kingdom");
  if (/\b(temple|eden|church|new creation)\b/i.test(value)) signals.push("Temple -> Eden -> Church -> New Creation");
  return unique(signals);
}

function toManifestRow(note) {
  return {
    id: note.id,
    title: note.title,
    created: note.created,
    modified: note.modified,
    sourcePath: note.sourcePath,
    contentHash: note.contentHash,
    bodyHash: note.bodyHash,
    attachments: note.attachments,
    folder: note.folder,
    detectedRisks: note.detectedRisks,
    classification: note.classification,
    scriptureReferences: note.scriptureReferences,
    automaticReviewStatus: note.automaticReviewStatus,
    reviewStatus: note.reviewStatus,
    reviewDecision: note.reviewDecision ?? null,
    generatedPath: note.generatedPath,
    internalGroundingPath: canGenerateInternalGroundingNote(note) ? note.internalGroundingPath : ""
  };
}

function toReviewQueueItem(note) {
  return {
    id: note.id,
    title: note.title,
    sourcePath: note.sourcePath,
    riskLevel: note.riskLevel,
    riskCategories: note.detectedRisks.map((risk) => risk.category),
    reviewStatus: note.reviewStatus,
    topics: note.classification.topics
  };
}

function toArtifactPreview(artifact) {
  return {
    kind: artifact.kind,
    relativePath: artifact.relativePath,
    title: artifact.title,
    bytes: Buffer.byteLength(artifact.content, "utf8")
  };
}

function topCounts(values, limit) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function normalizeBody(value) {
  return (value ?? "").normalize("NFKC").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeTitle(value) {
  return (value ?? "Untitled").normalize("NFKC").replace(/\s+/g, " ").trim() || "Untitled";
}

function normalizeReference(value) {
  return value.replace(/\s+/g, " ").replace(/\b([1-3])([A-Za-z])/, "$1 $2").replace(/\.$/, "").trim();
}

function expandReferenceAbbreviation(value) {
  const replacements = {
    Gen: "Genesis",
    Exo: "Exodus",
    Ex: "Exodus",
    Lev: "Leviticus",
    Num: "Numbers",
    Deut: "Deuteronomy",
    Josh: "Joshua",
    Judg: "Judges",
    Ps: "Psalm",
    Psa: "Psalm",
    Pro: "Proverbs",
    Prov: "Proverbs",
    Isa: "Isaiah",
    Jer: "Jeremiah",
    Ezk: "Ezekiel",
    Ezek: "Ezekiel",
    Dan: "Daniel",
    Mat: "Matthew",
    Matt: "Matthew",
    Mar: "Mark",
    Mrk: "Mark",
    Luk: "Luke",
    Jhn: "John",
    Rom: "Romans",
    Rev: "Revelation"
  };
  const [abbr] = value.replace(/\./g, "").split(/\s+/);
  return normalizeReference(value.replace(new RegExp(`^${escapeRegExp(abbr)}\\.?`, "i"), replacements[abbr] ?? abbr));
}

function quoteMarkdown(value) {
  return value.split("\n").map((line) => `> ${line}`).join("\n");
}

function markdownList(values) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "- None detected";
}

function yamlLine(key, value) {
  return `${key}: ${JSON.stringify(value ?? "")}`;
}

function yamlList(key, values) {
  if (!values.length) return `${key}: []`;
  return [`${key}:`, ...values.map((value) => `  - ${JSON.stringify(value)}`)].join("\n");
}

function safeFilename(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled";
}

function slugify(value) {
  return safeFilename(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const item = value[key];
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const parsed = {
    apply: false,
    archivePath: DEFAULT_ARCHIVE,
    confirmVaultWrite: false,
    dryRun: true,
    help: false,
    importDate: todayStamp(),
    out: DEFAULT_OUT,
    previewLimit: DEFAULT_PREVIEW_LIMIT,
    reviewOverridesPath: DEFAULT_REVIEW_OVERRIDES,
    sourceDir: undefined,
    vaultRoot: DEFAULT_VAULT
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      parsed.apply = true;
      parsed.dryRun = false;
    } else if (arg === "--archive") {
      parsed.archivePath = argv[++index];
    } else if (arg === "--confirm-vault-write") {
      parsed.confirmVaultWrite = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
      parsed.apply = false;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--import-date") {
      parsed.importDate = argv[++index];
    } else if (arg === "--out") {
      parsed.out = argv[++index];
    } else if (arg === "--preview-limit") {
      parsed.previewLimit = Number.parseInt(argv[++index], 10);
      if (!Number.isFinite(parsed.previewLimit) || parsed.previewLimit < 1) throw new Error("--preview-limit must be a positive number.");
    } else if (arg === "--review-overrides") {
      parsed.reviewOverridesPath = argv[++index];
    } else if (arg === "--source-dir") {
      parsed.sourceDir = argv[++index];
    } else if (arg === "--vault") {
      parsed.vaultRoot = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const plan = await compileAppleNotesBrain(args);
  await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
  await writeFile(path.resolve(args.out), `${JSON.stringify({ ...plan, artifacts: undefined }, null, 2)}\n`, "utf8");

  if (args.apply) {
    if (!args.confirmVaultWrite) throw new Error("Refusing to write to the Obsidian vault without --confirm-vault-write.");
    await writeCompiledVault(plan);
  }

  console.log(JSON.stringify({
    mode: plan.mode,
    outputPath: path.resolve(args.out),
    vaultRoot: plan.vaultRoot,
    importDate: plan.importDate,
    inventory: plan.inventory,
    writePlan: plan.writePlan
  }, null, 2));
}

function printHelp() {
  console.log(`Usage: node scripts/apple-notes-brain-compiler.mjs [options]

Options:
  --archive <path>             Apple Notes export zip. Defaults to Desktop Apple notes Two_Hemisphere_Brain_Extraction.zip.
  --source-dir <path>          Extracted Apple Notes export directory. Useful for fixtures.
  --vault <path>               Meridian Obsidian vault root. Defaults to the existing Desktop two-hemisphere brain folder.
  --out <path>                 Dry-run preview JSON path. Defaults to tmp/apple-notes-brain-compiler-preview.json.
  --import-date <yyyy-mm-dd>   Import date used in vault paths. Defaults to today.
  --preview-limit <number>     Number of preview artifacts and review rows to include. Defaults to ${DEFAULT_PREVIEW_LIMIT}.
  --review-overrides <path>    Review decision JSON. Defaults to tmp/apple-notes-review-overrides.json when present.
  --dry-run                    Build preview only. Default.
  --apply                      Write generated vault artifacts. Requires --confirm-vault-write.
  --confirm-vault-write        Required with --apply.
  --help                       Show this help.

This compiler never writes to Supabase. Use the existing Obsidian RAG importer only after source notes are reviewed.
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
