import { providerError, providerErrorFromHttpStatus } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

const GLOO_TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const GLOO_DEFAULT_API_BASE_URL = "https://platform.ai.gloo.com/ai/v2";

const GLOO_MODEL_ALIASES: Record<string, string> = {
  "gpt-5 nano": "gloo-openai-gpt-5-nano",
  "gpt-5 mini": "gloo-openai-gpt-5-mini",
  "gemini 2.5 flash lite": "gloo-google-gemini-2.5-flash-lite"
};

export type GlooEmmaConfig = {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  model: string;
};

type GlooTokenPayload = {
  access_token?: unknown;
  expires_in?: unknown;
};

type GlooChatResponse = {
  choices?: Array<{
    message?: { content?: unknown };
    text?: unknown;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export const DEFAULT_GLOO_EMMA_MODEL = normalizeGlooEmmaModel(process.env.GLOO_AI_MODEL || process.env.GLOO_AI_STUDIO_MODEL || "gloo-openai-gpt-5-nano");

export function readGlooEmmaConfig(env: Partial<NodeJS.ProcessEnv> = process.env): GlooEmmaConfig | null {
  const clientId = env.GLOO_AI_CLIENT_ID?.trim() || "";
  const clientSecret = env.GLOO_AI_CLIENT_SECRET?.trim() || "";
  const accessToken = env.GLOO_AI_STUDIO_API_KEY?.trim() || (!clientId ? clientSecret : "");
  const apiBaseUrl = env.GLOO_AI_STUDIO_API_BASE_URL?.trim() || env.GLOO_AI_BASE_URL?.trim() || GLOO_DEFAULT_API_BASE_URL;
  const model = normalizeGlooEmmaModel(env.GLOO_AI_MODEL || env.GLOO_AI_STUDIO_MODEL);

  if ((!accessToken && (!clientId || !clientSecret)) || !apiBaseUrl || !model) return null;
  return { accessToken, clientId, clientSecret, apiBaseUrl, model };
}

export function createGlooEmmaProvider(options?: {
  config?: GlooEmmaConfig | null;
  fetchImpl?: typeof fetch;
}): EmmaProvider {
  const config = options?.config ?? readGlooEmmaConfig();
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    id: "gloo",
    async generate(request: EmmaProviderRequest): Promise<EmmaProviderResult> {
      if (!config) {
        throw providerError("configuration");
      }

      const timeoutMs = request.timeoutMs ?? 45000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const accessToken = await resolveGlooAccessToken(config, fetchImpl, controller.signal);
        const response = await fetchImpl(resolveGlooChatUrl(config.apiBaseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: normalizeGlooEmmaModel(request.model) || config.model,
            temperature: request.temperature ?? 0.2,
            max_tokens: request.maxOutputTokens ?? 700,
            messages: [
              {
                role: "system",
                content: request.systemPrompt
              },
              {
                role: "user",
                content: `${request.userPrompt}\n\nReturn only JSON.`
              }
            ]
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status);
        }

        const json = (await response.json()) as GlooChatResponse;
        const text = extractGlooOutputText(json);
        if (!text) {
          throw providerError("invalid_output");
        }

        let output: unknown;
        try {
          output = JSON.parse(extractJsonObjectText(text));
        } catch {
          throw providerError("invalid_output");
        }

        return {
          provider: "gloo",
          model: json.model ?? normalizeGlooEmmaModel(request.model) ?? config.model,
          output,
          usage: {
            promptTokens: json.usage?.prompt_tokens,
            completionTokens: json.usage?.completion_tokens,
            totalTokens: json.usage?.total_tokens
          }
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw providerError("timeout");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

export function normalizeGlooEmmaModel(value: string | undefined) {
  const trimmed = value?.trim() || "";
  return GLOO_MODEL_ALIASES[trimmed.toLowerCase()] || trimmed;
}

async function resolveGlooAccessToken(config: GlooEmmaConfig, fetchImpl: typeof fetch, signal: AbortSignal) {
  if (config.accessToken) return config.accessToken;

  const response = await fetchImpl(GLOO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    signal,
    body: "grant_type=client_credentials&scope=api%2Faccess"
  });

  if (!response.ok) {
    throw providerErrorFromHttpStatus(response.status);
  }

  const payload = (await response.json()) as GlooTokenPayload;
  if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
    throw providerError("invalid_output");
  }

  return payload.access_token.trim();
}

function resolveGlooChatUrl(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "platform.ai.gloo.com") {
      return `${parsed.origin}/ai/v2/chat/completions`;
    }
  } catch {
    // Invalid URLs are handled by fetch and normalized into provider errors.
  }

  return `${trimmed}/chat/completions`;
}

function extractGlooOutputText(json: GlooChatResponse): string | undefined {
  const content = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text;
  if (typeof content === "string") return content.trim() || undefined;
  if (!Array.isArray(content)) return undefined;

  const text = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const candidate = part as { text?: unknown; content?: unknown };
      if (typeof candidate.text === "string") return candidate.text;
      if (typeof candidate.content === "string") return candidate.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || undefined;
}

function extractJsonObjectText(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
