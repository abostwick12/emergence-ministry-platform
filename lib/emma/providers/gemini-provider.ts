import { providerError, providerErrorFromHttpStatus, type EmmaProviderDiagnostic } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

type GeminiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      fieldViolations?: Array<{
        field?: string;
        description?: string;
      }>;
    }>;
  };
};

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
            }
          })
        });

        if (!response.ok) {
          throw providerErrorFromHttpStatus(response.status, await readGeminiErrorDiagnostic(response, apiKey));
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

async function readGeminiErrorDiagnostic(response: Response, apiKey: string): Promise<EmmaProviderDiagnostic | null> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return null;
  }

  if (!body) {
    return { googleErrorCode: response.status };
  }

  try {
    const parsed = JSON.parse(body) as GeminiErrorResponse;
    const error = parsed.error;
    if (!error) {
      return { googleErrorCode: response.status, googleErrorMessage: sanitizeDiagnosticText(body, apiKey) };
    }

    const invalidFieldPaths = (error.details ?? [])
      .flatMap((detail) => detail.fieldViolations ?? [])
      .map((violation) => sanitizeDiagnosticText(violation.field, apiKey))
      .filter((field): field is string => Boolean(field))
      .slice(0, 8);

    return {
      googleErrorCode: typeof error.code === "number" ? error.code : response.status,
      googleErrorStatus: sanitizeDiagnosticText(error.status, apiKey),
      googleErrorMessage: sanitizeDiagnosticText(error.message, apiKey),
      invalidFieldPaths: invalidFieldPaths.length ? invalidFieldPaths : undefined
    };
  } catch {
    return { googleErrorCode: response.status, googleErrorMessage: sanitizeDiagnosticText(body, apiKey) };
  }
}

function sanitizeDiagnosticText(value: unknown, apiKey: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = value
    .split(apiKey)
    .join("[redacted-google-api-key]")
    .replace(/key=([^&\s"]+)/gi, "key=[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-api-key]")
    .replace(/sk-[0-9A-Za-z_-]{20,}/g, "[redacted-secret]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, 500) : undefined;
}
