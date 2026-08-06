export type StudentJourneyMatchStatus = "matched" | "leader_assignment_required";

export type StudentJourneyPassageReason = {
  reference: string;
  reason: string;
  relationship: "same_narrative" | "same_figure" | "explicit_cross_reference" | "student_supplied" | "leader_assigned";
};

export type StudentJourneySelection = {
  status: StudentJourneyMatchStatus;
  confidence: number;
  storylineId: string;
  primaryReference: string;
  supportingReferences: string[];
  whyThisPassage: string;
  matchSignals: string[];
  passageReasons: StudentJourneyPassageReason[];
};

export type StudentJourneyContentSource = {
  id: string;
  kind: "scripture" | "approved_reference";
  title: string;
  locator: string;
  url?: string;
};

export type StudentJourneySupportedText = {
  text: string;
  sourceIds: string[];
};

export type StudentJourneyFormationContent = {
  label: "AI-assisted commentary";
  provider: "gloo" | "gemini" | "openai" | "seeded";
  model: string;
  generatedAt: string;
  requiresHumanReview: true;
  sourceStatus: "supported" | "source_incomplete";
  missingSourceFields: string[];
  sources: StudentJourneyContentSource[];
  receive: {
    historicalBackground: StudentJourneySupportedText;
  };
  explore: {
    repeatedPhrase: StudentJourneySupportedText;
    workedExample: StudentJourneySupportedText;
    wholeStoryBridge: StudentJourneySupportedText;
  };
  practice: {
    slowReadingPrayer: StudentJourneySupportedText;
    responseStarter: StudentJourneySupportedText;
  };
  walk: {
    exampleActions: Array<StudentJourneySupportedText>;
  };
  see: {
    biblicalStandardReference: "Galatians 5:22-23";
    fruitToWatch: StudentJourneySupportedText;
  };
};

export function parseStudentJourneySelection(value: unknown): StudentJourneySelection | undefined {
  if (!isRecord(value)) return undefined;
  if (value.status !== "matched" && value.status !== "leader_assignment_required") return undefined;

  const confidence = numberValue(value.confidence);
  const storylineId = textValue(value.storylineId);
  const primaryReference = textValue(value.primaryReference);
  const supportingReferences = stringArray(value.supportingReferences);
  const whyThisPassage = textValue(value.whyThisPassage);
  const matchSignals = stringArray(value.matchSignals);
  const passageReasons = Array.isArray(value.passageReasons)
    ? value.passageReasons.map(parsePassageReason).filter((item): item is StudentJourneyPassageReason => Boolean(item))
    : [];

  if (confidence === undefined || !storylineId || !whyThisPassage) return undefined;
  if (value.status === "matched" && (!primaryReference || !passageReasons.length)) return undefined;
  if (value.status === "leader_assignment_required" && primaryReference) return undefined;

  return {
    status: value.status,
    confidence,
    storylineId,
    primaryReference,
    supportingReferences,
    whyThisPassage,
    matchSignals,
    passageReasons
  };
}

