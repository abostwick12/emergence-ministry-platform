const ENABLED_VALUE = "true";

/**
 * Allows public guest sessions to call configured AI providers for draft-only
 * Scripture workflows. This flag never grants database, send, or integration
 * permissions and must remain server-only.
 */
export function isGuestAiGenerationEnabled(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.GUEST_AI_GENERATION_ENABLED?.trim().toLowerCase() === ENABLED_VALUE;
}

/**
 * Allows public guest sessions to mutate only their isolated demo sandbox.
 * Guest changes are not canonical ministry records and are never written to
 * production ministry tables.
 */
export function isGuestSandboxWritesEnabled(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.GUEST_SANDBOX_WRITES_ENABLED?.trim().toLowerCase() === ENABLED_VALUE;
}
