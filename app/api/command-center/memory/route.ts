import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { createSageMemory, listSageMemory } from "@/lib/command-center/repository";
import type { PersonalDomain, SageMemoryType } from "@/lib/command-center/types";

const VALID_MEMORY_TYPES: SageMemoryType[] = ["fact", "preference", "context", "relationship"];
const VALID_DOMAINS: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const memories = await listSageMemory(access.session);
  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json()) as { memoryType?: string; content?: string; domain?: string };

  if (!body.memoryType || !VALID_MEMORY_TYPES.includes(body.memoryType as SageMemoryType)) {
    return NextResponse.json({ error: "Invalid or missing memoryType" }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (body.domain && !VALID_DOMAINS.includes(body.domain as PersonalDomain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const memory = await createSageMemory(access.session, {
    memoryType: body.memoryType as SageMemoryType,
    content: body.content.trim(),
    domain: body.domain as PersonalDomain | undefined
  });

  return NextResponse.json(memory, { status: 201 });
}
