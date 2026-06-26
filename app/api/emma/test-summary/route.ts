import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { runEmmaCommand } from "@/lib/emma/commands/run-emma-command";
import { internalEventSummarySchema } from "@/lib/emma/providers/internal-event-summary";

type TestSummaryRequestBody = {
  createProposal?: boolean;
  forceFailure?: boolean;
};

export async function POST(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;
  const { session } = access;

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  let body: TestSummaryRequestBody = {};
  try {
    body = (await request.json()) as TestSummaryRequestBody;
  } catch {
    body = {};
  }

  const result = await runEmmaCommand(session, {
    workflowKey: "internal_event_summary",
    relatedEntityType: "emma_test_surface",
    relatedEntityId: "settings-admin-test",
    contextManifest: {
      entries: [
        {
          recordId: "settings-admin-test",
          recordType: "test_surface",
          category: "event",
          sourceTable: "none"
        }
      ]
    },
    requestedByUserId: session.user.id,
    createProposal: body.createProposal === true,
    proposalType: body.createProposal === true ? "event_summary_recommendation" : undefined,
    source: "assistant_panel",
    provider: "mock",
    model: body.forceFailure === true ? "mock-error" : "mock-emma-model"
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "EMMA test command failed safely." }, { status: 400 });
  }

  const output = internalEventSummarySchema.safeParse(result.data.output);

  return NextResponse.json({
    ok: true,
    requestId: result.data.requestId,
    runId: result.data.runId,
    status: "completed",
    summary: output.success ? output.data.summary : "EMMA returned a safe test result.",
    keyPoints: output.success ? output.data.keyPoints : [],
    proposalCreated: result.data.proposalCreated,
    proposalId: result.data.proposalId
  });
}
