type JwtPayload = {
  exp?: unknown;
};

export function getAccessTokenExpiration(accessToken: string): number | null {
  const segments = accessToken.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(segments[1])) as JwtPayload;
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

export function isAccessTokenUnexpired(accessToken: string, now = Date.now()) {
  const expiration = getAccessTokenExpiration(accessToken);
  return expiration !== null && expiration > Math.floor(now / 1000);
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
