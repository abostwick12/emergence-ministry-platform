import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getEventWorkspace } from "@/lib/data/ministry-repository";
import { runEmmaCommand } from "@/lib/emma/commands/run-emma-command";
import { buildSafeEventEmmaContext } from "@/lib/emma/context/event-context";
import { internalEventSummarySchema } from "@/lib/emma/providers/internal-event-summary";
import { resolveMinistryScope } from "@/lib/ministry/scope";

type EventEmmaSummaryBody = {
  createProposal?: boolean;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  const { session } = access;

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const workspace = await getEventWorkspace(session, params.id);
  if (!workspace) {
    return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId || workspace.event.ministryId !== ministryId) {
    return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
  }

  let body: EventEmmaSummaryBody = {};
  try {
    body = (await request.json()) as EventEmmaSummaryBody;
  } catch {
    body = {};
  }

  let safeContext;
  try {
    safeContext = buildSafeEventEmmaContext(workspace);
  } catch {
    return NextResponse.json({ ok: false, error: "EMMA event summary failed safely." }, { status: 400 });
  }

  const result = await runEmmaCommand(session, {
    workflowKey: "internal_event_summary",
    relatedEntityType: "event",
    relatedEntityId: workspace.event.id,
    contextManifest: safeContext.contextManifest,
    requestedByUserId: session.user.id,
    ministryId,
    createProposal: body.createProposal === true,
    proposalType: body.createProposal === true ? "event_summary_recommendation" : undefined,
    source: "event_card"
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "EMMA event summary failed safely." }, { status: 400 });
  }

  const output = internalEventSummarySchema.safeParse(result.data.output);

  return NextResponse.json({
    ok: true,
    requestId: result.data.requestId,
    runId: result.data.runId,
    status: "completed",
    summary: output.success ? output.data.summary : "EMMA returned a safe event summary.",
    keyPoints: output.success ? output.data.keyPoints : [],
    missingInformation: safeContext.safeEventContext.missingInformation,
    proposalCreated: result.data.proposalCreated,
    proposalId: result.data.proposalId
  });
}
