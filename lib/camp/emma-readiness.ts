import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { readCampEmmaAzureConfig } from "@/lib/camp/emma-azure-provider";
import { isCampLaunchRuntime } from "@/lib/camp/runtime";

export const CAMP_EMMA_PROVIDER_CONFIGURATION_MESSAGE =
  "EMMA provider is not configured for launch testing. Configure either Azure OpenAI server env vars (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT; optional AZURE_OPENAI_API_VERSION) or OpenAI server env vars (OPENAI_API_KEY, optional OPENAI_MODEL). Do not prefix these with NEXT_PUBLIC_.";

export const CAMP_EMMA_AZURE_PROVIDER_CONFIGURATION_MESSAGE =
  "Legacy Camp EMMA command route requires Azure OpenAI server env vars (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT; optional AZURE_OPENAI_API_VERSION). Do not prefix these with NEXT_PUBLIC_.";

export type CampEmmaReadinessCode =
  | "emma_provider_not_configured"
  | "emma_action_table_unavailable"
  | "emma_audit_table_unavailable";

export type CampEmmaReadinessResult =
  | { ok: true }
  | { ok: false; code: CampEmmaReadinessCode; message: string; status: number };

type TableCheckResult = { error: { message: string } | null };
type TableClient = {
  from(table: string): {
    select(columns: string): {
      limit(count: number): {
        returns(): Promise<TableCheckResult>;
      };
    };
  };
};

export function getCampEmmaProviderReadiness(env: NodeJS.ProcessEnv = process.env): CampEmmaReadinessResult {
  if (!isCampLaunchRuntime(env)) return { ok: true };
  const azureConfigured = Boolean(readCampEmmaAzureConfig());
  const openAiConfigured = Boolean(env.OPENAI_API_KEY?.trim());
  if (azureConfigured || openAiConfigured) return { ok: true };
  return {
    ok: false,
    code: "emma_provider_not_configured",
    status: 503,
    message: CAMP_EMMA_PROVIDER_CONFIGURATION_MESSAGE
  };
}

export function getLegacyCampEmmaCommandReadiness(env: NodeJS.ProcessEnv = process.env): CampEmmaReadinessResult {
  if (!isCampLaunchRuntime(env)) return { ok: true };
  if (readCampEmmaAzureConfig()) return { ok: true };
  return {
    ok: false,
    code: "emma_provider_not_configured",
    status: 503,
    message: CAMP_EMMA_AZURE_PROVIDER_CONFIGURATION_MESSAGE
  };
}

export async function getCampEmmaActionReadiness(
  session: AuthSession,
  options: { supabase?: TableClient; env?: NodeJS.ProcessEnv } = {}
): Promise<CampEmmaReadinessResult> {
  const env = options.env ?? process.env;
  if (!isCampLaunchRuntime(env)) return { ok: true };

  const provider = getCampEmmaProviderReadiness(env);
  if (!provider.ok) return provider;

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: "emma_audit_table_unavailable",
      status: 503,
      message: "EMMA action audit readiness could not be verified because Supabase is not configured."
    };
  }

  let supabase: TableClient;
  try {
    supabase = (options.supabase ?? getSupabaseAuthClient(session.accessToken)) as TableClient;
  } catch (error) {
    console.warn("[camp-emma-readiness] Supabase client unavailable", {
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.name : "unknown"
    });
    return {
      ok: false,
      code: "emma_audit_table_unavailable",
      status: 503,
      message: "EMMA action audit readiness could not be verified."
    };
  }

  const pending = await checkTable(supabase, "camp_emma_pending_actions");
  if (!pending.ok) return pending;

  const audit = await checkTable(supabase, "camp_emma_actions_audit");
  if (!audit.ok) return audit;

  return { ok: true };
}

async function checkTable(supabase: TableClient, table: "camp_emma_pending_actions" | "camp_emma_actions_audit"): Promise<CampEmmaReadinessResult> {
  const { error } = await supabase.from(table).select("id").limit(0).returns();
  if (!error) return { ok: true };

  const code = table === "camp_emma_pending_actions" ? "emma_action_table_unavailable" : "emma_audit_table_unavailable";
  console.warn("[camp-emma-readiness] table unavailable", {
    timestamp: new Date().toISOString(),
    table,
    code,
    reason: error.message
  });
  return {
    ok: false,
    code,
    status: 503,
    message: table === "camp_emma_pending_actions"
      ? "EMMA action readiness is unavailable because the pending action table could not be verified."
      : "EMMA audit readiness is unavailable because the audit table could not be verified."
  };
}
