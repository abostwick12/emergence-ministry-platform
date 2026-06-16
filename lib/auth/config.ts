export const authCookieNames = {
  accessToken: "emerge_access_token",
  refreshToken: "emerge_refresh_token",
  mockSession: "emerge_mock_session"
} as const;

const DEV_AUTH_DEFAULT_ROLE = "admin";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// --- Development ("dev") auth ----------------------------------------------
// Dev auth lets reviewers sign in without Supabase credentials over Stub Mode
// mock data. It is controlled EXCLUSIVELY by server-only environment variables
// (ENABLE_DEV_AUTH / DEV_AUTH_ROLE) and is never active in production.
//
// The controlling variables must NOT be prefixed NEXT_PUBLIC_*, because Next.js
// inlines NEXT_PUBLIC_* values into the browser bundle. This module is
// server-only (imported by middleware, server components, and route handlers —
// never by a Client Component), so the reads below never reach the client.

const deprecationWarned = new Set<string>();

function warnDeprecatedPublicVar(oldName: string, newName: string) {
  // Development-only signal; never noisy in production logs.
  if (process.env.NODE_ENV === "production") return;
  if (deprecationWarned.has(oldName)) return;
  deprecationWarned.add(oldName);
  // eslint-disable-next-line no-console
  console.warn(
    `[dev-auth] ${oldName} is deprecated and exposes its value to the browser bundle. ` +
      `Use the server-only ${newName} instead, then delete ${oldName} from the environment.`
  );
}

function devAuthFlagConfigured(): boolean {
  if (process.env.ENABLE_DEV_AUTH === "true") return true;
  // Temporary compatibility: honor the old public flag on the SERVER only, so
  // existing Preview deployments keep working until their Vercel variables are
  // migrated. Read here (server-only module) so it never ships to the client.
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true") {
    warnDeprecatedPublicVar("NEXT_PUBLIC_ENABLE_DEV_AUTH", "ENABLE_DEV_AUTH");
    return true;
  }
  return false;
}

export function isMockAuthEnabled() {
  // Production NEVER uses dev auth, regardless of any flag — including a stray
  // NEXT_PUBLIC_* value that leaked into a production build. This rejection is
  // checked first so the deprecated public vars can never override it.
  if (process.env.VERCEL_ENV === "production") return false;

  // Automated tests / CI opt in explicitly.
  if (process.env.E2E_MOCK_AUTH === "true") return true;

  // Explicit server-only opt-in (set on Vercel Preview).
  if (devAuthFlagConfigured()) return true;

  // Local convenience: no Supabase configured and not a production build.
  if (!isSupabaseConfigured() && process.env.NODE_ENV !== "production") return true;

  return false;
}

// Clearer alias for non-auth consumers that only need to know whether dev auth
// is active (e.g. a server component computing the DEV AUTH badge boolean).
export const isDevAuthActive = isMockAuthEnabled;

function normalizeDevAuthRole(raw: string | undefined): string {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "administrator":
    case "admin":
      return "admin";
    case "leader":
      return "leader";
    case "student":
      return "student";
    case "parent":
      return "parent";
    default:
      return DEV_AUTH_DEFAULT_ROLE;
  }
}

export function devAuthRole(): string {
  if (process.env.DEV_AUTH_ROLE) return normalizeDevAuthRole(process.env.DEV_AUTH_ROLE);
  // Temporary compatibility with the old public role var (server-only read).
  if (process.env.NEXT_PUBLIC_DEV_AUTH_ROLE) {
    warnDeprecatedPublicVar("NEXT_PUBLIC_DEV_AUTH_ROLE", "DEV_AUTH_ROLE");
    return normalizeDevAuthRole(process.env.NEXT_PUBLIC_DEV_AUTH_ROLE);
  }
  return DEV_AUTH_DEFAULT_ROLE;
}

export function getMockAuthUser() {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "staff@example.com",
    fullName: "MVP Staff User",
    role: devAuthRole()
  };
}
