import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { updateMinistryTask } from "@/lib/data/ministry-repository";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const task = await updateMinistryTask(session, params.id, body);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}
