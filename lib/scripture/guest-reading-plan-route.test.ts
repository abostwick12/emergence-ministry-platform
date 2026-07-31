import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { generateMeridianReadingPlanDraftMock, getMeridianAiReadinessMock, getServerSessionMock } = vi.hoisted(() => ({
  generateMeridianReadingPlanDraftMock: vi.fn(),
  getMeridianAiReadinessMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

const originalGuestAi = process.env.GUEST_AI_GENERATION_ENABLED;

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/scripture/meridian-ai", () => ({
  generateMeridianReadingPlanDraft: generateMeridianReadingPlanDraftMock,
  getMeridianAiReadiness: getMeridianAiReadinessMock
}));

import { POST as readingPlanPOST } from "@/app/api/student/scripture/reading-plan/route";

describe("guest reading-plan generation", () => {
  beforeEach(() => {
    process.env.GUEST_AI_GENERATION_ENABLED = "false";
    getServerSessionMock.mockReset();
    generateMeridianReadingPlanDraftMock.mockReset();
    getMeridianAiReadinessMock.mockReset();
    getServerSessionMock.mockResolvedValue(guestSession());
    getMeridianAiReadinessMock.mockReturnValue({ configured: true, gloo: true });
  });

  afterEach(() => {
    process.env.GUEST_AI_GENERATION_ENABLED = originalGuestAi;
  });

  it("returns the labeled stock draft when live guest AI is disabled", async () => {
    const response = await readingPlanPOST(request());
    const payload = (await response.json()) as { draft: { model: string } };

    expect(response.status).toBe(201);
    expect(payload.draft.model).toBe("guest-stock-responses");
    expect(generateMeridianReadingPlanDraftMock).not.toHaveBeenCalled();
  });

  it("calls the configured Meridian provider chain when live guest AI is enabled", async () => {
    process.env.GUEST_AI_GENERATION_ENABLED = "true";
    generateMeridianReadingPlanDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "gloo-openai-gpt-5-nano",
      modelReason: "Gloo primary.",
      title: "Welcome in Luke 15",
      audience: "High school small group",
      duration: "5 days",
      primaryScripture: "Luke 15",
      movement: "Jesus / Kingdom Fulfilled",
      summary: "A leader-review draft.",
      contextFocus: "Read each parable in context.",
      weeklyRhythm: ["Read Luke 15."],
      discussionPrompts: ["What does Jesus reveal about welcome?"],
      guardrailNotes: ["Do not flatten the distinct parables."],
      prayerPrompt: "Jesus, teach us to receive your welcome.",
      safetyNotes: "Leader review required.",
      provenance: {}
    });

    const response = await readingPlanPOST(request());
    const payload = (await response.json()) as { draft: { provider: string; model: string } };

    expect(response.status).toBe(201);
    expect(payload.draft).toMatchObject({ provider: "gloo", model: "gloo-openai-gpt-5-nano" });
    expect(generateMeridianReadingPlanDraftMock).toHaveBeenCalledWith(expect.objectContaining({ primaryScripture: "Luke 15" }));
  });
});

function guestSession(): AuthSession {
  return {
    isGuest: true,
    isMock: false,
    guestSessionId: "guest-plan-test",
    user: {
      id: "guest_guest-plan-test",
      email: "guest@lead-emergence.local",
      fullName: "Guest",
      role: "guest"
    }
  };
}

function request() {
  return new Request("http://localhost/api/student/scripture/reading-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Welcome in Luke 15",
      audience: "High school small group",
      duration: "5 days",
      primaryScripture: "Luke 15",
      contextNotes: "Notice the three lost-and-found movements."
    })
  });
}
