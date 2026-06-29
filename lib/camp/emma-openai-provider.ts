// Server-only OpenAI adapter for Camp EMMA, mirroring the shape of the Azure
// adapter (lib/camp/emma-azure-provider.ts) so callers can support either
// provider with one code path.
//
// The command interpreter already accepts a direct OPENAI_API_KEY for action
// parsing; this adapter exposes the same provider to the conversational answer
// path so configuring Azure OR OpenAI is enough for the full feature.
//
// Security:
// - Reads OPENAI_* only from server-side process.env. Never imported by client
//   components, never exposes the key to the browser.
// - Never logs the API key or any restricted/medical Camp data.
// - Returns a typed "unavailable" result (not a thrown error) when the key is
//   missing, so callers can fall back gracefully.

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 15000;

export type CampEmmaOpenAIConfig = {
  apiKey: string;
  model: string;
};

export type CampEmmaOpenAICallResult =
  | { ok: true; text: string; durationMs: number; model: string; deployment?: string }
  | { ok: false; reason: "unavailable"; durationMs: number }
  | { ok: false; reason: "provider_error"; durationMs: number; status?: number; code?: string }
  | { ok: false; reason: "invalid_output"; durationMs: number }
  | { ok: false; reason: "timeout"; durationMs: number };

export function readCampEmmaOpenAIConfig(): CampEmmaOpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL };
}

export async function callCampEmmaOpenAIModel(input: {
  systemPrompt: string;
  userPrompt: string;
  config?: CampEmmaOpenAIConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<CampEmmaOpenAICallResult> {
  const config = input.config ?? readCampEmmaOpenAIConfig();
  const startedAt = Date.now();

  if (!config) {
    return { ok: false, reason: "unavailable", durationMs: Date.now() - startedAt };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = input.maxTokens ?? 400;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" }
      })
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const code = await readProviderErrorCode(response);
      return { ok: false, reason: "provider_error", durationMs, status: response.status, code };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, reason: "invalid_output", durationMs };
    }

    return { ok: true, text, durationMs, model: json.model ?? config.model };
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

async function readProviderErrorCode(response: Response) {
  try {
    const payload = await response.json() as unknown;
    return cleanProviderErrorCode(extractProviderErrorCode(payload));
  } catch {
    return undefined;
  }
}

function extractProviderErrorCode(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  const source = value as { code?: unknown; error?: { code?: unknown } };
  return source.error?.code ?? source.code;
}

function cleanProviderErrorCode(value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(cleaned) ? cleaned : "unrecognized_error_code";
}
