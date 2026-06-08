import { NextResponse } from "next/server";
import { updateTask } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const task = updateTask(params.id, body);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}
