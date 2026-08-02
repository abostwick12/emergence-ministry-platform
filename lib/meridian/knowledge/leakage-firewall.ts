export type PrivateDiscoveryFragment = {
  id: string;
  contentHash: string;
  rawText: string;
};

export type MeridianLeakageFinding = {
  fragmentId: string;
  contentHash: string;
  kind: "exact" | "fuzzy";
  score: number;
  outputSpanHash: string;
};

export type MeridianLeakageResult =
  | { ok: true; findings: [] }
  | { ok: false; findings: MeridianLeakageFinding[]; action: "block_and_require_review" };

const EXACT_TOKEN_THRESHOLD = 7;
const FUZZY_TOKEN_THRESHOLD = 8;
const FUZZY_DICE_THRESHOLD = 0.78;

export async function inspectPrivateFragmentLeakage(
  output: string,
  privateFragments: PrivateDiscoveryFragment[]
): Promise<MeridianLeakageResult> {
  if (!privateFragments.length) return { ok: true, findings: [] };
  if (!output.trim()) {
    return {
      ok: false,
      action: "block_and_require_review",
      findings: await Promise.all(
        privateFragments.map(async (fragment) => ({
          fragmentId: fragment.id,
          contentHash: fragment.contentHash,
          kind: "exact" as const,
          score: 1,
          outputSpanHash: await sha256("")
        }))
      )
    };
  }

  const outputTokens = tokens(output);
  const outputSentences = sentenceWindows(output);
  const findings: MeridianLeakageFinding[] = [];

  for (const fragment of privateFragments) {
    const rawTokens = tokens(fragment.rawText);
    const exactSpan = findExactTokenSpan(outputTokens, rawTokens, EXACT_TOKEN_THRESHOLD);
    if (exactSpan) {
      findings.push({
        fragmentId: fragment.id,
        contentHash: fragment.contentHash,
        kind: "exact",
        score: 1,
        outputSpanHash: await sha256(exactSpan)
      });
      continue;
    }

    const rawSentences = sentenceWindows(fragment.rawText);
    const fuzzy = bestFuzzyOverlap(outputSentences, rawSentences);
    if (fuzzy && fuzzy.score >= FUZZY_DICE_THRESHOLD) {
      findings.push({
        fragmentId: fragment.id,
        contentHash: fragment.contentHash,
        kind: "fuzzy",
        score: fuzzy.score,
        outputSpanHash: await sha256(fuzzy.output)
      });
    }
  }

  return findings.length ? { ok: false, findings, action: "block_and_require_review" } : { ok: true, findings: [] };
}

function findExactTokenSpan(output: string[], raw: string[], threshold: number) {
  if (output.length < threshold || raw.length < threshold) return undefined;
  const rawWindows = new Set<string>();
  for (let index = 0; index <= raw.length - threshold; index += 1) {
    rawWindows.add(raw.slice(index, index + threshold).join(" "));
  }
  for (let index = 0; index <= output.length - threshold; index += 1) {
    const window = output.slice(index, index + threshold).join(" ");
    if (rawWindows.has(window)) return window;
  }
  return undefined;
}

function bestFuzzyOverlap(outputWindows: string[][], rawWindows: string[][]) {
  let best: { output: string; score: number } | undefined;
  for (const output of outputWindows) {
    if (output.length < FUZZY_TOKEN_THRESHOLD) continue;
    for (const raw of rawWindows) {
      if (raw.length < FUZZY_TOKEN_THRESHOLD) continue;
      const score = Math.max(dice(tokenBigrams(output), tokenBigrams(raw)), dice(new Set(output), new Set(raw)));
      if (!best || score > best.score) best = { output: output.join(" "), score };
    }
  }
  return best;
}

function sentenceWindows(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map(tokens)
    .filter((window) => window.length > 0);
}

function tokens(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function tokenBigrams(value: string[]) {
  const grams = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) grams.add(`${value[index]} ${value[index + 1]}`);
  return grams;
}

function dice(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((value) => {
    if (right.has(value)) intersection += 1;
  });
  return (2 * intersection) / (left.size + right.size);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
