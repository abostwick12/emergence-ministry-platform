import { readCampEmmaAzureConfig } from "@/lib/camp/emma-azure-provider";
import { readCampEmmaOpenAIConfig } from "@/lib/camp/emma-openai-provider";

export type MedicationLabelScanConfidence = "low" | "medium" | "high";

export type MedicationLabelScanResponse = {
  studentNameOnLabel?: string;
  medicationName?: string;
  dose?: string;
  directions?: string;
  suggestedTimes?: string[];
  quantityReceived?: string;
  instructions?: string;
  rawText?: string;
  confidence: MedicationLabelScanConfidence;
  warnings: string[];
};

export type MedicationLabelVisionResult =
  | { ok: true; scan: MedicationLabelScanResponse; provider: "azure" | "openai"; durationMs: number; model: string }
  | { ok: false; reason: "unavailable"; durationMs: number }
  | { ok: false; reason: "provider_error"; durationMs: number; status?: number }
  | { ok: false; reason: "invalid_output"; durationMs: number }
  | { ok: false; reason: "timeout"; durationMs: number };

type ChatCompletionJson = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
};

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_TOKENS = 700;

const SYSTEM_PROMPT = [
  "You extract visible text from prescription medication labels for a restricted camp medication intake draft.",
  "Do not provide medical advice, dosage validation, drug safety guidance, or approval.",
  "Only copy text that appears on the label. Do not guess missing fields.",
  "If text is blurry, uncertain, conflicting, or vague, leave the affected field blank and add a warning.",
  "Do not turn vague directions like twice daily into exact camp times. Only suggest broad times when the label clearly supports them.",
  "Return only valid JSON."
].join(" ");

const USER_PROMPT = [
  "Extract likely fields from this prescription label image.",
  "Return JSON with keys: studentNameOnLabel, medicationName, dose, directions, suggestedTimes, quantityReceived, instructions, rawText, confidence, warnings.",
  "Use confidence as low, medium, or high.",
  "For suggestedTimes, use short human-review labels such as Morning, Lunch, Dinner, Bedtime, or PRN only when clearly supported by visible label text.",
  "If the label says as needed or PRN, suggestedTimes may contain PRN.",
  "If a field is uncertain, omit it or return an empty string and explain in warnings."
].join(" ");

export async function scanMedicationLabelFrame(input: {
  dataUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<MedicationLabelVisionResult> {
  const azureConfig = readCampEmmaAzureConfig();
  if (azureConfig) {
    return callVisionChatCompletion({
      provider: "azure",
      url: `${trimTrailingSlash(azureConfig.endpoint)}/openai/deployments/${encodeURIComponent(azureConfig.deployment)}/chat/completions?api-version=${encodeURIComponent(azureConfig.apiVersion)}`,
      headers: { "api-key": azureConfig.apiKey },
      model: azureConfig.deployment,
      dataUrl: input.dataUrl,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
      maxTokens: input.maxTokens
    });
  }

  const openAiConfig = readCampEmmaOpenAIConfig();
  if (openAiConfig) {
    return callVisionChatCompletion({
      provider: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${openAiConfig.apiKey}` },
      model: openAiConfig.model,
      dataUrl: input.dataUrl,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
      maxTokens: input.maxTokens
    });
  }

  return { ok: false, reason: "unavailable", durationMs: 0 };
}

async function callVisionChatCompletion(input: {
  provider: "azure" | "openai";
  url: string;
  headers: Record<string, string>;
  model: string;
  dataUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<MedicationLabelVisionResult> {
  const startedAt = Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...input.headers
      },
      body: JSON.stringify({
        model: input.provider === "openai" ? input.model : undefined,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: input.dataUrl } }
            ]
          }
        ],
        temperature: 0,
        max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
        response_format: { type: "json_object" }
      })
    });

    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      return { ok: false, reason: "provider_error", durationMs, status: response.status };
    }

    const json = await response.json() as ChatCompletionJson;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: "invalid_output", durationMs };

    const scan = parseMedicationLabelScanJson(text);
    if (!scan) return { ok: false, reason: "invalid_output", durationMs };

    return {
      ok: true,
      scan,
      provider: input.provider,
      durationMs,
      model: json.model ?? input.model
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "timeout", durationMs };
    }
    return { ok: false, reason: "provider_error", durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseMedicationLabelScanJson(text: string): MedicationLabelScanResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;
  const confidence = normalizeConfidence(source.confidence);
  const warnings = uniqueWarnings([
    ...arrayOfStrings(source.warnings),
    ...(confidence === "low" ? ["Low-confidence scan. Verify every field against the original bottle."] : [])
  ]);

  return {
    studentNameOnLabel: cleanOptionalText(source.studentNameOnLabel, 120),
    medicationName: cleanOptionalText(source.medicationName, 160),
    dose: cleanOptionalText(source.dose, 160),
    directions: cleanOptionalText(source.directions, 500),
    suggestedTimes: arrayOfStrings(source.suggestedTimes).slice(0, 6),
    quantityReceived: cleanOptionalText(source.quantityReceived, 120),
    instructions: cleanOptionalText(source.instructions, 500),
    rawText: cleanOptionalText(source.rawText, 1600),
    confidence,
    warnings
  };
}

function stripJsonFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function cleanOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeConfidence(value: unknown): MedicationLabelScanConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean))).slice(0, 8);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
