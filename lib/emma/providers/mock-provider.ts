import { providerError } from "./errors";
import type { EmmaProvider, EmmaProviderRequest, EmmaProviderResult } from "./types";

export type MockProviderScenario = "success" | "invalid_json" | "timeout" | "provider_error";

const defaultInternalSummary = {
  summary: "Mock EMMA summary: the event has enough safe context for an internal planning review.",
  keyPoints: ["Core event details were available.", "No external communication was generated.", "No ministry records were mutated."],
  suggestedNextQuestions: ["What decision needs staff attention next?", "Are there missing planning details to confirm?"],
  confidence: 0.82,
  warnings: []
};

export function createMockEmmaProvider(options?: { scenario?: MockProviderScenario; output?: unknown }): EmmaProvider {
  const scenario = options?.scenario ?? "success";

  return {
    id: "mock",
    async generate(request: EmmaProviderRequest): Promise<EmmaProviderResult> {
      const activeScenario = scenarioFromModel(request.model) ?? scenario;

      if (activeScenario === "timeout") {
        throw providerError("timeout");
      }

      if (activeScenario === "provider_error") {
        throw providerError("provider_unavailable");
      }

      return {
        provider: "mock",
        model: request.model || "mock-emma-model",
        output: activeScenario === "invalid_json" ? { invalid: true } : (options?.output ?? defaultInternalSummary),
        usage: {
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0
        }
      };
    }
  };
}

function scenarioFromModel(model: string): MockProviderScenario | undefined {
  if (model.includes("timeout")) return "timeout";
  if (model.includes("error")) return "provider_error";
  if (model.includes("invalid")) return "invalid_json";
  return undefined;
}
