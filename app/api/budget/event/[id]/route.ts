import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getBudget } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  return NextResponse.json(getBudget(params.id));
}
