import { azureResponsesUrl } from "@/lib/ai/azure-openai";
import { DEFAULT_AZURE_OPENAI_API_VERSION } from "@/lib/ai/azure-openai";
import { providerError, providerErrorFromHttpStatus } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

type AzureResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export type AzureOpenAIEmmaConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

export function readAzureOpenAIEmmaConfig(env: NodeJS.ProcessEnv = process.env): AzureOpenAIEmmaConfig | null {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion = env.AZURE_OPENAI_API_VERSION?.trim() || DEFAULT_AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

export function createAzureOpenAIEmmaProvider(options?: {
  config?: AzureOpenAIEmmaConfig | null;
  fetchImpl?: typeof fetch;
}): EmmaProvider {
  const config = options?.config ?? readAzureOpenAIEmmaConfig();
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    id: "azure",
    async generate(request: EmmaProviderRequest): Promise<EmmaProviderResult> {
      if (!config) {
        throw providerError("configuration");
      }

      const timeoutMs = request.timeoutMs ?? 30000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(azureResponsesUrl(config.endpoint), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": config.apiKey
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: request.model || config.deployment,
            instructions: request.systemPrompt,
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: request.userPrompt }]
              }
            ],
            temperature: request.temperature ?? 0.2,
            max_output_tokens: request.maxOutputTokens
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status);
        }

        const json = (await response.json()) as AzureResponsesPayload;
        const text = extractResponsesOutputText(json);
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
          provider: "azure",
          model: json.model ?? request.model ?? config.deployment,
          output,
          usage: {
            promptTokens: json.usage?.input_tokens,
            completionTokens: json.usage?.output_tokens,
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

function extractResponsesOutputText(json: AzureResponsesPayload) {
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const text = json.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
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
