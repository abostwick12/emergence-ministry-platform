import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import type { PersonalIntegration } from "@/lib/command-center/types";
import { buildSageTools, CREATE_GMAIL_DRAFT_TOOL_NAME, executeSageToolCall } from "@/lib/command-center/sage-tools";

const getIntegration = vi.fn();
const getValidGmailAccessToken = vi.fn();
const createGmailDraft = vi.fn();
const stageGmailDraftForReview = vi.fn();

vi.mock("@/lib/command-center/repository", () => ({
  getIntegration: (...args: unknown[]) => getIntegration(...args)
}));
vi.mock("@/lib/command-center/integrations/gmail-token", () => ({
  getValidGmailAccessToken: (...args: unknown[]) => getValidGmailAccessToken(...args)
}));
vi.mock("@/lib/command-center/integrations/gmail", () => ({
  createGmailDraft: (...args: unknown[]) => createGmailDraft(...args),
  stageGmailDraftForReview: (...args: unknown[]) => stageGmailDraftForReview(...args)
}));

function session(): AuthSession {
  return { isMock: true, user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" } };
}

function integration(service: PersonalIntegration["service"], status: PersonalIntegration["status"]): PersonalIntegration {
  return { id: "int_1", service, status, config: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSageTools", () => {
  it("offers no tools when Gmail is not connected", async () => {
    getIntegration.mockResolvedValue(integration("gmail", "disconnected"));
    expect(await buildSageTools(session())).toEqual([]);
  });

  it("offers create_gmail_draft when Gmail is connected", async () => {
    getIntegration.mockResolvedValue(integration("gmail", "connected"));
    const tools = await buildSageTools(session());
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe(CREATE_GMAIL_DRAFT_TOOL_NAME);
  });
});

describe("executeSageToolCall", () => {
  it("rejects an unknown tool name", async () => {
    const result = await executeSageToolCall(session(), { name: "unknown_tool", callId: "call_1", argumentsJson: "{}" });
    expect(result.outcome).toEqual({ ok: false, error: "Unknown tool: unknown_tool" });
    expect(createGmailDraft).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON arguments", async () => {
    const result = await executeSageToolCall(session(), {
      name: CREATE_GMAIL_DRAFT_TOOL_NAME,
      callId: "call_1",
      argumentsJson: "not json"
    });
    expect(result.outcome).toEqual({ ok: false, error: "Invalid tool arguments." });
  });

  it("rejects missing required fields", async () => {
    const result = await executeSageToolCall(session(), {
      name: CREATE_GMAIL_DRAFT_TOOL_NAME,
      callId: "call_1",
      argumentsJson: JSON.stringify({ to: "x@example.com" })
    });
    expect(result.outcome).toEqual({ ok: false, error: "to, subject, and body are required." });
    expect(createGmailDraft).not.toHaveBeenCalled();
  });

  it("creates and stages a draft on valid arguments", async () => {
    getValidGmailAccessToken.mockResolvedValue("at");
    createGmailDraft.mockResolvedValue({ draftId: "draft_1", messageId: "msg_1" });
    stageGmailDraftForReview.mockResolvedValue(undefined);

    const result = await executeSageToolCall(session(), {
      name: CREATE_GMAIL_DRAFT_TOOL_NAME,
      callId: "call_1",
      argumentsJson: JSON.stringify({ to: "mentor@example.com", subject: "Check-in", body: "Following up on our last call." })
    });

    expect(createGmailDraft).toHaveBeenCalledWith({
      accessToken: "at",
      to: "mentor@example.com",
      subject: "Check-in",
      body: "Following up on our last call."
    });
    expect(stageGmailDraftForReview).toHaveBeenCalledWith({ accessToken: "at", messageId: "msg_1" });
    expect(result.outcome).toEqual({ ok: true, draftId: "draft_1", to: "mentor@example.com", subject: "Check-in" });
    expect(JSON.parse(result.output)).toEqual(result.outcome);
  });

  it("returns a failure outcome (never throws) when the Gmail call fails", async () => {
    getValidGmailAccessToken.mockRejectedValue(new Error("Gmail connection expired."));

    const result = await executeSageToolCall(session(), {
      name: CREATE_GMAIL_DRAFT_TOOL_NAME,
      callId: "call_1",
      argumentsJson: JSON.stringify({ to: "mentor@example.com", subject: "Check-in", body: "Body text." })
    });

    expect(result.outcome).toEqual({ ok: false, error: "Gmail connection expired." });
  });
});
