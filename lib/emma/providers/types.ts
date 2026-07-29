import type { z } from "zod";

export const EMMA_PROVIDER_IDS = ["mock", "gloo", "gemini", "openai", "azure"] as const;
export type EmmaProviderId = (typeof EMMA_PROVIDER_IDS)[number];

export const EMMA_PROVIDER_ERROR_CODES = [
  "bad_request",
  "authentication",
  "configuration",
  "payment_required",
  "forbidden",
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "invalid_output",
  "unknown"
] as const;
export type EmmaProviderErrorCode = (typeof EMMA_PROVIDER_ERROR_CODES)[number];

export interface EmmaProviderUsage {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface EmmaProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface EmmaProviderResult {
  provider: EmmaProviderId;
  model: string;
  output: unknown;
  usage?: EmmaProviderUsage;
}

export interface EmmaProvider {
  id: EmmaProviderId;
  generate(request: EmmaProviderRequest): Promise<EmmaProviderResult>;
}

export interface ProviderRunOptions<TSchema extends z.ZodTypeAny> {
  requestId: string;
  skillKey: string;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: TSchema;
  outputSchemaVersion?: string;
  inputSchemaVersion?: string;
  contextManifest?: {
    entries: Array<{
      recordId: string;
      recordType: string;
      category: string;
      sourceTable?: string;
    }>;
  };
  featureKey?: string;
  provider?: EmmaProviderId;
  model?: string;
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ProviderRunSuccess<TOutput> {
  requestId: string;
  runId: string;
  provider: EmmaProviderId;
  model: string;
  output: TOutput;
}
