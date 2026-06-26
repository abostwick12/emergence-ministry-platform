import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { addExpense } from "@/lib/store";

export async function POST(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();

  if (!body.eventId || !body.categoryId || !body.amount || !body.description) {
    return NextResponse.json({ error: "eventId, categoryId, amount, and description are required" }, { status: 400 });
  }

  return NextResponse.json(addExpense(body), { status: 201 });
}
