import { measureServerOperation } from "@/lib/performance/timing";

const DEFAULT_YOUVERSION_API_BASE_URL = "https://api.youversion.com";
const DEFAULT_BIBLE_ID = 3034;
const DEFAULT_BIBLE_COM_VERSION_ID = 111;
const DEFAULT_BIBLE_COM_VERSION_CODE = "NIV";
const MISSING_CONFIG_MESSAGE = "Scripture lookup is offline. You can still use the reading resources and starter passages.";
const MAX_REFERENCE_LENGTH = 80;
const PASSAGE_ID_PATTERN = /^(?:[1-3])?[A-Z]{3}\.(?:INTRO\d*|\d{1,3})(?:\.\d{1,3})?$/;
const PROVIDER_TIMEOUT_MS = 12_000;

export type YouVersionConfig =
  | {
      configured: true;
      appKey: string;
      apiBaseUrl: string;
      bibleId: number;
    }
  | {
      configured: false;
      apiBaseUrl: string;
      bibleId: number;
      reason: "missing_app_key";
      message: typeof MISSING_CONFIG_MESSAGE;
    };

export type YouVersionPassage = {
  id: string;
  content: string;
  reference: string;
};

export type YouVersionLookupResult =
  | { ok: true; passage: YouVersionPassage; passageId: string }
  | { ok: false; code: "not_configured" | "invalid_reference" | "not_found" | "provider_error"; message: string; status: number };

export type YouVersionReaderLink =
  | {
      ok: true;
      inputReference: string;
      displayReference: string;
      passageId: string;
      versionCode: string;
      url: string;
    }
  | { ok: false; message: string };

type YouVersionPassageResponse = {
  id?: unknown;
  content?: unknown;
  reference?: unknown;
};

type ScriptureBook = {
  usfm: string;
  names: string[];
};

