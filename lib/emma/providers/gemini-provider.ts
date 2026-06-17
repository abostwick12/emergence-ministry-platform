import { providerError, providerErrorFromHttpStatus } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function createGeminiProvider(options?: { apiKey?: string; fetchImpl?: typeof fetch }): EmmaProvider {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    id: "gemini",
    async generate(request: EmmaProviderRequest): Promise<EmmaProviderResult> {
      if (!apiKey) {
        throw providerError("configuration");
      }

      const timeoutMs = request.timeoutMs ?? 30000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const modelPath = request.model.startsWith("models/") ? request.model : `models/${request.model}`;
        const url = `${GEMINI_API_BASE}/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: request.systemPrompt }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: request.userPrompt }]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: request.temperature ?? 0.2,
              maxOutputTokens: request.maxOutputTokens
            },
            store: false
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status);
        }

        const json = (await response.json()) as GeminiResponse;
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
        if (!text) {
          throw providerError("invalid_output");
        }

        let output: unknown;
        try {
          output = JSON.parse(text);
        } catch {
          throw providerError("invalid_output");
        }

        return {
          provider: "gemini",
          model: request.model,
          output,
          usage: {
            promptTokens: json.usageMetadata?.promptTokenCount,
            completionTokens: json.usageMetadata?.candidatesTokenCount,
            totalTokens: json.usageMetadata?.totalTokenCount
          }
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

