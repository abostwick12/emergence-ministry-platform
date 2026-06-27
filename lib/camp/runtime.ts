export type CampRuntimeMode = "real" | "stub";

export function isCampLaunchRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview" || env.NODE_ENV === "production";
}

export function canUseCampStubMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return false;
  return env.NODE_ENV === "test" || !isCampLaunchRuntime(env);
}

export function campRuntimeMode(input: { isMockSession: boolean; supabaseConfigured: boolean }, env: NodeJS.ProcessEnv = process.env): CampRuntimeMode {
  if (!canUseCampStubMode(env) && !input.isMockSession && input.supabaseConfigured) return "real";
  return input.isMockSession || !input.supabaseConfigured ? "stub" : "real";
}
