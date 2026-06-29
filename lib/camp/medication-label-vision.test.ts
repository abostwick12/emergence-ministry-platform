import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMedicationLabelScanJson, scanMedicationLabelFrame } from "@/lib/camp/medication-label-vision";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Camp medication label vision extraction", () => {
  it("returns unavailable without server-side Azure or OpenAI configuration", async () => {
    const result = await scanMedicationLabelFrame({ dataUrl: "data:image/jpeg;base64,ZmFrZQ==" });

    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("sends a transient image data URL through the direct OpenAI-compatible vision path", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
      model: "gpt-4o-mini",
      choices: [
        {
          message: {
            content: JSON.stringify({
              studentNameOnLabel: "Riley Brooks",
              medicationName: "Morning Tablet",
              dose: "5 mg",
              directions: "Take one tablet by mouth every morning.",
              suggestedTimes: ["Morning"],
              quantityReceived: "10 tablets",
              instructions: "Original label text only.",
              rawText: "Riley Brooks Morning Tablet 5 mg",
              confidence: "medium",
              warnings: ["Verify quantity against bottle."]
            })
          }
        }
      ]
    }));

    const result = await scanMedicationLabelFrame({
      dataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      fetchImpl: fetchMock as unknown as typeof fetch
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      model?: string;
      messages: Array<{ role: string; content: unknown }>;
    };

    expect(result).toMatchObject({
      ok: true,
      provider: "openai",
      scan: {
        medicationName: "Morning Tablet",
        dose: "5 mg",
        suggestedTimes: ["Morning"],
        confidence: "medium",
        warnings: ["Verify quantity against bottle."]
      }
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-openai-key" });
    expect(body.model).toBe("gpt-4o-mini");
    expect(JSON.stringify(body.messages)).toContain("data:image/jpeg;base64,ZmFrZQ==");
  });

  it("prefers configured Azure OpenAI deployment without sending a direct OpenAI model field", async () => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://camp-openai.example.azure.com/");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-azure-key");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "camp-vision");
    vi.stubEnv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
      model: "camp-vision",
      choices: [{ message: { content: JSON.stringify({ medicationName: "Label Med", confidence: "high", warnings: [] }) } }]
    }));

    const result = await scanMedicationLabelFrame({
      dataUrl: "data:image/png;base64,ZmFrZQ==",
      fetchImpl: fetchMock as unknown as typeof fetch
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as { model?: string };

    expect(result).toMatchObject({ ok: true, provider: "azure", scan: { medicationName: "Label Med", confidence: "high" } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://camp-openai.example.azure.com/openai/deployments/camp-vision/chat/completions?api-version=2024-08-01-preview");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ "api-key": "test-azure-key" });
    expect(body.model).toBeUndefined();
  });

  it("normalizes uncertain output without inventing missing fields", () => {
    const parsed = parseMedicationLabelScanJson(JSON.stringify({
      medicationName: "  Blurry Capsule  ",
      dose: "",
      suggestedTimes: ["  Morning  ", 42, ""],
      confidence: "maybe",
      warnings: []
    }));

    expect(parsed).toEqual({
      studentNameOnLabel: undefined,
      medicationName: "Blurry Capsule",
      dose: undefined,
      directions: undefined,
      suggestedTimes: ["Morning"],
      quantityReceived: undefined,
      instructions: undefined,
      rawText: undefined,
      confidence: "low",
      warnings: ["Low-confidence scan. Verify every field against the original bottle."]
    });
  });
});
