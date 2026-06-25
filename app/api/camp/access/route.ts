import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { listCampAccess, onboardCampAccessMember, updateCampAccessMember } from "@/lib/camp/access-admin";
import type { CampStoredRole } from "@/lib/camp/access-control";

// Admin-only Camp access management. Authorization is enforced inside the module
// (platform admin OR camp_admin). No medical data is read or returned here.
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const result = await listCampAccess(session);
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    available: result.available,
    bootstrapActive: result.bootstrapActive,
    roles: result.roles,
    members: result.members,
    audit: result.audit
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: { email?: string; campRole?: string; displayName?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.email || !body.campRole) {
    return NextResponse.json({ error: "Email and Camp role are required." }, { status: 400 });
  }

  const result = await onboardCampAccessMember(session, {
    email: body.email,
    campRole: body.campRole as CampStoredRole,
    displayName: body.displayName
  });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member, onboarding: result.onboarding });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: { email?: string; campRole?: string; isActive?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.email || !body.campRole) {
    return NextResponse.json({ error: "Email and Camp role are required." }, { status: 400 });
  }

  const result = await updateCampAccessMember(session, {
    email: body.email,
    campRole: body.campRole as CampStoredRole,
    isActive: body.isActive
  });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member });
}
