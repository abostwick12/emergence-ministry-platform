import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { createResourceAttachment, resourceAttachmentErrorResponse } from "@/lib/resources/repository";
import {
  generateMeridianSermonPrepResource,
  type SermonPrepResourceKind
} from "@/lib/scripture/meridian-ai";
import { getStudentKnowledgeMatches } from "@/lib/scripture/knowledge";
import { publishWeeklyVolunteerResource } from "@/lib/volunteer-hub/data";
import type { VolunteerHubResource } from "@/lib/volunteer-hub/types";

const allowedKinds = new Set<SermonPrepResourceKind>(["outline", "leader_guide", "slide_plan", "small_group_questions"]);
type LeaderPrepGenerateInput = NonNullable<ReturnType<typeof parseInput>>;

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const input = parseInput(await request.json().catch(() => ({})));
  if (!input) {
    return NextResponse.json({ error: "Choose a sermon prep resource to generate." }, { status: 400 });
  }

  const knowledgeMatches = await getStudentKnowledgeMatches(access.session, {
    question: buildKnowledgeSearchQuery(input),
    scriptureReference: input.passage,
    topicTags: knowledgeTopicTags(input)
  }).catch(() => []);
  const generated = await generateMeridianSermonPrepResource({
    ...input,
    knowledgeMatches
  });
  const attachmentWarnings: string[] = [];
  const filename = `${slugify(generated.title)}.txt`;

  try {
    await createResourceAttachment(access.session, {
      description: `${generated.summary}\n\nSources: ${generated.sources.join("; ")}`,
      file: new File([generated.contentMarkdown], filename, { type: "text/plain" }),
      isDownloadable: true,
      isFeatured: true,
      notificationIntent: "assigned_leaders",
      parentId: "current-week",
      parentType: "weekly_leader_prep",
      title: generated.title,
      visibility: "volunteer_leaders"
    });
  } catch (error) {
    const payload = resourceAttachmentErrorResponse(error);
    attachmentWarnings.push(`Generated document was not attached: ${payload.error}`);
  }

  let volunteerResourceSaved = true;
  try {
    await publishWeeklyVolunteerResource(access.session, {
      detail: generated.summary,
      estimatedMinutes: generated.estimatedMinutes,
      itemKey: `generated_${generated.kind}`,
      shareable: true,
      title: generated.title,
      type: volunteerResourceType(generated.kind)
    });
  } catch (error) {
    volunteerResourceSaved = false;
    attachmentWarnings.push(error instanceof Error ? error.message : "Weekly resource card could not be saved.");
  }

  return NextResponse.json({
    ok: true,
    resource: generated,
    saved: {
      weeklyResourceCard: volunteerResourceSaved,
      weeklyResourceDocument: attachmentWarnings.length === 0
    },
    warnings: [...generated.warnings, ...attachmentWarnings]
  });
}

function parseInput(body: unknown) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const kind = typeof value.kind === "string" && allowedKinds.has(value.kind as SermonPrepResourceKind)
    ? value.kind as SermonPrepResourceKind
    : null;
  if (!kind) return null;

  return {
    kind,
    title: stringValue(value.title, 140),
    passage: stringValue(value.passage, 120),
    bigIdea: stringValue(value.bigIdea, 600),
    body: stringValue(value.body, 6000)
  };
}

function stringValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function volunteerResourceType(kind: SermonPrepResourceKind): VolunteerHubResource["type"] {
  if (kind === "leader_guide") return "leader_guide";
  if (kind === "slide_plan") return "slides";
  if (kind === "small_group_questions") return "discussion";
  return "notes";
}

function buildKnowledgeSearchQuery(input: LeaderPrepGenerateInput) {
  return [
    input.title,
    input.passage,
    input.bigIdea,
    input.kind === "leader_guide"
      ? "leader guide volunteer discipleship formation likely student misunderstandings pastoral guidance"
      : input.kind === "small_group_questions"
        ? "small group questions student discipleship notice interpret wrestle practice community"
        : "sermon prep ministry teaching formation",
    input.body.slice(0, 700)
  ].filter(Boolean).join(" ");
}

function knowledgeTopicTags(input: LeaderPrepGenerateInput) {
  return [
    input.kind,
    "sermon_prep",
    "discipleship",
    "formation",
    input.kind === "leader_guide" ? "leader_review" : "",
    input.kind === "small_group_questions" ? "small_group" : ""
  ].filter(Boolean);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "sermon-prep-resource";
}
