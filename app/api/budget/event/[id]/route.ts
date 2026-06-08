import { NextResponse } from "next/server";
import { getBudget } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(getBudget(params.id));
}
