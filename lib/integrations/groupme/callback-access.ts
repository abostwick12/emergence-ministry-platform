import type { NextResponse } from "next/server";
import {
  requireEmergeOperationsWriteAccess,
  resolveEmergeOperationsWriteAccess,
  type EmergeOperationsAccess
} from "@/lib/app-area-access";
import { refreshServerAccountSession, setAuthCookies } from "@/lib/auth/server";

type RefreshedAuthCookies = {
  accessToken: string;
  refreshToken: string;
};

export async function requireGroupMeCallbackWriteAccess(): Promise<{
  access: EmergeOperationsAccess;
  refreshedAuthCookies?: RefreshedAuthCookies;
}> {
  const access = await requireEmergeOperationsWriteAccess();
  if (access.allowed || access.response.status !== 401) return { access };

  const refreshed = await refreshServerAccountSession();
  if (!refreshed) return { access };

  const refreshedAccess = await resolveEmergeOperationsWriteAccess(refreshed.session);
  if (!refreshedAccess.allowed) return { access: refreshedAccess };

  return {
    access: refreshedAccess,
    refreshedAuthCookies: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken
    }
  };
}

export function applyRefreshedAuthCookies(response: NextResponse, refreshedAuthCookies?: RefreshedAuthCookies) {
  if (refreshedAuthCookies) setAuthCookies(response, refreshedAuthCookies);
  return response;
}
