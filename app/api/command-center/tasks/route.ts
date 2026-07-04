import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { createPersonalTask, listPersonalTasks } from "@/lib/command-center/repository";
import type { PersonalDomain, PersonalTaskPriority, PersonalTaskStatus } from "@/lib/command-center/types";

const VALID_DOMAINS: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];
const VALID_STATUSES: PersonalTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const VALID_PRIORITIES: PersonalTaskPriority[] = ["critical", "high", "medium", "low"];

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const domainParam = url.searchParams.get("domain");
  const statusParam = url.searchParams.get("status");
  const domain = domainParam && VALID_DOMAINS.includes(domainParam as PersonalDomain) ? (domainParam as PersonalDomain) : undefined;
  const status = statusParam && VALID_STATUSES.includes(statusParam as PersonalTaskStatus) ? (statusParam as PersonalTaskStatus) : undefined;

  const tasks = await listPersonalTasks(access.session, { domain, status });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json()) as {
    domain?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    tags?: string[];
  };

  if (!body.domain || !VALID_DOMAINS.includes(body.domain as PersonalDomain)) {
    return NextResponse.json({ error: "A valid domain is required" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (body.status && !VALID_STATUSES.includes(body.status as PersonalTaskStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority as PersonalTaskPriority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const task = await createPersonalTask(access.session, {
    domain: body.domain as PersonalDomain,
    title: body.title.trim(),
    description: body.description,
    status: (body.status as PersonalTaskStatus) ?? "todo",
    priority: (body.priority as PersonalTaskPriority) ?? "medium",
    dueDate: body.dueDate,
    tags: body.tags ?? []
  });

  return NextResponse.json(task, { status: 201 });
}
