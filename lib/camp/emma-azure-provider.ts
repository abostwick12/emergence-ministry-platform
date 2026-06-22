// Server-only Azure OpenAI adapter for Camp EMMA's room-change command slice.
//
// This is intentionally a small, Camp-scoped adapter — NOT a registration into
// the general lib/emma/providers/* pipeline. The general EMMA pipeline (mock +
// Gemini providers, ai_requests/ai_runs/ai_action_proposals tables) belongs to
// the Events/Tasks/Communications domain and is ministry-wide. Camp EMMA has
// its own access rules (Andrew/Jaci/Joel + bootstrap admin) and its own data
// model, so this adapter is scoped to lib/camp to avoid entangling the two.
//
// Security:
// - Reads AZURE_OPENAI_* only from server-side process.env. Never imported by
//   client components, never exposes the key to the browser.
// - Never logs the API key, endpoint, or any restricted/medical Camp data.
// - Returns a typed "unavailable" result (not a thrown error) when required
//   env vars are missing, so callers can show a graceful EMMA-unavailable
//   state instead of a 500.

export type CampEmmaAzureConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

export type CampEmmaAzureCallResult =
  | { ok: true; text: string; durationMs: number; model: string; deployment: string }
  | { ok: false; reason: "unavailable"; durationMs: number }
  | { ok: false; reason: "provider_error"; durationMs: number; status?: number }
  | { ok: false; reason: "invalid_output"; durationMs: number }
  | { ok: false; reason: "timeout"; durationMs: number };

const DEFAULT_TIMEOUT_MS = 15000;

export function readCampEmmaAzureConfig(): CampEmmaAzureConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

  if (!endpoint || !apiKey || !deployment || !apiVersion) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

/**
 * Calls Azure OpenAI's chat completions endpoint with a system + user prompt
 * and requests structured JSON output. Returns a discriminated result instead
 * of throwing so callers always have a safe path (including "unavailable").
 */
export async function callCampEmmaAzureModel(input: {
  systemPrompt: string;
  userPrompt: string;
  config?: CampEmmaAzureConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<CampEmmaAzureCallResult> {
  const config = input.config ?? readCampEmmaAzureConfig();
  const startedAt = Date.now();

  if (!config) {
    return { ok: false, reason: "unavailable", durationMs: Date.now() - startedAt };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${trimTrailingSlash(config.endpoint)}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" }
      })
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return { ok: false, reason: "provider_error", durationMs, status: response.status };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, reason: "invalid_output", durationMs };
    }

    return {
      ok: true,
      text,
      durationMs,
      model: json.model ?? config.deployment,
      deployment: config.deployment
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

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
