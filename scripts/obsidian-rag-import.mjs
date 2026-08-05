import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const CANDIDATE_OPT_IN = "candidate";
const MERIDIAN_CANDIDATE_SCHEMA = "1";
const MERIDIAN_CANDIDATE_DIRECTORY = "10 Meridian Candidates";
const CANDIDATE_OBJECT_TYPES = new Set([
  "passage",
  "doctrine",
  "formation",
  "question",
  "relationship_proposal",
  "guardrail_proposal",
  "derived_journey"
]);
const RELATIONSHIP_KINDS = new Set([
  "supports",
  "derived_from",
  "interprets",
  "contradicts",
  "qualifies",
  "agrees_with",
  "applies_to",
  "not_applicable_to",
  "supersedes",
  "approved_by",
  "requires",
  "prohibited_by",
  "uses_scripture"
]);
const SCRIPTURE_BOOKS = new Set([
  "genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth",
  "1 samuel", "2 samuel", "1 kings", "2 kings", "1 chronicles", "2 chronicles", "ezra", "nehemiah",
  "esther", "job", "psalm", "psalms", "proverbs", "ecclesiastes", "song of solomon", "song of songs",
  "isaiah", "jeremiah", "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos", "obadiah",
  "jonah", "micah", "nahum", "habakkuk", "zephaniah", "haggai", "zechariah", "malachi",
  "matthew", "mark", "luke", "john", "acts", "romans", "1 corinthians", "2 corinthians",
  "galatians", "ephesians", "philippians", "colossians", "1 thessalonians", "2 thessalonians",
  "1 timothy", "2 timothy", "titus", "philemon", "hebrews", "james", "1 peter", "2 peter",
  "1 john", "2 john", "3 john", "jude", "revelation"
]);
const SCRIPTURE_USFM_CODES = new Set([
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH",
  "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS",
  "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK",
  "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT",
  "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
]);
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
const createdByUserId = args.createdByUserId ?? process.env.SUPABASE_CREATED_BY_USER_ID;

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
  if (!createdByUserId) {
    throw new Error("Set SUPABASE_CREATED_BY_USER_ID or pass --created-by-user-id before applying.");
  }
  await applyPlan(plan, { ministryId, createdByUserId });
}

