import type { AuthSession } from "@/lib/auth/server";
import { emmaFail, emmaOk, emmaErrors } from "@/lib/emma/errors";
import {
  completeAiRun,
  createAiProviderAttempt,
  createAiRun,
  getAiRequest,
  updateAiRequestStatus
} from "@/lib/emma/repository";
import type { EmmaResponse } from "@/lib/emma/types";
import { z } from "zod";
import { normalizeProviderError } from "./errors";
import { getRegisteredProvider, resolveProviderSelection } from "./registry";
import type { ProviderRunOptions, ProviderRunSuccess } from "./types";

export async function runEmmaProviderForRequest<TSchema extends z.ZodTypeAny>(
  session: AuthSession,
  options: ProviderRunOptions<TSchema>
): Promise<EmmaResponse<ProviderRunSuccess<z.infer<TSchema>>>> {
  let runId: string | undefined;

  try {
    await getAiRequest(session, options.requestId);
    await updateAiRequestStatus(session, options.requestId, "running");

    const run = await createAiRun(session, {
      requestId: options.requestId,
      skillKey: options.skillKey,
      inputSchemaVersion: options.inputSchemaVersion,
      outputSchemaVersion: options.outputSchemaVersion ?? "1",
      contextManifest: options.contextManifest
    });
    runId = run.id;

    const selection = await resolveProviderSelection(session, {
      featureKey: options.featureKey,
      provider: options.provider,
      model: options.model,
      timeoutMs: options.timeoutMs,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens
    });
    const provider = getRegisteredProvider(selection.providerId);
    const started = Date.now();

    try {
      const providerResult = await provider.generate({
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        model: selection.model,
        timeoutMs: selection.timeoutMs,
        temperature: selection.temperature,
        maxOutputTokens: selection.maxOutputTokens
      });

      const parsed = options.outputSchema.safeParse(providerResult.output);
      if (!parsed.success) {
        const durationMs = Date.now() - started;
        await createAiProviderAttempt(session, {
          runId: run.id,
          provider: providerResult.provider,
          model: providerResult.model,
          status: "failure",
          errorCode: "invalid_output",
          durationMs,
          totalTokens: providerResult.usage?.totalTokens
        });
        await completeAiRun(session, {
          runId: run.id,
          status: "failed",
          summary: "Provider returned invalid structured output.",
          warnings: ["Provider output failed schema validation."]
        });
        await updateAiRequestStatus(session, options.requestId, "failed");
        return emmaFail(emmaErrors.provider("AI provider response failed validation safely."));
      }

      const durationMs = Date.now() - started;
      await createAiProviderAttempt(session, {
        runId: run.id,
        provider: providerResult.provider,
        model: providerResult.model,
        status: "success",
        durationMs,
        totalTokens: providerResult.usage?.totalTokens
      });
      await completeAiRun(session, {
        runId: run.id,
        status: "succeeded",
        summary: "Provider returned valid structured output.",
        warnings: []
      });
      await updateAiRequestStatus(session, options.requestId, "completed");

      return emmaOk({
        requestId: options.requestId,
        runId: run.id,
        provider: providerResult.provider,
        model: providerResult.model,
        output: parsed.data
      });
    } catch (error) {
      const normalized = normalizeProviderError(error);
      const durationMs = Date.now() - started;
      await createAiProviderAttempt(session, {
        runId: run.id,
        provider: selection.providerId,
        model: selection.model,
        status: "failure",
        errorCode: normalized.code,
        httpStatus: normalized.httpStatus,
        durationMs
      });
      await completeAiRun(session, {
        runId: run.id,
        status: "failed",
        summary: "Provider request failed safely.",
        warnings: [`Provider error category: ${normalized.code}`]
      });
      await updateAiRequestStatus(session, options.requestId, "failed");
      return emmaFail(normalized.toEmmaError());
    }
  } catch (error) {
    if (runId) {
      try {
        await completeAiRun(session, { runId, status: "failed", summary: "Provider execution failed safely." });
      } catch {
        // Keep the public error sanitized even if cleanup fails.
      }
    }
    return emmaFail(error instanceof Error ? error : emmaErrors.internal());
  }
}