const scriptureBooks: ScriptureBook[] = [
  { usfm: "GEN", names: ["genesis", "gen"] },
  { usfm: "EXO", names: ["exodus", "exod", "exo"] },
  { usfm: "LEV", names: ["leviticus", "lev"] },
  { usfm: "NUM", names: ["numbers", "num"] },
  { usfm: "DEU", names: ["deuteronomy", "deut", "deu"] },
  { usfm: "JOS", names: ["joshua", "josh", "jos"] },
  { usfm: "JDG", names: ["judges", "judg", "jdg"] },
  { usfm: "RUT", names: ["ruth", "rut"] },
  { usfm: "1SA", names: ["1 samuel", "first samuel", "1 sam", "i samuel"] },
  { usfm: "2SA", names: ["2 samuel", "second samuel", "2 sam", "ii samuel"] },
  { usfm: "1KI", names: ["1 kings", "first kings", "1 kgs", "i kings"] },
  { usfm: "2KI", names: ["2 kings", "second kings", "2 kgs", "ii kings"] },
  { usfm: "1CH", names: ["1 chronicles", "first chronicles", "1 chron", "i chronicles"] },
  { usfm: "2CH", names: ["2 chronicles", "second chronicles", "2 chron", "ii chronicles"] },
  { usfm: "EZR", names: ["ezra", "ezr"] },
  { usfm: "NEH", names: ["nehemiah", "neh"] },
  { usfm: "EST", names: ["esther", "est"] },
  { usfm: "JOB", names: ["job"] },
  { usfm: "PSA", names: ["psalms", "psalm", "ps", "psa"] },
  { usfm: "PRO", names: ["proverbs", "prov", "pro"] },
  { usfm: "ECC", names: ["ecclesiastes", "eccl", "ecc"] },
  { usfm: "SNG", names: ["song of songs", "song of solomon", "songs", "sng"] },
  { usfm: "ISA", names: ["isaiah", "isa"] },
  { usfm: "JER", names: ["jeremiah", "jer"] },
  { usfm: "LAM", names: ["lamentations", "lam"] },
  { usfm: "EZK", names: ["ezekiel", "ezek", "ezk"] },
  { usfm: "DAN", names: ["daniel", "dan"] },
  { usfm: "HOS", names: ["hosea", "hos"] },
  { usfm: "JOL", names: ["joel", "jol"] },
  { usfm: "AMO", names: ["amos", "amo"] },
  { usfm: "OBA", names: ["obadiah", "obad", "oba"] },
  { usfm: "JON", names: ["jonah", "jon"] },
  { usfm: "MIC", names: ["micah", "mic"] },
  { usfm: "NAM", names: ["nahum", "nah", "nam"] },
  { usfm: "HAB", names: ["habakkuk", "hab"] },
  { usfm: "ZEP", names: ["zephaniah", "zeph", "zep"] },
  { usfm: "HAG", names: ["haggai", "hag"] },
  { usfm: "ZEC", names: ["zechariah", "zech", "zec"] },
  { usfm: "MAL", names: ["malachi", "mal"] },
  { usfm: "MAT", names: ["matthew", "matt", "mat"] },
  { usfm: "MRK", names: ["mark", "mrk"] },
  { usfm: "LUK", names: ["luke", "luk"] },
  { usfm: "JHN", names: ["john", "jhn"] },
  { usfm: "ACT", names: ["acts", "act"] },
  { usfm: "ROM", names: ["romans", "rom"] },
  { usfm: "1CO", names: ["1 corinthians", "first corinthians", "1 cor", "i corinthians"] },
  { usfm: "2CO", names: ["2 corinthians", "second corinthians", "2 cor", "ii corinthians"] },
  { usfm: "GAL", names: ["galatians", "gal"] },
  { usfm: "EPH", names: ["ephesians", "eph"] },
  { usfm: "PHP", names: ["philippians", "phil", "php"] },
  { usfm: "COL", names: ["colossians", "col"] },
  { usfm: "1TH", names: ["1 thessalonians", "first thessalonians", "1 thess", "i thessalonians"] },
  { usfm: "2TH", names: ["2 thessalonians", "second thessalonians", "2 thess", "ii thessalonians"] },
  { usfm: "1TI", names: ["1 timothy", "first timothy", "1 tim", "i timothy"] },
  { usfm: "2TI", names: ["2 timothy", "second timothy", "2 tim", "ii timothy"] },
  { usfm: "TIT", names: ["titus", "tit"] },
  { usfm: "PHM", names: ["philemon", "phlm", "phm"] },
  { usfm: "HEB", names: ["hebrews", "heb"] },
  { usfm: "JAS", names: ["james", "jas"] },
  { usfm: "1PE", names: ["1 peter", "first peter", "1 pet", "i peter"] },
  { usfm: "2PE", names: ["2 peter", "second peter", "2 pet", "ii peter"] },
  { usfm: "1JN", names: ["1 john", "first john", "i john"] },
  { usfm: "2JN", names: ["2 john", "second john", "ii john"] },
  { usfm: "3JN", names: ["3 john", "third john", "iii john"] },
  { usfm: "JUD", names: ["jude", "jud"] },
  { usfm: "REV", names: ["revelation", "rev"] }
];

const booksByName = new Map(scriptureBooks.flatMap((book) => book.names.map((name) => [normalizeBookName(name), book.usfm])));

export function readYouVersionConfig(env: Partial<NodeJS.ProcessEnv> = process.env): YouVersionConfig {
  const appKey = (env.YVP_APP_KEY ?? env.YOUVERSION_APP_KEY)?.trim();
  const apiBaseUrl = normalizeApiBaseUrl(env.YOUVERSION_API_BASE_URL) ?? DEFAULT_YOUVERSION_API_BASE_URL;
  const bibleId = DEFAULT_BIBLE_ID;

  if (!appKey) {
    return { configured: false, apiBaseUrl, bibleId, reason: "missing_app_key", message: MISSING_CONFIG_MESSAGE };
  }

  return { configured: true, appKey, apiBaseUrl, bibleId };
}

