import { NextResponse } from "next/server";

import { authCookieNames } from "./config";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7
};

const expiredCookieOptions = { ...cookieOptions, maxAge: 0 };

export function setAuthCookies(
  response: NextResponse,
  input: { accessToken?: string; refreshToken?: string; isMock?: boolean }
) {
  if (input.isMock) {
    clearCookie(response, authCookieNames.accessToken);
    clearCookie(response, authCookieNames.refreshToken);
    clearCookie(response, authCookieNames.guestSession);
    response.cookies.set(authCookieNames.mockSession, "1", cookieOptions);
    return;
  }

  clearCookie(response, authCookieNames.mockSession);
  clearCookie(response, authCookieNames.guestSession);

  if (input.accessToken) {
    response.cookies.set(authCookieNames.accessToken, input.accessToken, cookieOptions);
  } else {
    clearCookie(response, authCookieNames.accessToken);
  }

  if (input.refreshToken) {
    response.cookies.set(authCookieNames.refreshToken, input.refreshToken, cookieOptions);
  } else {
    clearCookie(response, authCookieNames.refreshToken);
  }
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of Object.values(authCookieNames)) {
    clearCookie(response, name);
  }
}

export function clearGuestCookie(response: NextResponse) {
  clearCookie(response, authCookieNames.guestSession);
}

export function clearNonAccountCookies(response: NextResponse) {
  clearCookie(response, authCookieNames.mockSession);
  clearCookie(response, authCookieNames.guestSession);
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", expiredCookieOptions);
}
