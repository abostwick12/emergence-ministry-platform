import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { getStoredCampRoleState } from "@/lib/camp/access-control";
import { readCampEmmaAzureConfig } from "@/lib/camp/emma-azure-provider";
import { canUseCampStubMode, campRuntimeMode, isCampLaunchRuntime } from "@/lib/camp/runtime";
import { getOakwoodLiveImportReadiness } from "@/lib/camp/repository";

type Check = { ok: boolean; message?: string };

export type CampLaunchReadiness = {
  runtimeMode: "real" | "stub";
  launchRuntime: boolean;
  stubAllowed: boolean;
  supabaseConnected: Check;
  campAccessMembersAvailable: Check;
  emmaProviderConfigured: Check;
  emmaActionsAuditAvailable: Check;
  importCommitEnabled: Check;
  currentUserEmail: string;
  serverResolvedCampAccess: Check & { role?: string | null };
  errors: string[];
};

export async function getCampLaunchReadiness(session: AuthSession): Promise<CampLaunchReadiness> {
  const supabaseConfigured = isSupabaseConfigured();
  const runtimeMode = campRuntimeMode({ isMockSession: session.isMock, supabaseConfigured });
  const supabase = supabaseConfigured && !session.isMock ? getSupabaseAuthClient(session.accessToken) : null;
  const stored = await getStoredCampRoleState(session);
  const emmaProviderConfigured = Boolean(readCampEmmaAzureConfig() || process.env.OPENAI_API_KEY?.trim());
  const emmaTables = supabase ? await checkTables(supabase, ["camp_emma_pending_actions", "camp_emma_actions_audit"]) : { ok: false, message: "Supabase is not connected for this session." };
  const importReadiness = await getOakwoodLiveImportReadiness(session).catch((error) => ({
    ready: false as const,
    reason: "schema" as const,
    failures: ["Oakwood import readiness check failed."],
    message: error instanceof Error ? error.message : "Oakwood import readiness check failed."
  }));

  const readiness: CampLaunchReadiness = {
    runtimeMode,
    launchRuntime: isCampLaunchRuntime(),
    stubAllowed: canUseCampStubMode(),
    supabaseConnected: {
      ok: supabaseConfigured && !session.isMock,
      message: session.isMock
        ? "Current session is using development auth."
        : supabaseConfigured
          ? undefined
          : "Supabase environment variables are not configured."
    },
    campAccessMembersAvailable: {
      ok: stored.available,
      message: stored.available ? undefined : stored.error ?? "camp_access_members could not be verified."
    },
    emmaProviderConfigured: {
      ok: emmaProviderConfigured,
      message: emmaProviderConfigured ? undefined : "No Camp EMMA Azure/OpenAI provider environment variables are configured."
    },
    emmaActionsAuditAvailable: emmaTables,
    importCommitEnabled: importReadiness.ready
      ? { ok: true }
      : { ok: false, message: importReadiness.message },
    currentUserEmail: session.user.email,
    serverResolvedCampAccess: {
      ok: Boolean(stored.role),
      role: stored.role,
      message: stored.role ? undefined : stored.available ? "No active Camp access row found for this authenticated user." : stored.error
    },
    errors: []
  };

  readiness.errors = [
    readiness.stubAllowed ? undefined : runtimeMode === "stub" ? "Launch runtime is using stub mode." : undefined,
    readiness.supabaseConnected.ok ? undefined : readiness.supabaseConnected.message,
    readiness.campAccessMembersAvailable.ok ? undefined : readiness.campAccessMembersAvailable.message,
    readiness.emmaProviderConfigured.ok ? undefined : readiness.emmaProviderConfigured.message,
    readiness.emmaActionsAuditAvailable.ok ? undefined : readiness.emmaActionsAuditAvailable.message,
    readiness.importCommitEnabled.ok ? undefined : readiness.importCommitEnabled.message,
    readiness.serverResolvedCampAccess.ok ? undefined : readiness.serverResolvedCampAccess.message
  ].filter(Boolean) as string[];

  return readiness;
}

async function checkTables(supabase: Pick<ReturnType<typeof getSupabaseAuthClient>, "from">, tables: string[]): Promise<Check> {
  const failures: string[] = [];
  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(0).returns();
    if (error) failures.push(`${table}: ${error.message}`);
  }
  return failures.length ? { ok: false, message: failures.join("; ") } : { ok: true };
}
