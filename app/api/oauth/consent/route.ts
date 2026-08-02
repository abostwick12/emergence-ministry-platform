import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { decideOAuthAuthorization, getOAuthAuthorizationDetails } from "@/lib/auth/supabase-oauth-server";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();

  const authorizationId = new URL(request.url).searchParams.get("authorization_id")?.trim() ?? "";
  if (!isValidAuthorizationId(authorizationId)) {
    return NextResponse.json({ error: "This authorization request is missing or invalid." }, { status: 400 });
  }

  const { data, error } = await getOAuthAuthorizationDetails(session.accessToken, authorizationId);
  if (error || !data) {
    return NextResponse.json({ error: "This connection request expired or could not be verified." }, { status: 400 });
  }

  if ("redirect_url" in data) {
    return NextResponse.json({ redirectUrl: data.redirect_url }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    authorizationId: data.authorization_id,
    client: {
      id: data.client.id,
      name: data.client.name,
      uri: data.client.uri
    },
    accountEmail: data.user.email,
    scopes: data.scope.split(/\s+/).filter(Boolean),
    redirectUri: data.redirect_uri
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.accessToken || session.isGuest || session.isMock) return unauthorizedResponse();

  let body: { authorizationId?: unknown; decision?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A connection decision is required." }, { status: 400 });
  }

  const authorizationId = typeof body.authorizationId === "string" ? body.authorizationId.trim() : "";
  const decision = body.decision === "approve" || body.decision === "deny" ? body.decision : null;
  if (!isValidAuthorizationId(authorizationId) || !decision) {
    return NextResponse.json({ error: "This connection decision is invalid." }, { status: 400 });
  }

  const result = await decideOAuthAuthorization(session.accessToken, authorizationId, decision);

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json({ error: "The connection decision could not be completed. Please start again from Codex." }, { status: 400 });
  }

  return NextResponse.json({ redirectUrl: result.data.redirect_url }, { headers: { "Cache-Control": "no-store" } });
}

function isValidAuthorizationId(value: string) {
  return value.length >= 8 && value.length <= 500 && /^[a-zA-Z0-9._~-]+$/.test(value);
}
