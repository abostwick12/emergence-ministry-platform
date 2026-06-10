import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { listMinistryTasks } from "@/lib/data/ministry-repository";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  return NextResponse.json({ tasks: await listMinistryTasks(session) });
}