export async function buildLaunchPackPlan(vaultRoot) {
  const ownVoiceDir = path.join(vaultRoot, "01 Source Notes", "01 Own Voice", "Generated");
  const scholarDir = path.join(vaultRoot, "01 Source Notes", "02 Scholar Hemisphere", "Generated");
  const curatedCandidateDir = path.join(vaultRoot, MERIDIAN_CANDIDATE_DIRECTORY);
  const files = [
    ...(await listMarkdownFiles(ownVoiceDir, "own_voice")),
    ...(await listMarkdownFiles(scholarDir, "scholar")),
    ...(await listMarkdownFilesRecursively(curatedCandidateDir, "curated"))
  ];

  const candidates = [];
  const blockedCandidates = [];
  const skipped = [];
  let optedIn = 0;
  const seenSourceKeys = new Set();
  const seenContentHashes = new Set();
  const seenTitleKeys = new Set();

  for (const file of files) {
    const raw = await readFile(file.fullPath, "utf8");
    const note = parseSourceNote(raw, file);
    if (note.meridianIngest === CANDIDATE_OPT_IN) optedIn += 1;
    const decision = decideSourceVisibility(note);

    if (!decision.include) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: decision.reason
      });
      continue;
    }

    const readiness = auditCandidateReadiness(note);
    if (readiness.status === "blocked") {
      blockedCandidates.push({
        title: limitText(note.title, MAX_TITLE_LENGTH),
        file: path.relative(vaultRoot, file.fullPath).replace(/\\/g, "/"),
        objectType: note.objectType || "undeclared",
        issues: readiness.issues
      });
      continue;
    }

    const candidate = toCandidate(note, raw, vaultRoot, readiness);
    if (seenSourceKeys.has(candidate.sourceKey)) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: "duplicate_source"
      });
      continue;
    }

    seenSourceKeys.add(candidate.sourceKey);
    if (seenContentHashes.has(candidate.contentHash)) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: "duplicate_content_hash"
      });
      continue;
    }
    seenContentHashes.add(candidate.contentHash);
    const titleKey = canonicalTitleKey(candidate.title);
    if (seenTitleKeys.has(titleKey)) {
      skipped.push({
        title: note.title,
        file: path.relative(vaultRoot, file.fullPath),
        reason: "duplicate_title_cluster"
      });
      continue;
    }

    seenTitleKeys.add(titleKey);
    candidates.push(candidate);
  }

  candidates.sort((a, b) => b.discoveryScore - a.discoveryScore || a.title.localeCompare(b.title));
  const maxSources = args.maxSources;
  const cappedCandidates = maxSources === "all" ? candidates : candidates.slice(0, maxSources);
  const cappedOut = maxSources === "all" ? [] : candidates.slice(maxSources);
  for (const candidate of cappedOut) {
    skipped.push({
      title: candidate.title,
      file: candidate.sourceUri,
      reason: "launch_pack_cap"
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    vaultRoot,
    mode: args.apply ? "apply" : "dry-run",
    contract: {
      schema: MERIDIAN_CANDIDATE_SCHEMA,
      candidateDirectory: MERIDIAN_CANDIDATE_DIRECTORY,
      rule: "Only structurally ready, private, discovery-only candidates may enter the review queue."
    },
    candidates: cappedCandidates,
    blockedCandidates,
    skipped,
    counts: {
      scanned: files.length,
      optedIn,
      eligibleCandidates: candidates.length,
      candidates: cappedCandidates.length,
      blockedCandidates: blockedCandidates.length,
      skipped: skipped.length
    },
    readiness: summarizeReadiness(candidates, blockedCandidates)
  };
}

function parseSourceNote(raw, file) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const sourceTitle = frontmatter.source_title ?? titleFromHeading(body) ?? path.basename(file.fullPath, ".md");
  const visibility = normalizeVisibility(frontmatter.visibility ?? "");
  const meridianIngest = normalizeVisibility(frontmatter.meridian_ingest ?? "");
  const hemisphere = frontmatter.hemisphere ?? (file.kind === "scholar" ? "Scholar Hemisphere" : "Own Voice");
  const sourceCategory = frontmatter.source_category ?? "";
  const sourceType = frontmatter.source_type ?? "";
  const sourcePath = frontmatter.source_path ?? "";
  const schemaVersion = String(frontmatter.meridian_schema ?? "").trim();
  const objectType = normalizeContractValue(frontmatter.meridian_object_type ?? "");
  const concepts = extractWikiLinks(section(body, "Mind Map Links"));
  const scriptureReferences = unique([
    ...stringList(frontmatter.primary_passages),
    ...extractListItems(section(body, "Detected Scripture References"))
  ]);
  const ownVoiceSignals = extractListItems(section(body, "Own-Voice Signals"));
  const sourceOrientation = plainText(section(body, "Source Orientation"));
  const launchUse = plainText(section(body, "Launch Use"));

  return {
    title: sourceTitle,
    body,
    file,
    frontmatter,
    visibility,
    meridianIngest,
    hemisphere,
    sourceCategory,
    sourceType,
    sourcePath,
    schemaVersion,
    objectType,
    meridianSummary: scalarText(frontmatter.meridian_summary),
    claimProposals: stringList(frontmatter.claim_proposals),
    questionAliases: stringList(frontmatter.question_aliases),
    questionFacets: stringList(frontmatter.question_facets),
    traditionScope: scalarText(frontmatter.tradition_scope),
    consensusStatus: scalarText(frontmatter.consensus_status),
    audience: scalarText(frontmatter.audience),
    pastoralPosture: scalarText(frontmatter.pastoral_posture),
    relationshipKind: normalizeContractValue(frontmatter.relationship_kind ?? ""),
    relationshipFrom: scalarText(frontmatter.relationship_from),
    relationshipTo: scalarText(frontmatter.relationship_to),
    relationshipRationale: scalarText(frontmatter.relationship_rationale),
    relationshipConfidence: scalarText(frontmatter.relationship_confidence),
    relationshipScope: scalarText(frontmatter.relationship_scope),
    prohibitedConclusions: stringList(frontmatter.prohibited_conclusions),
    guardrailRationale: scalarText(frontmatter.guardrail_rationale),
    derivedFrom: stringList(frontmatter.derived_from),
    concepts,
    scriptureReferences,
    ownVoiceSignals,
    sourceOrientation,
    launchUse
  };
}

