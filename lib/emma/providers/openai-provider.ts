import { providerError, providerErrorFromHttpStatus } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export const DEFAULT_OPENAI_EMMA_MODEL = "gpt-4o-mini";

export function createOpenAIEmmaProvider(options?: { apiKey?: string; fetchImpl?: typeof fetch }): EmmaProvider {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    id: "openai",
    async generate(request: EmmaProviderRequest): Promise<EmmaProviderResult> {
      if (!apiKey) {
        throw providerError("configuration");
      }

      const timeoutMs = request.timeoutMs ?? 30000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: request.model || DEFAULT_OPENAI_EMMA_MODEL,
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt }
            ],
            temperature: request.temperature ?? 0.2,
            max_tokens: request.maxOutputTokens,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status);
        }

        const json = (await response.json()) as OpenAIChatResponse;
        const text = json.choices?.[0]?.message?.content?.trim();
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
          provider: "openai",
          model: json.model ?? request.model ?? DEFAULT_OPENAI_EMMA_MODEL,
          output,
          usage: {
            promptTokens: json.usage?.prompt_tokens,
            completionTokens: json.usage?.completion_tokens,
            totalTokens: json.usage?.total_tokens
          }
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
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
