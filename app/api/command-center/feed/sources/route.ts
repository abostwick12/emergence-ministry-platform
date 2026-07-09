import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { listKnowledgeSources } from "@/lib/command-center/repository";
import type { KnowledgeSourceStatus, KnowledgeSourceType } from "@/lib/command-center/types";

const SOURCE_TYPES = new Set<KnowledgeSourceType>(["article", "podcast", "video", "linkedin", "report"]);
const STATUSES = new Set<KnowledgeSourceStatus>(["new", "included", "skipped", "archived"]);

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const sourceTypeParam = url.searchParams.get("sourceType");
  const statusParam = url.searchParams.get("status");

  const sources = await listKnowledgeSources(access.session, {
    sourceType: sourceTypeParam && SOURCE_TYPES.has(sourceTypeParam as KnowledgeSourceType) ? (sourceTypeParam as KnowledgeSourceType) : undefined,
    status: statusParam && STATUSES.has(statusParam as KnowledgeSourceStatus) ? (statusParam as KnowledgeSourceStatus) : undefined
  });
  return NextResponse.json({ sources });
}
