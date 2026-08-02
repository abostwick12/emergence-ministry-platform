import { NextResponse } from "next/server";

import { getMeridianProtectedResourceMetadata } from "@/lib/meridian/mcp/oauth";

export function GET(request: Request) {
  return NextResponse.json(getMeridianProtectedResourceMetadata(request), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
