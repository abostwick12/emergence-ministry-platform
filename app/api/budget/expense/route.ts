import { NextResponse } from "next/server";
import { addExpense } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.eventId || !body.categoryId || !body.amount || !body.description) {
    return NextResponse.json({ error: "eventId, categoryId, amount, and description are required" }, { status: 400 });
  }

  return NextResponse.json(addExpense(body), { status: 201 });
}
