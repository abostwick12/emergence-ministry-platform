import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INPUT = path.join(process.cwd(), "tmp", "apple-notes-brain-compiler-preview.json");
const DEFAULT_OUT = path.join(process.cwd(), "tmp", "apple-notes-brain-review-report.md");
const DEFAULT_LIMIT = 80;

export async function buildAppleNotesReviewReport(input = {}) {
  const previewPath = path.resolve(input.previewPath ?? DEFAULT_INPUT);
  const outputPath = path.resolve(input.outputPath ?? DEFAULT_OUT);
  const sampleLimit = input.sampleLimit ?? DEFAULT_LIMIT;
  const preview = JSON.parse(await readFile(previewPath, "utf8"));
  const notes = preview.manifests?.normalizedNotes ?? [];

  const riskCount = {};
  const topicCount = {};
  const reviewCount = {};
  for (const note of notes) {
    reviewCount[note.reviewStatus] = (reviewCount[note.reviewStatus] ?? 0) + 1;
    for (const risk of note.detectedRisks ?? []) {
      riskCount[risk.category] = (riskCount[risk.category] ?? 0) + 1;
    }
    for (const topic of note.classification?.topics ?? []) {
      topicCount[topic] = (topicCount[topic] ?? 0) + 1;
    }
  }

  const scriptureNotes = notes.filter((note) => (note.scriptureReferences ?? []).length > 0);
  const lines = [
    "# Apple Notes Meridian Import Review Report",
    "",
    `Generated from dry-run preview: ${preview.generatedAt}`,
    `Archive: ${preview.archivePath}`,
    `Vault target: ${preview.vaultRoot}`,
    `Import date: ${preview.importDate}`,
    "",
    "## Executive Summary",
    "",
    `- Notes scanned: ${preview.inventory.notesScanned}`,
    `- Metadata rows: ${preview.inventory.metadataRows}`,
    `- Attachments detected: ${preview.inventory.attachments}`,
    `- Unreadable archive entries: ${preview.inventory.unreadableEntries}`,
    `- Empty notes: ${preview.inventory.emptyNotes}`,
    `- Duplicate notes: ${preview.inventory.duplicateNotes}`,
    `- Detected high-risk notes: ${preview.inventory.highRiskNotes}`,
    `- Detected medium-risk notes: ${preview.inventory.mediumRiskNotes}`,
    `- Low-risk notes: ${preview.inventory.lowRiskNotes}`,
    `- Source-note candidates: ${preview.inventory.generatedSourceNoteCandidates}`,
    `- Internal grounding candidates requiring review: ${preview.inventory.internalGroundingCandidates}`,
    "",
    "## Review Status Counts",
    "",
    ...formatCounts(reviewCount),
    "",
    "## Risk Category Counts",
    "",
    ...formatCounts(riskCount),
    "",
    "## Topic Counts",
    "",
    ...formatCounts(topicCount),
    "",
    "## Scripture Coverage",
    "",
    `- Notes with detected scripture references: ${scriptureNotes.length}`,
    "- Scripture references are listed in the normalized manifest and generated source-note previews.",
    "",
    "## Recommended Review Order",
    "",
    "1. Quarantine: high-risk notes. Do not promote without manual approval.",
    "2. Needs review: medium-risk, archive-like, uncertain, or sensitive-context notes.",
    "3. Duplicate review: choose canonical copies before generating graph links.",
    "4. Internal grounding candidates: low-risk synthesis signals only, still human-review before generation use.",
    "",
    ...formatQueueSection("Source-Note Approved Sample", notes, "source_note_approved", sampleLimit),
    "",
    ...formatQueueSection("Quarantined Sample", notes, "quarantined", sampleLimit),
    "",
    ...formatQueueSection("Needs Review Sample", notes, "needs_review", sampleLimit),
    "",
    ...formatQueueSection("Duplicate Review Sample", notes, "duplicate_review", sampleLimit),
    "",
    ...formatQueueSection("Internal Grounding Candidate Sample", notes, "private_review_candidate", sampleLimit),
    "",
    "## Safety Notes",
    "",
    "- This report intentionally excludes raw note bodies.",
    "- Internal grounding candidates are synthesis inputs only; they still require review before generation use.",
    "- No vault files or Supabase records were written by the dry run.",
    ""
  ];

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  return { outputPath, notes: notes.length, sampleLimit };
}

function formatCounts(counts) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return rows.length ? rows.map(([label, count]) => `- ${label}: ${count}`) : ["- None"];
}

function formatQueueSection(title, notes, status, limit) {
  const rows = notes.filter((note) => note.reviewStatus === status).slice(0, limit);
  return [
    `## ${title}`,
    "",
    `Showing ${rows.length} of ${notes.filter((note) => note.reviewStatus === status).length}.`,
    "",
    "| ID | Title | Risks | Topics | Source Path |",
    "|---|---|---|---|---|",
    ...rows.map(formatNoteRow)
  ];
}

function formatNoteRow(note) {
  const risks = (note.detectedRisks ?? []).map((risk) => risk.category).join(", ") || "none";
  const topics = (note.classification?.topics ?? []).join(", ") || "none";
  return `| ${tableCell(note.id)} | ${tableCell(note.title)} | ${tableCell(risks)} | ${tableCell(topics)} | ${tableCell(note.sourcePath)} |`;
}

function tableCell(value) {
  return String(value ?? "").replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
}

function parseArgs(argv) {
  const parsed = {
    previewPath: DEFAULT_INPUT,
    outputPath: DEFAULT_OUT,
    sampleLimit: DEFAULT_LIMIT
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preview") {
      parsed.previewPath = argv[++index];
    } else if (arg === "--out") {
      parsed.outputPath = argv[++index];
    } else if (arg === "--sample-limit") {
      parsed.sampleLimit = Number.parseInt(argv[++index], 10);
      if (!Number.isFinite(parsed.sampleLimit) || parsed.sampleLimit < 1) {
        throw new Error("--sample-limit must be a positive number.");
      }
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/apple-notes-brain-review-report.mjs [options]

Options:
  --preview <path>          Dry-run preview JSON. Defaults to tmp/apple-notes-brain-compiler-preview.json.
  --out <path>              Markdown report output. Defaults to tmp/apple-notes-brain-review-report.md.
  --sample-limit <number>   Rows to include per review queue. Defaults to ${DEFAULT_LIMIT}.
  --help                    Show this help.
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildAppleNotesReviewReport(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
