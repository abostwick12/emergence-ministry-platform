import { NextResponse } from "next/server";
import { listActivity } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ activity: listActivity() });
}
