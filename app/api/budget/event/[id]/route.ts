import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getBudget } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(getBudget(params.id));
}
