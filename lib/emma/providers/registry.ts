import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getAiFeatureConfig } from "@/lib/emma/repository";
import { emmaErrors } from "@/lib/emma/errors";
import { createGeminiProvider } from "./gemini-provider";
import { createMockEmmaProvider } from "./mock-provider";
import type { EmmaProvider, EmmaProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_MOCK_MODEL = "mock-emma-model";

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
  const mode = normalizeProviderMode(process.env.EMMA_PROVIDER_MODE);
  const featureConfig =
    input?.featureKey && isSupabaseConfigured() && !session.isMock ? await getAiFeatureConfig(session, input.featureKey) : null;

  if (featureConfig && !featureConfig.enabled) {
    throw emmaErrors.conflict("EMMA provider feature is disabled.");
  }

  const providerId =
    input?.provider ??
    normalizeProviderId(featureConfig?.primaryProvider) ??
    (mode === "gemini" ? normalizeProviderId(process.env.EMMA_DEFAULT_PROVIDER) ?? "gemini" : "mock");

  const model =
    input?.model ??
    featureConfig?.primaryModel ??
    process.env.EMMA_DEFAULT_MODEL ??
    (providerId === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_MOCK_MODEL);

  return {
    providerId,
    model,
    timeoutMs: input?.timeoutMs ?? featureConfig?.timeoutMs ?? undefined,
    temperature: input?.temperature ?? featureConfig?.temperature ?? undefined,
    maxOutputTokens: input?.maxOutputTokens ?? featureConfig?.maxOutputTokens ?? undefined
  };
}

function normalizeProviderMode(value: string | undefined): "mock" | "gemini" {
  return value === "gemini" ? "gemini" : "mock";
}

function normalizeProviderId(value: string | null | undefined): EmmaProviderId | undefined {
  if (value === "mock" || value === "gemini") return value;
  return undefined;
}
