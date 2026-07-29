import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getAiFeatureConfig } from "@/lib/emma/repository";
import { emmaErrors } from "@/lib/emma/errors";
import { canUseCampStubMode } from "@/lib/camp/runtime";
import { createAzureOpenAIEmmaProvider, readAzureOpenAIEmmaConfig } from "./azure-openai-provider";
import { createGeminiProvider } from "./gemini-provider";
import { createGlooEmmaProvider, DEFAULT_GLOO_EMMA_MODEL, normalizeGlooEmmaModel, readGlooEmmaConfig } from "./gloo-provider";
import { createMockEmmaProvider } from "./mock-provider";
import { createOpenAIEmmaProvider, DEFAULT_OPENAI_EMMA_MODEL } from "./openai-provider";
import type { EmmaProvider, EmmaProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_MOCK_MODEL = "mock-emma-model";
export const DEFAULT_AZURE_OPENAI_EMMA_MODEL = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || "azure-openai-deployment";
export { DEFAULT_OPENAI_EMMA_MODEL };
export { DEFAULT_GLOO_EMMA_MODEL };

export interface ProviderSelection {
  providerId: EmmaProviderId;
  model: string;
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export function getRegisteredProvider(providerId: EmmaProviderId): EmmaProvider {
  switch (providerId) {
    case "gloo":
      return createGlooEmmaProvider();
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAIEmmaProvider();
    case "azure":
      return createAzureOpenAIEmmaProvider();
    case "mock":
      return createMockEmmaProvider();
    default:
      throw emmaErrors.provider("Unsupported EMMA provider.");
  }
}

export async function resolveProviderSelection(
  session: AuthSession,
  input?: {
    featureKey?: string;
    provider?: EmmaProviderId;
    model?: string;
    timeoutMs?: number;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<ProviderSelection> {
  const mode = normalizeProviderMode(
    process.env.EMMA_PROVIDER_MODE,
    readGlooEmmaConfig(),
    process.env.GEMINI_API_KEY,
    process.env.OPENAI_API_KEY,
    readAzureOpenAIEmmaConfig()
  );
  const featureConfig =
    input?.featureKey && isSupabaseConfigured() && !session.isMock ? await getAiFeatureConfig(session, input.featureKey) : null;

  if (featureConfig && !featureConfig.enabled) {
    throw emmaErrors.conflict("EMMA provider feature is disabled.");
  }

  const providerId =
    input?.provider ??
    normalizeProviderId(featureConfig?.primaryProvider) ??
    (mode === "mock"
      ? "mock"
      : defaultProviderForAvailableConfig(process.env.EMMA_DEFAULT_PROVIDER, {
          azureConfig: readAzureOpenAIEmmaConfig(),
          geminiApiKey: process.env.GEMINI_API_KEY,
          glooConfig: readGlooEmmaConfig(),
          openAiApiKey: process.env.OPENAI_API_KEY
        }) ?? mode);

  if (!canUseCampStubMode() && providerId === "mock") {
    throw emmaErrors.provider("EMMA launch mode requires a real provider configuration.");
  }

  const requestedModel =
    input?.model ??
    featureConfig?.primaryModel ??
    configuredModelForProvider(providerId) ??
    process.env.EMMA_DEFAULT_MODEL ??
    defaultModelForProvider(providerId);
  const model = normalizeProviderModel(providerId, requestedModel) || defaultModelForProvider(providerId);

  return {
    providerId,
    model,
    timeoutMs: input?.timeoutMs ?? featureConfig?.timeoutMs ?? undefined,
    temperature: input?.temperature ?? featureConfig?.temperature ?? undefined,
    maxOutputTokens: input?.maxOutputTokens ?? featureConfig?.maxOutputTokens ?? undefined
  };
}

function normalizeProviderMode(
  value: string | undefined,
  glooConfig: ReturnType<typeof readGlooEmmaConfig>,
  geminiApiKey: string | undefined,
  openAiApiKey: string | undefined,
  azureConfig: ReturnType<typeof readAzureOpenAIEmmaConfig>
): "mock" | "gloo" | "gemini" | "openai" | "azure" {
  if (value === "mock") return "mock";
  if (value === "gloo") return glooConfig ? "gloo" : "mock";
  if (value === "gemini") return geminiApiKey?.trim() ? "gemini" : "mock";
  if (value === "openai") return openAiApiKey?.trim() ? "openai" : "mock";
  if (value === "azure") return azureConfig ? "azure" : "mock";
  if (glooConfig) return "gloo";
  if (geminiApiKey?.trim()) return "gemini";
  if (azureConfig) return "azure";
  if (openAiApiKey?.trim()) return "openai";
  return "mock";
}

function normalizeProviderId(value: string | null | undefined): EmmaProviderId | undefined {
  if (value === "mock" || value === "gloo" || value === "gemini" || value === "openai" || value === "azure") return value;
  return undefined;
}

function defaultProviderForAvailableConfig(
  value: string | null | undefined,
  config: {
    geminiApiKey: string | undefined;
    glooConfig: ReturnType<typeof readGlooEmmaConfig>;
    openAiApiKey: string | undefined;
    azureConfig: ReturnType<typeof readAzureOpenAIEmmaConfig>;
  }
): EmmaProviderId | undefined {
  const providerId = normalizeProviderId(value);
  if (providerId === "gloo" && config.glooConfig) return "gloo";
  if (providerId === "gemini" && config.geminiApiKey?.trim()) return "gemini";
  if (providerId === "openai" && config.openAiApiKey?.trim()) return "openai";
  if (providerId === "azure" && config.azureConfig) return "azure";
  if (providerId === "mock") return "mock";
  return undefined;
}

function configuredModelForProvider(providerId: EmmaProviderId) {
  if (providerId === "gloo") return process.env.GLOO_AI_MODEL?.trim() || process.env.GLOO_AI_STUDIO_MODEL?.trim() || undefined;
  if (providerId === "openai") return process.env.OPENAI_MODEL?.trim() || undefined;
  if (providerId === "azure") return process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || undefined;
  return undefined;
}

function defaultModelForProvider(providerId: EmmaProviderId) {
  if (providerId === "gloo") {
    return normalizeGlooEmmaModel(process.env.GLOO_AI_MODEL || process.env.GLOO_AI_STUDIO_MODEL) || DEFAULT_GLOO_EMMA_MODEL || "gloo-openai-gpt-5-nano";
  }
  if (providerId === "gemini") return DEFAULT_GEMINI_MODEL;
  if (providerId === "openai") return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_EMMA_MODEL;
  if (providerId === "azure") return process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || DEFAULT_AZURE_OPENAI_EMMA_MODEL;
  return DEFAULT_MOCK_MODEL;
}

export function normalizeProviderModel(providerId: EmmaProviderId, model: string): string {
  const trimmed = model.trim();
  if (providerId === "gloo") return normalizeGlooEmmaModel(trimmed);
  if (providerId !== "gemini") return trimmed;

  const aliases: Record<string, string> = {
    "gemini-3.5-flash": DEFAULT_GEMINI_MODEL,
    "models/gemini-3.5-flash": `models/${DEFAULT_GEMINI_MODEL}`
  };
  return aliases[trimmed.toLowerCase()] ?? trimmed;
}
