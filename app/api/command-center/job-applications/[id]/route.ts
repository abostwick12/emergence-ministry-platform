import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateJobApplication } from "@/lib/command-center/repository";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();
  const application = await updateJobApplication(access.session, params.id, body);
  if (!application) return NextResponse.json({ error: "Job application not found" }, { status: 404 });

  return NextResponse.json(application);
}
