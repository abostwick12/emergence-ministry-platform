import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import {
  OPENAI_RESPONSES_URL,
  buildSageResponsesPayload,
  getSageAvailability,
  getSageConfig,
  normalizeSageMessages,
  openAIEventStreamToTextStream
} from "@/lib/command-center/sage";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(getSageAvailability());
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const config = getSageConfig();
  if (!config) {
    return NextResponse.json(
      { error: "SAGE unavailable", code: "sage_unavailable" },
      { status: 503 }
    );
  }

  let body: { messages?: unknown } = {};
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const messages = normalizeSageMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "A user message is required" }, { status: 400 });
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildSageResponsesPayload(messages, config.model))
    });
  } catch {
    return NextResponse.json(
      { error: "SAGE provider request failed", code: "provider_unreachable" },
      { status: 502 }
    );
  }

  if (!providerResponse.ok || !providerResponse.body) {
    return NextResponse.json(
      {
        error: "SAGE provider request failed",
        code: "provider_error",
        status: providerResponse.status
      },
      { status: 502 }
    );
  }

  return new Response(openAIEventStreamToTextStream(providerResponse.body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
