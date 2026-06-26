import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { listCampAccess, onboardCampAccessMember, updateCampAccessMember } from "@/lib/camp/access-admin";
import type { CampStoredRole } from "@/lib/camp/access-control";
import type { CampAppAreaScope, CampEditScope } from "@/lib/camp/access-roles";

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
    editScopes: result.editScopes,
    appAreaScopes: result.appAreaScopes,
    partnerChurches: result.partnerChurches,
    teams: result.teams,
    members: result.members,
    audit: result.audit
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: {
    email?: string;
    campRole?: string;
    campEditScope?: string;
    appAreaScope?: string;
    canPostTeamBulletin?: boolean;
    partnerChurchId?: string | null;
    assignedTeamIds?: string[];
    displayName?: string;
  } = {};
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
    campEditScope: body.campEditScope as CampEditScope | undefined,
    appAreaScope: body.appAreaScope as CampAppAreaScope | undefined,
    canPostTeamBulletin: body.canPostTeamBulletin,
    partnerChurchId: body.partnerChurchId,
    assignedTeamIds: body.assignedTeamIds,
    displayName: body.displayName,
    inviteRedirectTo: new URL("/auth/set-password", request.url).toString()
  });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member, onboarding: result.onboarding });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: {
    email?: string;
    campRole?: string;
    campEditScope?: string;
    appAreaScope?: string;
    canPostTeamBulletin?: boolean;
    partnerChurchId?: string | null;
    assignedTeamIds?: string[];
    reason?: string;
    isActive?: boolean;
  } = {};
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
    campEditScope: body.campEditScope as CampEditScope | undefined,
    appAreaScope: body.appAreaScope as CampAppAreaScope | undefined,
    canPostTeamBulletin: body.canPostTeamBulletin,
    partnerChurchId: body.partnerChurchId,
    assignedTeamIds: body.assignedTeamIds,
    reason: body.reason,
    isActive: body.isActive
  });
  if (!result.allowed) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ member: result.member });
}