function auditCandidateReadiness(note) {
  const issues = [];
  const requireValue = (field, value) => {
    if (!hasValue(value)) issues.push(readinessIssue("error", `missing_${field}`, field, `${field} is required for ${note.objectType || "a Meridian candidate"}.`));
  };

  if (!note.schemaVersion) {
    issues.push(readinessIssue("error", "missing_meridian_schema", "meridian_schema", `meridian_schema must be ${MERIDIAN_CANDIDATE_SCHEMA}.`));
  } else if (note.schemaVersion !== MERIDIAN_CANDIDATE_SCHEMA) {
    issues.push(readinessIssue("error", "unsupported_meridian_schema", "meridian_schema", `Unsupported Meridian candidate schema ${note.schemaVersion}.`));
  }

  if (!note.objectType) {
    issues.push(readinessIssue("error", "missing_meridian_object_type", "meridian_object_type", "Declare the governed object this note proposes."));
  } else if (!CANDIDATE_OBJECT_TYPES.has(note.objectType)) {
    issues.push(readinessIssue("error", "unsupported_meridian_object_type", "meridian_object_type", `${note.objectType} is not a supported candidate object type.`));
  }

  for (const [field, value] of Object.entries(note.frontmatter)) {
    if (stringList(value).some(containsPlaceholder)) {
      issues.push(readinessIssue("error", "placeholder_value", field, `${field} still contains template placeholder text.`));
    }
  }

  requireValue("meridian_summary", note.meridianSummary || note.sourceOrientation);

  for (const reference of note.scriptureReferences) {
    if (!isValidScriptureLocator(reference)) {
      issues.push(readinessIssue("error", "invalid_scripture_locator", "primary_passages", `${reference} is not a specific canonical Scripture locator.`));
    }
  }

  if (note.objectType === "passage") {
    requireValue("primary_passages", note.scriptureReferences);
    requireValue("claim_proposals", note.claimProposals);
  } else if (note.objectType === "doctrine") {
    requireValue("primary_passages", note.scriptureReferences);
    requireValue("claim_proposals", note.claimProposals);
    requireValue("tradition_scope", note.traditionScope);
    requireValue("consensus_status", note.consensusStatus);
  } else if (note.objectType === "formation") {
    requireValue("primary_passages", note.scriptureReferences);
    requireValue("claim_proposals", note.claimProposals);
    requireValue("audience", note.audience);
    requireValue("pastoral_posture", note.pastoralPosture);
  } else if (note.objectType === "question") {
    requireValue("question_aliases", note.questionAliases);
    requireValue("question_facets", note.questionFacets);
  } else if (note.objectType === "relationship_proposal") {
    requireValue("relationship_kind", note.relationshipKind);
    requireValue("relationship_from", note.relationshipFrom);
    requireValue("relationship_to", note.relationshipTo);
    requireValue("relationship_rationale", note.relationshipRationale);
    requireValue("relationship_confidence", note.relationshipConfidence);
    requireValue("relationship_scope", note.relationshipScope);
    if (note.relationshipKind && !RELATIONSHIP_KINDS.has(note.relationshipKind)) {
      issues.push(readinessIssue("error", "invalid_relationship_kind", "relationship_kind", `${note.relationshipKind} is not a governed relationship kind.`));
    }
    const confidence = Number(note.relationshipConfidence);
    if (note.relationshipConfidence && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      issues.push(readinessIssue("error", "invalid_relationship_confidence", "relationship_confidence", "Relationship confidence must be between 0 and 1."));
    }
  } else if (note.objectType === "guardrail_proposal") {
    requireValue("prohibited_conclusions", note.prohibitedConclusions);
    requireValue("guardrail_rationale", note.guardrailRationale);
  } else if (note.objectType === "derived_journey") {
    requireValue("derived_from", note.derivedFrom);
    requireValue("primary_passages", note.scriptureReferences);
    issues.push(readinessIssue("warning", "derived_artifact_never_authority", "meridian_object_type", "Derived journeys remain authority-none and cannot approve their own claims."));
  }

  return {
    status: issues.some((issue) => issue.level === "error") ? "blocked" : "ready_for_review",
    issues
  };
}

function readinessIssue(level, code, field, message) {
  return { level, code, field, message };
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim());
}

function containsPlaceholder(value) {
  return /\b(?:replace with|placeholder|todo|tbd)\b/i.test(String(value));
}

