import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import type { Role } from "@/lib/types";

export type PlatformAiAccess = {
  enabled: boolean;
  monthlyLimit: number | null;
  currentMonthUsage: number;
};

type AiAccessRow = {
  user_id: string;
  ai_enabled: boolean | null;
  monthly_request_limit: number | null;
};

type AiUsageRow = {
  user_id: string;
  estimated_units: number | null;
};

export async function getAiAccessForUsers(users: Array<{ id: string; role: Role }>): Promise<Map<string, PlatformAiAccess>> {
  const access = new Map(users.map((user) => [user.id, defaultAiAccessForRole(user.role)]));
  if (!users.length || !isSupabaseAdminConfigured()) return access;

  const userIds = users.map((user) => user.id);
  const supabase = getSupabaseAdminClient();
  try {
    const [accessRows, usageRows] = await Promise.all([
      supabase.from("platform_ai_access").select("user_id,ai_enabled,monthly_request_limit").in("user_id", userIds).returns<AiAccessRow[]>(),
      supabase
        .from("platform_ai_usage_events")
        .select("user_id,estimated_units")
        .in("user_id", userIds)
        .gte("created_at", monthStartIso())
        .returns<AiUsageRow[]>()
    ]);

    const usageByUser = new Map<string, number>();
    for (const row of usageRows.data ?? []) {
      usageByUser.set(row.user_id, (usageByUser.get(row.user_id) ?? 0) + (row.estimated_units ?? 1));
    }

    for (const user of users) {
      const row = (accessRows.data ?? []).find((item) => item.user_id === user.id);
      const fallback = defaultAiAccessForRole(user.role);
      access.set(user.id, {
        enabled: row?.ai_enabled ?? fallback.enabled,
        monthlyLimit: row ? row.monthly_request_limit : fallback.monthlyLimit,
        currentMonthUsage: usageByUser.get(user.id) ?? 0
      });
    }
  } catch {
    return access;
  }

  return access;
}

export async function updateAiAccessForUser(
  session: AuthSession,
  input: { userId: string; enabled: boolean; monthlyLimit: number | null }
): Promise<PlatformAiAccess | { error: string; status: number }> {
  if (session.isGuest || session.user.role !== "admin") {
    return { error: "Platform administrator access is required.", status: 403 };
  }
  if (!input.userId.trim()) return { error: "Choose a user to update.", status: 400 };
  if (!isSupabaseAdminConfigured()) return { error: "AI access controls require Supabase service-role access.", status: 503 };

  const monthlyLimit = normalizeMonthlyLimit(input.monthlyLimit);
  if (monthlyLimit === "invalid") return { error: "Monthly AI request limit must be between 1 and 1000.", status: 400 };

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("platform_ai_access")
    .upsert(
      {
        user_id: input.userId,
        ai_enabled: input.enabled,
        monthly_request_limit: monthlyLimit,
        updated_by: session.user.id
      },
      { onConflict: "user_id" }
    );

  if (result.error) return { error: "AI access could not be updated.", status: 503 };
  return {
    enabled: input.enabled,
    monthlyLimit,
    currentMonthUsage: await currentMonthUsage(input.userId)
  };
}

export async function checkAndRecordAiUsage(session: AuthSession, featureKey: string): Promise<{ allowed: true } | { allowed: false; status: number; error: string }> {
  if (session.isMock || !isSupabaseAdminConfigured()) return { allowed: true };

  const access = (await getAiAccessForUsers([{ id: session.user.id, role: session.user.role as Role }])).get(session.user.id)
    ?? defaultAiAccessForRole(session.user.role as Role);
  if (!access.enabled) {
    return { allowed: false, status: 403, error: "AI access is turned off for this account." };
  }
  if (access.monthlyLimit != null && access.currentMonthUsage >= access.monthlyLimit) {
    return { allowed: false, status: 429, error: "This account has reached its monthly AI request limit." };
  }

  const supabase = getSupabaseAdminClient();
  const ministryId = await resolveMinistryScope(session);
  try {
    await supabase.from("platform_ai_usage_events").insert({
      ministry_id: ministryId ?? null,
      user_id: session.user.id,
      feature_key: featureKey,
      estimated_units: 1
    });
  } catch {
    return { allowed: false, status: 503, error: "AI usage could not be recorded, so the request was stopped safely." };
  }

  return { allowed: true };
}

export function defaultAiAccessForRole(role: Role): PlatformAiAccess {
  if (role === "admin") return { enabled: true, monthlyLimit: null, currentMonthUsage: 0 };
  return { enabled: true, monthlyLimit: 25, currentMonthUsage: 0 };
}

async function currentMonthUsage(userId: string) {
  if (!isSupabaseAdminConfigured()) return 0;
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("platform_ai_usage_events")
    .select("estimated_units")
    .eq("user_id", userId)
    .gte("created_at", monthStartIso())
    .returns<Array<{ estimated_units: number | null }>>();

  if (result.error) return 0;
  return (result.data ?? []).reduce((total, row) => total + (row.estimated_units ?? 1), 0);
}

function normalizeMonthlyLimit(value: number | null): number | null | "invalid" {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.floor(value);
  if (rounded < 1 || rounded > 1000) return "invalid";
  return rounded;
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
