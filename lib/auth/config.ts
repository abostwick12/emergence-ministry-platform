export const authCookieNames = {
  accessToken: "emerge_access_token",
  refreshToken: "emerge_refresh_token",
  mockSession: "emerge_mock_session"
} as const;

export const mockAuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "staff@example.com",
  fullName: "MVP Staff User",
  role: "admin"
};

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isMockAuthEnabled() {
  // Mock auth is allowed for: e2e/local runs (E2E_MOCK_AUTH), Vercel Preview
  // deployments (so reviewers can sign in without Supabase credentials over
  // Stub Mode mock data), and local dev when Supabase is not configured.
  // Production (VERCEL_ENV === "production") always uses real Supabase Auth.
  return (
    process.env.E2E_MOCK_AUTH === "true" ||
    process.env.VERCEL_ENV === "preview" ||
    (!isSupabaseConfigured() && process.env.NODE_ENV !== "production")
  );
}