export function sanitizeScriptureReference(input: unknown): { ok: true; reference: string; passageId: string } | { ok: false; message: string } {
  if (typeof input !== "string") {
    return { ok: false, message: "A Scripture reference is required." };
  }

  const reference = input
    .normalize("NFKC")
    .replace(/[^\w\s.:;-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!reference) {
    return { ok: false, message: "A Scripture reference is required." };
  }

  if (reference.length > MAX_REFERENCE_LENGTH) {
    return { ok: false, message: "Scripture reference is too long." };
  }

  const passageId = toPassageId(reference);
  if (!passageId) {
    return { ok: false, message: "Use a specific chapter or verse reference, like John 3:16 or JHN.3.16." };
  }

  return { ok: true, reference, passageId };
}

export async function lookupYouVersionPassage(input: { reference: unknown; signal?: AbortSignal }): Promise<YouVersionLookupResult> {
  const sanitized = sanitizeScriptureReference(input.reference);
  if (!sanitized.ok) {
    return { ok: false, code: "invalid_reference", message: sanitized.message, status: 400 };
  }

  const config = readYouVersionConfig();
  if (!config.configured) {
    return { ok: false, code: "not_configured", message: config.message, status: 503 };
  }

  const url = buildPassageUrl(config.apiBaseUrl, config.bibleId, sanitized.passageId);
  let response: Response;
  try {
    response = await measureServerOperation("provider.youversion.lookup", () => fetch(url, {
      headers: {
        Accept: "application/json",
        "X-YVP-App-Key": config.appKey
      },
      signal: input.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    }));
  } catch {
    return { ok: false, code: "provider_error", message: "Scripture lookup is temporarily unavailable.", status: 502 };
  }

  if (response.status === 204 || response.status === 404) {
    return { ok: false, code: "not_found", message: "No Scripture passage was found for that reference.", status: 404 };
  }

  if (!response.ok) {
    return { ok: false, code: "provider_error", message: "Scripture lookup is temporarily unavailable.", status: 502 };
  }

  const payload = await response.json() as YouVersionPassageResponse;
  if (typeof payload.id !== "string" || typeof payload.content !== "string" || typeof payload.reference !== "string") {
    return { ok: false, code: "provider_error", message: "Scripture lookup returned an unexpected response.", status: 502 };
  }

  return {
    ok: true,
    passageId: sanitized.passageId,
    passage: {
      id: payload.id,
      content: payload.content,
      reference: payload.reference
    }
  };
}

export function buildYouVersionReaderLink(input: unknown): YouVersionReaderLink {
  if (typeof input !== "string") {
    return { ok: false, message: "A Scripture reference is required." };
  }

  const reference = normalizeReaderReference(input);
  if (!reference) {
    return { ok: false, message: "Enter a Scripture reference first." };
  }

  if (reference.length > MAX_REFERENCE_LENGTH) {
    return { ok: false, message: "Scripture reference is too long." };
  }

  const passageId = toPassageId(reference);
  if (!passageId) {
    return { ok: false, message: "Use a chapter or verse reference, like John 1 or John 3:16." };
  }

  const versionCode = DEFAULT_BIBLE_COM_VERSION_CODE;
  const url = new URL(`https://www.bible.com/bible/${DEFAULT_BIBLE_COM_VERSION_ID}/${passageId}.${versionCode}`);
  return {
    ok: true,
    inputReference: input.trim(),
    displayReference: reference,
    passageId,
    versionCode,
    url: url.toString()
  };
}

function buildPassageUrl(apiBaseUrl: string, bibleId: number, passageId: string) {
  const baseUrl = apiBaseUrl.endsWith("/v1") ? apiBaseUrl : `${apiBaseUrl}/v1`;
  const url = new URL(`${baseUrl}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}`);
  url.searchParams.set("format", "text");
  url.searchParams.set("include_headings", "false");
  url.searchParams.set("include_notes", "false");
  return url;
}

function normalizeApiBaseUrl(value?: string) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

function toPassageId(reference: string) {
  const compact = reference.toUpperCase().replace(/\s+/g, "");
  if (PASSAGE_ID_PATTERN.test(compact)) return compact;

  const naturalMatch = reference.match(/^(.+?)\s+(\d{1,3})(?::(\d{1,3}))?$/);
  if (!naturalMatch) return undefined;

  const [, rawBook, rawChapter, rawVerse] = naturalMatch;
  const book = booksByName.get(normalizeBookName(rawBook));
  if (!book) return undefined;

  return [book, rawChapter, rawVerse].filter(Boolean).join(".");
}

function normalizeReaderReference(input: string) {
  const sanitized = input
    .normalize("NFKC")
    .replace(/[^\w\s.:;-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";
  const verseRangeStart = sanitized.match(/^(.+?\s+\d{1,3}):(\d{1,3})\s*-\s*\d{1,3}$/);
  if (verseRangeStart) return `${verseRangeStart[1]}:${verseRangeStart[2]}`;
  const chapterRangeStart = sanitized.match(/^(.+?)\s+(\d{1,3})\s*-\s*\d{1,3}$/);
  if (chapterRangeStart) return `${chapterRangeStart[1]} ${chapterRangeStart[2]}`;
  return sanitized;
}

function normalizeBookName(value: string) {
  return value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}