function isValidScriptureLocator(reference) {
  const normalized = String(reference).normalize("NFKC").replace(/\s+/g, " ").trim();
  const usfm = /^([1-3]?[A-Z]{2,3})\.(\d{1,3})(?:\.(\d{1,3})(?:-(\d{1,3}))?)?$/.exec(normalized);
  if (usfm) return SCRIPTURE_USFM_CODES.has(usfm[1]) && rangeIsAscending(usfm[3], usfm[4]);

  const natural = /^((?:[1-3]\s+)?[A-Za-z]+(?:\s+(?:of\s+)?[A-Za-z]+)*)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/.exec(normalized);
  if (!natural || !SCRIPTURE_BOOKS.has(natural[1].toLowerCase())) return false;
  return rangeIsAscending(natural[3], natural[4]);
}

function rangeIsAscending(start, end) {
  if (!start || !end) return true;
  return Number(end) >= Number(start);
}

function decideSourceVisibility(note) {
  if (PRIVATE_VISIBILITIES.has(note.visibility)) {
    return { include: false, reason: `visibility:${note.visibility}` };
  }

  if (note.meridianIngest !== CANDIDATE_OPT_IN) {
    return { include: false, reason: note.meridianIngest ? `meridian_ingest:${note.meridianIngest}` : "missing_meridian_ingest_candidate" };
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

  if (!note.ownVoiceSignals.length && !note.sourceOrientation && !note.meridianSummary) {
    return { include: false, reason: "no_excerpt_safe_summary" };
  }

  return { include: true };
}

function toCandidate(note, raw, vaultRoot, readiness) {
  const concepts = unique(note.concepts.map(toConceptSlug));
  const topicTags = unique([...concepts, ...tagsFromText(note.title), ...tagsFromText(note.sourceCategory)]).slice(0, 12);
  const title = limitText(note.title, MAX_TITLE_LENGTH);
  const body = chunkBodyFor(note);
  const studentSummary = limitText(note.meridianSummary || note.sourceOrientation || body, MAX_SUMMARY_LENGTH);

  return {
    sourceKey: stableSourceKey(note, vaultRoot),
    title,
    sourceKind: "obsidian_note",
    authorityClass: "none",
    approvalStatus: "unreviewed",
    quotePolicy: "never",
    generationPolicy: "discovery_only",
    externalVisibility: "private",
    permissions: {
      quote: false,
      paraphrase: false,
      cite: false,
      finalAnswer: false,
      externalCommunication: false
    },
    sourceUri: path.relative(vaultRoot, note.file.fullPath).replace(/\\/g, "/"),
    rawText: raw,
    contentHash: createHash("sha256").update(raw, "utf8").digest("hex"),
    sensitivity: "internal",
    metadata: {
      schemaVersion: MERIDIAN_CANDIDATE_SCHEMA,
      objectType: note.objectType,
      studentSummary,
      topicTags,
      concepts,
      scriptureReferences: note.scriptureReferences,
      claimProposals: note.claimProposals,
      questionAliases: note.questionAliases,
      questionFacets: note.questionFacets,
      traditionScope: note.traditionScope || undefined,
      consensusStatus: note.consensusStatus || undefined,
      audience: note.audience || undefined,
      pastoralPosture: note.pastoralPosture || undefined,
      relationshipProposal: note.objectType === "relationship_proposal" ? {
        kind: note.relationshipKind,
        from: note.relationshipFrom,
        to: note.relationshipTo,
        rationale: note.relationshipRationale,
        confidence: Number(note.relationshipConfidence),
        scope: note.relationshipScope
      } : undefined,
      prohibitedConclusions: note.prohibitedConclusions,
      guardrailRationale: note.guardrailRationale || undefined,
      derivedFrom: note.derivedFrom,
      derivedArtifact: note.objectType === "derived_journey",
      readiness
    },
    discoveryScore: scoreLaunchSource(note, concepts, topicTags)
  };
}

function scoreLaunchSource(note, concepts, topicTags) {
  const text = [note.title, note.sourceCategory, note.sourceType, note.meridianSummary, note.sourceOrientation, note.launchUse, concepts.join(" "), topicTags.join(" ")].join(" ").toLowerCase();
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
  if (note.meridianSummary) lines.push(note.meridianSummary);
  if (note.sourceOrientation) lines.push(note.sourceOrientation);
  if (note.ownVoiceSignals.length) {
    lines.push(`Own-voice signals: ${note.ownVoiceSignals.slice(0, 4).join(" ")}`);
  }
  if (note.launchUse) lines.push(note.launchUse);
  if (note.scriptureReferences.length) lines.push(`Scripture references: ${note.scriptureReferences.join(", ")}`);
  return limitText(lines.join("\n\n").replace(/\s+/g, " ").trim(), MAX_BODY_LENGTH);
}

async function applyPlan(plan, { ministryId, createdByUserId }) {
  if (plan.blockedCandidates.length) {
    throw new Error(`Refusing to apply while ${plan.blockedCandidates.length} opted-in candidate(s) fail the Meridian readiness contract.`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before applying.");
  }

  const candidateRows = plan.candidates.map((candidate) => ({
    ministry_id: ministryId,
    title: candidate.title,
    source_uri: candidate.sourceUri,
    raw_text: candidate.rawText,
    content_hash: candidate.contentHash,
    sensitivity: candidate.sensitivity,
    metadata: candidate.metadata,
    created_by_user_id: createdByUserId
  }));

  if (candidateRows.length) {
    await supabaseFetch(url, key, "/rest/v1/meridian_candidates?on_conflict=ministry_id,content_hash", {
      method: "POST",
      body: JSON.stringify(candidateRows),
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }
    });
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        submittedCandidates: candidateRows.length,
        status: "private_discovery_candidates_only"
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
    .map((entry) => ({ kind, fullPath: path.join(dir, entry.name) }))
    .sort((a, b) => a.fullPath.localeCompare(b.fullPath));
}

async function listMarkdownFilesRecursively(dir, kind) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdownFilesRecursively(fullPath, kind));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push({ kind, fullPath });
  }
  return files.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
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

