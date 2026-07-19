import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createPlatformRegistrationInvite, listPlatformRegistrationInvites, PlatformRegistrationError } from "@/lib/platform/registration";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const result = await listPlatformRegistrationInvites(session, new URL(request.url).origin);
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ available: result.available, invites: result.invites });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: {
    label?: string;
    role?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    accessMode?: string;
    canSaveChanges?: boolean;
    aiEnabled?: boolean;
    aiMonthlyLimit?: number | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const invite = await createPlatformRegistrationInvite(session, {
      label: body.label,
      role: body.role,
      maxUses: body.maxUses,
      expiresAt: body.expiresAt,
      accessMode: body.accessMode,
      canSaveChanges: body.canSaveChanges === true,
      aiEnabled: body.aiEnabled === true,
      aiMonthlyLimit: body.aiMonthlyLimit
    }, new URL(request.url).origin);
    return NextResponse.json({ invite });
  } catch (error) {
    if (error instanceof PlatformRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Registration link could not be created." }, { status: 500 });
  }
}
