import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { createPersonalTask, resolveCaptureEntry } from "@/lib/command-center/repository";
import type { PersonalDomain } from "@/lib/command-center/types";

const VALID_DOMAINS: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

// Approves or discards a Quick Capture entry. Approving creates a real task
// from the (possibly edited) suggested domain/title — capture entries never
// silently become tasks without this explicit step.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json()) as { action?: "approve" | "discard"; domain?: string; title?: string };

  if (body.action === "discard") {
    const entry = await resolveCaptureEntry(access.session, params.id, { status: "discarded" });
    if (!entry) return NextResponse.json({ error: "Capture entry not found" }, { status: 404 });
    return NextResponse.json(entry);
  }

  if (body.action === "approve") {
    if (!body.domain || !VALID_DOMAINS.includes(body.domain as PersonalDomain)) {
      return NextResponse.json({ error: "A valid domain is required to approve" }, { status: 400 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required to approve" }, { status: 400 });
    }

    const task = await createPersonalTask(access.session, {
      domain: body.domain as PersonalDomain,
      title: body.title.trim(),
      status: "todo",
      priority: "medium",
      tags: ["from-capture"]
    });

    const entry = await resolveCaptureEntry(access.session, params.id, {
      status: "processed",
      routedDomain: body.domain as PersonalDomain,
      routedTaskId: task.id
    });
    if (!entry) return NextResponse.json({ error: "Capture entry not found" }, { status: 404 });

    return NextResponse.json({ entry, task });
  }

  return NextResponse.json({ error: "action must be 'approve' or 'discard'" }, { status: 400 });
}
