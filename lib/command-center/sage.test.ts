import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAGE_MODEL,
  buildSageResponsesPayload,
  getSageAvailability,
  getSageConfig,
  normalizeSageMessages,
  openAIEventStreamToTextStream
} from "@/lib/command-center/sage";

describe("SAGE configuration", () => {
  it("is unavailable when OPENAI_API_KEY is missing", () => {
    expect(getSageConfig({})).toBeNull();
    expect(getSageAvailability({})).toEqual({ available: false, model: null });
  });

  it("uses OPENAI_MODEL when configured and falls back to the default model otherwise", () => {
    expect(getSageConfig({ OPENAI_API_KEY: "sk-test" })).toEqual({
      apiKey: "sk-test",
      model: DEFAULT_SAGE_MODEL
    });
    expect(getSageConfig({ OPENAI_API_KEY: " sk-test ", OPENAI_MODEL: " gpt-test " })).toEqual({
      apiKey: "sk-test",
      model: "gpt-test"
    });
  });
});

describe("SAGE message handling", () => {
  it("keeps only user and assistant messages", () => {
    expect(
      normalizeSageMessages([
        { role: "system", content: "ignore this" },
        { role: "user", content: "  help me prioritize " },
        { role: "assistant", content: "Sure." },
        { role: "tool", content: "ignore this too" },
        { role: "user", content: "" }
      ])
    ).toEqual([
      { role: "user", content: "help me prioritize" },
      { role: "assistant", content: "Sure." }
    ]);
  });

  it("builds a provider payload without tools, memory, or external integrations", () => {
    const payload = buildSageResponsesPayload([{ role: "user", content: "What should I do next?" }], "gpt-test");

    expect(payload).toMatchObject({
      model: "gpt-test",
      stream: true,
      input: [{ role: "user", content: "What should I do next?" }]
    });
    expect("tools" in payload).toBe(false);
    expect(payload.instructions).toContain("no memory and no function calling");
    expect(payload.instructions).toContain("Do not claim access to ministry, Camp, student, medical, pastoral");
  });
});

describe("OpenAI response stream parsing", () => {
  it("emits text deltas from Responses API SSE events", async () => {
    const encoder = new TextEncoder();
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":" Andrew"}\r\n\r\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    const reader = openAIEventStreamToTextStream(input).getReader();
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    expect(text).toBe("Hello Andrew");
  });
});
