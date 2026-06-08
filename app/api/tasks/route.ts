import { NextResponse } from "next/server";
import { listTasks } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}
