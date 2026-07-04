import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { createJobApplication, listJobApplications } from "@/lib/command-center/repository";
import type { JobApplicationStatus } from "@/lib/command-center/types";

const VALID_STATUSES: JobApplicationStatus[] = [
  "researching",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn"
];

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam as JobApplicationStatus)
    ? (statusParam as JobApplicationStatus)
    : undefined;

  const applications = await listJobApplications(access.session, { status });
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json()) as {
    company?: string;
    role?: string;
    status?: string;
    appliedDate?: string;
    contactName?: string;
    contactNotes?: string;
    nextFollowUpDate?: string;
    compensationNotes?: string;
    jobUrl?: string;
  };

  if (!body.company?.trim() || !body.role?.trim()) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }
  if (body.status && !VALID_STATUSES.includes(body.status as JobApplicationStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const application = await createJobApplication(access.session, {
    company: body.company.trim(),
    role: body.role.trim(),
    status: (body.status as JobApplicationStatus) ?? "researching",
    appliedDate: body.appliedDate,
    contactName: body.contactName,
    contactNotes: body.contactNotes,
    nextFollowUpDate: body.nextFollowUpDate,
    compensationNotes: body.compensationNotes,
    jobUrl: body.jobUrl
  });

  return NextResponse.json(application, { status: 201 });
}
