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

type OpenAIResponsesResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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
        const response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: request.model || DEFAULT_OPENAI_EMMA_MODEL,
            instructions: request.systemPrompt,
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: request.userPrompt }]
              }
            ],
            temperature: request.temperature ?? 0.2,
            max_output_tokens: request.maxOutputTokens,
            text: {
              format: {
                type: "json_schema",
                name: "ministry_emma_response",
                strict: false,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" },
                    points: { type: "array", items: { type: "string" } },
                    nextActions: { type: "array", items: { type: "string" } },
                    confidence: { type: "number" },
                    warnings: { type: "array", items: { type: "string" } }
                  },
                  required: ["summary", "points", "nextActions"]
                }
              }
            }
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status);
        }

        const json = (await response.json()) as OpenAIResponsesResponse | OpenAIChatResponse;
        const text = extractOpenAIOutputText(json);
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
            promptTokens: usageNumber(json.usage, "input_tokens") ?? usageNumber(json.usage, "prompt_tokens"),
            completionTokens: usageNumber(json.usage, "output_tokens") ?? usageNumber(json.usage, "completion_tokens"),
            totalTokens: json.usage?.total_tokens
          }
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function usageNumber(usage: OpenAIResponsesResponse["usage"] | OpenAIChatResponse["usage"], key: string): number | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const value = (usage as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function extractOpenAIOutputText(json: OpenAIResponsesResponse | OpenAIChatResponse): string | undefined {
  if ("output_text" in json && typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text.trim();
  }

  if ("output" in json) {
    const text = json.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();
    if (text) return text;
  }

  if ("choices" in json) return json.choices?.[0]?.message?.content?.trim();
  return undefined;
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
