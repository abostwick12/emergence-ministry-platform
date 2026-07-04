import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateJobApplication } from "@/lib/command-center/repository";
import type { JobApplicationStatus, UpdateJobApplicationInput } from "@/lib/command-center/types";

const VALID_STATUSES: JobApplicationStatus[] = [
  "researching",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn"
];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  let body: UpdateJobApplicationInput;
  try {
    body = (await request.json()) as UpdateJobApplicationInput;
  } catch {
    return NextResponse.json({ error: "Valid JSON body is required" }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.company !== undefined && !body.company.trim()) {
    return NextResponse.json({ error: "company cannot be empty" }, { status: 400 });
  }
  if (body.role !== undefined && !body.role.trim()) {
    return NextResponse.json({ error: "role cannot be empty" }, { status: 400 });
  }

  const application = await updateJobApplication(access.session, params.id, body);
  if (!application) return NextResponse.json({ error: "Job application not found" }, { status: 404 });

  return NextResponse.json(application);
}