export function parseStudentJourneyFormationContent(value: unknown): StudentJourneyFormationContent | undefined {
  if (!isRecord(value) || value.label !== "AI-assisted commentary" || value.requiresHumanReview !== true) return undefined;
  if (value.provider !== "gloo" && value.provider !== "gemini" && value.provider !== "openai" && value.provider !== "seeded") return undefined;
  if (value.sourceStatus !== "supported" && value.sourceStatus !== "source_incomplete") return undefined;

  const missingSourceFields = stringArray(value.missingSourceFields);
  const missing = new Set(missingSourceFields);
  const sources = Array.isArray(value.sources)
    ? value.sources.map(parseSource).filter((item): item is StudentJourneyContentSource => Boolean(item))
    : [];
  const sourceIds = new Set(sources.map((source) => source.id));
  const approvedReferenceIds = new Set(sources.filter((source) => source.kind === "approved_reference").map((source) => source.id));
  const receive = isRecord(value.receive) ? parseSupportedText(value.receive.historicalBackground, sourceIds, missing.has("receive.historicalBackground")) : undefined;
  const repeatedPhrase = isRecord(value.explore) ? parseSupportedText(value.explore.repeatedPhrase, sourceIds, missing.has("explore.repeatedPhrase")) : undefined;
  const workedExample = isRecord(value.explore) ? parseSupportedText(value.explore.workedExample, sourceIds, missing.has("explore.workedExample")) : undefined;
  const wholeStoryBridge = isRecord(value.explore) ? parseSupportedText(value.explore.wholeStoryBridge, sourceIds, missing.has("explore.wholeStoryBridge")) : undefined;
  const slowReadingPrayer = isRecord(value.practice) ? parseSupportedText(value.practice.slowReadingPrayer, sourceIds, missing.has("practice.slowReadingPrayer")) : undefined;
  const responseStarter = isRecord(value.practice) ? parseSupportedText(value.practice.responseStarter, sourceIds, missing.has("practice.responseStarter")) : undefined;
  const exampleActions = isRecord(value.walk) && Array.isArray(value.walk.exampleActions)
    ? value.walk.exampleActions.map((item) => parseSupportedText(item, sourceIds, false)).filter((item): item is StudentJourneySupportedText => Boolean(item))
    : [];
  const fruitToWatch = isRecord(value.see) ? parseSupportedText(value.see.fruitToWatch, sourceIds, missing.has("see.fruitToWatch")) : undefined;
  const biblicalStandardReference = isRecord(value.see) ? value.see.biblicalStandardReference : undefined;
  const model = textValue(value.model);
  const generatedAt = textValue(value.generatedAt);
  const primaryScriptureId = "scripture-primary-passage";
  const fruitScriptureId = "scripture-galatians-5-fruit";

  if (
    !model ||
    !generatedAt ||
    !sources.length ||
    !receive ||
    !repeatedPhrase ||
    !workedExample ||
    !wholeStoryBridge ||
    !slowReadingPrayer ||
    !responseStarter ||
    (exampleActions.length < 2 && !missing.has("walk.exampleActions")) ||
    !fruitToWatch ||
    biblicalStandardReference !== "Galatians 5:22-23" ||
    (value.sourceStatus === "supported" && missingSourceFields.length > 0) ||
    (value.sourceStatus === "source_incomplete" && missingSourceFields.length === 0) ||
    !supportedBy(receive, approvedReferenceIds, missing.has("receive.historicalBackground")) ||
    !hasTwoToFourSentences(receive.text, missing.has("receive.historicalBackground")) ||
    !supportedBy(repeatedPhrase, new Set([primaryScriptureId]), missing.has("explore.repeatedPhrase")) ||
    !supportedBy(workedExample, new Set([primaryScriptureId]), missing.has("explore.workedExample")) ||
    !supportedBy(wholeStoryBridge, new Set([primaryScriptureId]), missing.has("explore.wholeStoryBridge")) ||
    !supportedBy(slowReadingPrayer, new Set([primaryScriptureId]), missing.has("practice.slowReadingPrayer")) ||
    !supportedBy(responseStarter, new Set([primaryScriptureId]), missing.has("practice.responseStarter")) ||
    (!missing.has("walk.exampleActions") && exampleActions.some((action) => !action.sourceIds.includes(primaryScriptureId))) ||
    !supportedBy(fruitToWatch, new Set([fruitScriptureId]), missing.has("see.fruitToWatch"))
  ) {
    return undefined;
  }

  return {
    label: "AI-assisted commentary",
    provider: value.provider,
    model,
    generatedAt,
    requiresHumanReview: true,
    sourceStatus: value.sourceStatus,
    missingSourceFields,
    sources,
    receive: { historicalBackground: receive },
    explore: { repeatedPhrase, workedExample, wholeStoryBridge },
    practice: { slowReadingPrayer, responseStarter },
    walk: { exampleActions: exampleActions.slice(0, 3) },
    see: { biblicalStandardReference, fruitToWatch }
  };
}

export function isJourneyFormationContentReady(content: StudentJourneyFormationContent | undefined) {
  return Boolean(content && content.sourceStatus === "supported" && content.missingSourceFields.length === 0);
}

function parsePassageReason(value: unknown): StudentJourneyPassageReason | undefined {
  if (!isRecord(value)) return undefined;
  const reference = textValue(value.reference);
  const reason = textValue(value.reason);
  const relationship = value.relationship;
  if (
    !reference ||
    !reason ||
    (relationship !== "same_narrative" &&
      relationship !== "same_figure" &&
      relationship !== "explicit_cross_reference" &&
      relationship !== "student_supplied" &&
      relationship !== "leader_assigned")
  ) {
    return undefined;
  }
  return { reference, reason, relationship };
}

function parseSource(value: unknown): StudentJourneyContentSource | undefined {
  if (!isRecord(value) || (value.kind !== "scripture" && value.kind !== "approved_reference")) return undefined;
  const id = textValue(value.id);
  const title = textValue(value.title);
  const locator = textValue(value.locator);
  const url = textValue(value.url);
  if (!id || !title || !locator) return undefined;
  return { id, kind: value.kind, title, locator, ...(url ? { url } : {}) };
}

function parseSupportedText(value: unknown, knownSourceIds: Set<string>, allowUnsupportedEmpty: boolean): StudentJourneySupportedText | undefined {
  if (!isRecord(value)) return allowUnsupportedEmpty ? { text: "", sourceIds: [] } : undefined;
  const text = textValue(value.text);
  const sourceIds = stringArray(value.sourceIds).filter((sourceId) => knownSourceIds.has(sourceId));
  if (!text || !sourceIds.length) return allowUnsupportedEmpty && !text ? { text: "", sourceIds: [] } : undefined;
  return { text, sourceIds };
}

function supportedBy(text: StudentJourneySupportedText, allowedSourceIds: Set<string>, allowUnsupportedEmpty: boolean) {
  if (allowUnsupportedEmpty && !text.text) return true;
  return text.sourceIds.some((sourceId) => allowedSourceIds.has(sourceId));
}

function hasTwoToFourSentences(value: string, allowUnsupportedEmpty: boolean) {
  if (allowUnsupportedEmpty && !value) return true;
  const sentenceCount = value.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  return sentenceCount >= 2 && sentenceCount <= 4;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map(textValue).filter(Boolean))).slice(0, 12) : [];
}

function numberValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
