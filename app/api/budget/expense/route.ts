import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { addMinistryExpense } from "@/lib/data/ministry-repository";

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();

  if (!body.eventId || !body.categoryId || !body.amount || !body.description) {
    return NextResponse.json({ error: "eventId, categoryId, amount, and description are required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await addMinistryExpense(access.session, body), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Budget item could not be saved." },
      { status: 400 }
    );
  }
}