function stableSourceKey(note, vaultRoot) {
  const sourceLocator = note.sourcePath
    ? `source-${createHash("sha256").update(note.sourcePath, "utf8").digest("hex").slice(0, 16)}`
    : path.relative(vaultRoot, note.file.fullPath).replace(/\\/g, "/");
  return `${normalizeHemisphere(note.hemisphere)}:${note.title}:${sourceLocator}`.toLowerCase();
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
  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeContractValue(value) {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function scalarText(value) {
  return Array.isArray(value) ? value.join(" ").trim() : String(value ?? "").trim();
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const scalar = String(value ?? "").trim();
  return scalar ? [scalar] : [];
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
        firstCandidates: plan.candidates.slice(0, 8).map((candidate) => ({
          title: candidate.title,
          sourceUri: candidate.sourceUri,
          approvalStatus: candidate.approvalStatus,
          generationPolicy: candidate.generationPolicy,
          objectType: candidate.metadata.objectType,
          readiness: candidate.metadata.readiness.status,
          discoveryScore: candidate.discoveryScore,
          tags: candidate.metadata.topicTags.slice(0, 5)
      })),
        blockedCandidates: plan.blockedCandidates,
        readiness: plan.readiness,
        skippedReasons: summarizeSkipped(plan.skipped)
      },
      null,
      2
    )
  );
}

function summarizeReadiness(candidates, blockedCandidates) {
  const objectTypes = {};
  for (const candidate of candidates) {
    const type = candidate.metadata.objectType;
    objectTypes[type] = (objectTypes[type] ?? 0) + 1;
  }
  const blockingIssues = blockedCandidates.flatMap((candidate) => candidate.issues).filter((issue) => issue.level === "error");
  return {
    status: blockingIssues.length ? "blocked" : candidates.length ? "ready_for_review" : "empty",
    objectTypes,
    blockingIssueCounts: summarizeIssueCodes(blockingIssues)
  };
}

function summarizeIssueCodes(issues) {
  const counts = new Map();
  for (const issue of issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
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
    createdByUserId: undefined,
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
    } else if (arg === "--created-by-user-id") {
      parsed.createdByUserId = argv[++index];
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
  --apply                         Write contract-ready private candidates to Supabase.
  --confirm-production-write      Required with --apply.
  --ministry-id <uuid>            Ministry id for candidate rows. Or set SUPABASE_MINISTRY_ID.
  --created-by-user-id <uuid>     Admin reviewer id. Or set SUPABASE_CREATED_BY_USER_ID.
  --help                          Show this help.

Apply also requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
Apply refuses to run while any opted-in candidate fails the Meridian readiness contract.
`);
}
