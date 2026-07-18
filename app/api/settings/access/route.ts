import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { deactivatePlatformUser, listPlatformAccess, updatePlatformAccess } from "@/lib/platform/access-admin";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const result = await listPlatformAccess(session);
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    available: result.available,
    storage: result.storage,
    pages: result.pages,
    members: result.members
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: { userId?: string; role?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await updatePlatformAccess(session, {
    userId: body.userId?.trim() ?? "",
    role: body.role?.trim() ?? "",
    pageKey: stringValue((body as Record<string, unknown>).pageKey),
    allowed: (body as Record<string, unknown>).allowed === true,
    guestPageKey: stringValue((body as Record<string, unknown>).guestPageKey),
    guestPublic: (body as Record<string, unknown>).guestPublic === true
  });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member, pages: result.pages, storage: result.storage });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: { userId?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await deactivatePlatformUser(session, { userId: body.userId?.trim() ?? "" });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member, storage: result.storage });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}
