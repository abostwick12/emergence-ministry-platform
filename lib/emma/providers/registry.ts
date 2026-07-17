import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getAiFeatureConfig } from "@/lib/emma/repository";
import { emmaErrors } from "@/lib/emma/errors";
import { canUseCampStubMode } from "@/lib/camp/runtime";
import { createGeminiProvider } from "./gemini-provider";
import { createMockEmmaProvider } from "./mock-provider";
import { createOpenAIEmmaProvider, DEFAULT_OPENAI_EMMA_MODEL } from "./openai-provider";
import type { EmmaProvider, EmmaProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_MOCK_MODEL = "mock-emma-model";
export { DEFAULT_OPENAI_EMMA_MODEL };

export interface ProviderSelection {
  providerId: EmmaProviderId;
  model: string;
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export function getRegisteredProvider(providerId: EmmaProviderId): EmmaProvider {
  switch (providerId) {
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAIEmmaProvider();
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
  const mode = normalizeProviderMode(process.env.EMMA_PROVIDER_MODE, process.env.GEMINI_API_KEY, process.env.OPENAI_API_KEY);
  const featureConfig =
    input?.featureKey && isSupabaseConfigured() && !session.isMock ? await getAiFeatureConfig(session, input.featureKey) : null;

  if (featureConfig && !featureConfig.enabled) {
    throw emmaErrors.conflict("EMMA provider feature is disabled.");
  }

  const providerId =
    input?.provider ??
    normalizeProviderId(featureConfig?.primaryProvider) ??
    (mode === "mock" ? "mock" : normalizeProviderId(process.env.EMMA_DEFAULT_PROVIDER) ?? mode);

  if (!canUseCampStubMode() && providerId === "mock") {
    throw emmaErrors.provider("EMMA launch mode requires a real provider configuration.");
  }

  const model =
    input?.model ??
    featureConfig?.primaryModel ??
    process.env.EMMA_DEFAULT_MODEL ??
    defaultModelForProvider(providerId);

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
  geminiApiKey: string | undefined,
  openAiApiKey: string | undefined
): "mock" | "gemini" | "openai" {
  if (value === "mock") return "mock";
  if (value === "gemini") return geminiApiKey?.trim() ? "gemini" : "mock";
  if (value === "openai") return openAiApiKey?.trim() ? "openai" : "mock";
  if (geminiApiKey?.trim()) return "gemini";
  if (openAiApiKey?.trim()) return "openai";
  return "mock";
}

function normalizeProviderId(value: string | null | undefined): EmmaProviderId | undefined {
  if (value === "mock" || value === "gemini" || value === "openai") return value;
  return undefined;
}

function defaultModelForProvider(providerId: EmmaProviderId) {
  if (providerId === "gemini") return DEFAULT_GEMINI_MODEL;
  if (providerId === "openai") return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_EMMA_MODEL;
  return DEFAULT_MOCK_MODEL;
}
