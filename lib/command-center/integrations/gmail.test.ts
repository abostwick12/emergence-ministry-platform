import { describe, expect, it, vi } from "vitest";
import {
  buildGmailAuthUrl,
  createGmailDraft,
  createGmailLabel,
  exchangeGmailCode,
  findOrCreateGmailLabel,
  getGmailMessageBody,
  GMAIL_COMPOSE_SCOPE,
  GMAIL_DRAFT_REVIEW_LABEL_NAME,
  GmailConfigError,
  GMAIL_LABELS_SCOPE,
  GMAIL_READONLY_SCOPE,
  isGmailTokenExpired,
  listGmailLabels,
  listRecentGmailMessages,
  modifyGmailMessageLabels,
  moveGmailMessageToLabel,
  parseStoredGmailTokens,
  readGmailConfig,
  refreshGmailAccessToken,
  stageGmailDraftForReview,
  triageAndDraftImportantMessages
} from "@/lib/command-center/integrations/gmail";

const configuredEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/command-center/integrations/gmail/callback"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("readGmailConfig", () => {
  it("reports not configured with the specific missing env vars", () => {
    const config = readGmailConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);
  });

  it("reports configured when all three shared Google OAuth env vars are present", () => {
    const config = readGmailConfig(configuredEnv);
    expect(config.configured).toBe(true);
    expect(config.missing).toEqual([]);
  });
});

describe("buildGmailAuthUrl", () => {
  it("throws GmailConfigError when not configured", () => {
    expect(() => buildGmailAuthUrl({ state: "abc", env: {} })).toThrow(GmailConfigError);
  });

  it("requests readonly, compose, and labels scopes, never a send-only scope", () => {
    const url = new URL(buildGmailAuthUrl({ state: "csrf-state", env: configuredEnv }));
    const scope = url.searchParams.get("scope");
    expect(scope).toContain(GMAIL_READONLY_SCOPE);
    expect(scope).toContain(GMAIL_COMPOSE_SCOPE);
    expect(scope).toContain(GMAIL_LABELS_SCOPE);
    expect(scope).not.toContain("gmail.send");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("exchangeGmailCode", () => {
  it("throws GmailConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeGmailCode({ code: "abc", env: {}, fetchImpl })).rejects.toThrow(GmailConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GMAIL_READONLY_SCOPE })
    );
    const tokens = await exchangeGmailCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
  });
});

describe("refreshGmailAccessToken", () => {
  it("refreshes an access token using the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const refreshed = await refreshGmailAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(refreshed.accessToken).toBe("new-at");
  });
});

describe("isGmailTokenExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isGmailTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a comfortably future expiry as not expired", () => {
    expect(isGmailTokenExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe("parseStoredGmailTokens", () => {
  it("returns null for malformed or partial stored config", () => {
    expect(parseStoredGmailTokens({})).toBeNull();
    expect(parseStoredGmailTokens({ accessToken: "at" })).toBeNull();
  });

  it("parses a well-formed stored token record", () => {
    const parsed = parseStoredGmailTokens({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
    expect(parsed).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
  });
});

describe("listRecentGmailMessages", () => {
  it("fetches only metadata headers and the snippet, never the full message body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "msg_1", threadId: "thread_1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "msg_1",
          threadId: "thread_1",
          snippet: "Quick check-in about the fellowship reflection...",
          labelIds: ["INBOX", "UNREAD"],
          payload: {
            headers: [
              { name: "Subject", value: "Fellowship reflection reminder" },
              { name: "From", value: "mentor@example.com" },
              { name: "Date", value: "Mon, 6 Jul 2026 10:00:00 -0500" }
            ]
          }
        })
      );

    const messages = await listRecentGmailMessages({ accessToken: "at", fetchImpl });
    expect(messages).toEqual([
      {
        id: "msg_1",
        threadId: "thread_1",
        subject: "Fellowship reflection reminder",
        from: "mentor@example.com",
        date: "Mon, 6 Jul 2026 10:00:00 -0500",
        snippet: "Quick check-in about the fellowship reflection...",
        labelIds: ["INBOX", "UNREAD"]
      }
    ]);

    const metadataCall = fetchImpl.mock.calls[1][0] as string;
    expect(metadataCall).toContain("format=metadata");
    expect(metadataCall).not.toContain("format=full");
  });

  it("throws when the list request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listRecentGmailMessages({ accessToken: "expired", fetchImpl })).rejects.toThrow("Gmail message list fetch failed");
  });
});

describe("createGmailDraft", () => {
  it("creates a draft via the drafts endpoint and never calls a send endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "draft_1", message: { id: "msg_draft_1" } }));
    const result = await createGmailDraft({
      accessToken: "at",
      to: "mentor@example.com",
      subject: "Re: Fellowship reflection",
      body: "Thanks for the reminder, here is my draft outline.",
      fetchImpl
    });

    expect(result).toEqual({ draftId: "draft_1", messageId: "msg_draft_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/drafts");
    expect(calledUrl).not.toContain("/send");
    expect(init.method).toBe("POST");
  });

  it("throws when draft creation fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 400));
    await expect(
      createGmailDraft({ accessToken: "at", to: "a@example.com", subject: "s", body: "b", fetchImpl })
    ).rejects.toThrow("Gmail draft creation failed");
  });
});

describe("listGmailLabels", () => {
  it("lists labels", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ labels: [{ id: "Label_1", name: "SAGE/Draft Review", type: "user" }, { id: "INBOX", name: "INBOX", type: "system" }] })
    );
    const labels = await listGmailLabels({ accessToken: "at", fetchImpl });
    expect(labels).toEqual([
      { id: "Label_1", name: "SAGE/Draft Review", type: "user" },
      { id: "INBOX", name: "INBOX", type: "system" }
    ]);
  });

  it("throws when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listGmailLabels({ accessToken: "at", fetchImpl })).rejects.toThrow("Gmail labels list failed");
  });
});

describe("createGmailLabel", () => {
  it("creates a visible user label", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "Label_2", name: "Job Search", type: "user" }));
    const label = await createGmailLabel({ accessToken: "at", name: "Job Search", fetchImpl });
    expect(label).toEqual({ id: "Label_2", name: "Job Search", type: "user" });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: "Job Search", labelListVisibility: "labelShow", messageListVisibility: "show" });
  });
});

describe("findOrCreateGmailLabel", () => {
  it("returns an existing label by case-insensitive name instead of creating a duplicate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ labels: [{ id: "Label_3", name: "Job Search", type: "user" }] }));
    const label = await findOrCreateGmailLabel({ accessToken: "at", name: "job search", fetchImpl });
    expect(label).toEqual({ id: "Label_3", name: "Job Search", type: "user" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("creates the label when no existing label matches", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ labels: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "Label_4", name: "New Folder", type: "user" }));
    const label = await findOrCreateGmailLabel({ accessToken: "at", name: "New Folder", fetchImpl });
    expect(label).toEqual({ id: "Label_4", name: "New Folder", type: "user" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("modifyGmailMessageLabels", () => {
  it("posts add/remove label ids to the modify endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    await modifyGmailMessageLabels({ accessToken: "at", messageId: "msg_1", addLabelIds: ["Label_1"], removeLabelIds: ["INBOX"], fetchImpl });
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/messages/msg_1/modify");
    expect(JSON.parse(init.body as string)).toEqual({ addLabelIds: ["Label_1"], removeLabelIds: ["INBOX"] });
  });

  it("throws when the modify request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 404));
    await expect(modifyGmailMessageLabels({ accessToken: "at", messageId: "msg_1", fetchImpl })).rejects.toThrow(
      "Gmail message label update failed"
    );
  });
});

describe("moveGmailMessageToLabel", () => {
  it("finds or creates the target label, then adds it and removes INBOX", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ labels: [{ id: "Label_5", name: "Job Search", type: "user" }] }))
      .mockResolvedValueOnce(jsonResponse({}));
    const label = await moveGmailMessageToLabel({ accessToken: "at", messageId: "msg_1", labelName: "Job Search", fetchImpl });
    expect(label.id).toBe("Label_5");
    const [modifyUrl, modifyInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(modifyUrl).toContain("/messages/msg_1/modify");
    expect(JSON.parse(modifyInit.body as string)).toEqual({ addLabelIds: ["Label_5"], removeLabelIds: ["INBOX"] });
  });
});

describe("stageGmailDraftForReview", () => {
  it("finds or creates the review label and adds it without removing INBOX", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ labels: [{ id: "Label_6", name: GMAIL_DRAFT_REVIEW_LABEL_NAME, type: "user" }] }))
      .mockResolvedValueOnce(jsonResponse({}));
    await stageGmailDraftForReview({ accessToken: "at", messageId: "draft_msg_1", fetchImpl });
    const [modifyUrl, modifyInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(modifyUrl).toContain("/messages/draft_msg_1/modify");
    expect(JSON.parse(modifyInit.body as string)).toEqual({ addLabelIds: ["Label_6"], removeLabelIds: [] });
  });
});

describe("getGmailMessageBody", () => {
  it("extracts the text/plain part from a multipart message", async () => {
    const plainText = "Hi Andrew, can we connect about the role next week?";
    const encoded = Buffer.from(plainText, "utf-8").toString("base64");
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "msg_2",
        threadId: "thread_2",
        snippet: "Hi Andrew, can we connect...",
        labelIds: ["INBOX"],
        payload: {
          mimeType: "multipart/alternative",
          headers: [
            { name: "Subject", value: "Following up on your application" },
            { name: "From", value: "recruiter@example.com" },
            { name: "Date", value: "Tue, 7 Jul 2026 09:00:00 -0500" }
          ],
          parts: [
            { mimeType: "text/plain", body: { data: encoded } },
            { mimeType: "text/html", body: { data: Buffer.from(`<p>${plainText}</p>`, "utf-8").toString("base64") } }
          ]
        }
      })
    );

    const detail = await getGmailMessageBody({ accessToken: "at", messageId: "msg_2", fetchImpl });
    expect(detail.body).toBe(plainText);
    expect(detail.subject).toBe("Following up on your application");
  });

  it("falls back to stripped text/html when no text/plain part exists", async () => {
    const html = "<p>Hello <b>Andrew</b>, quick update.</p>";
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "msg_3",
        threadId: "thread_3",
        payload: {
          mimeType: "text/html",
          headers: [],
          body: { data: Buffer.from(html, "utf-8").toString("base64") }
        }
      })
    );
    const detail = await getGmailMessageBody({ accessToken: "at", messageId: "msg_3", fetchImpl });
    expect(detail.body).toBe("Hello Andrew , quick update.");
  });

  it("throws when the read request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 404));
    await expect(getGmailMessageBody({ accessToken: "at", messageId: "missing", fetchImpl })).rejects.toThrow("Gmail message read failed");
  });
});

describe("triageAndDraftImportantMessages", () => {
  it("drafts and stages a reply only for messages SAGE judges important, and never sends", async () => {
    const listResponse = jsonResponse({ messages: [{ id: "msg_1", threadId: "thread_1" }, { id: "msg_2", threadId: "thread_2" }] });
    const meta1 = jsonResponse({ id: "msg_1", threadId: "thread_1", snippet: "s1", labelIds: ["INBOX"], payload: { headers: [{ name: "Subject", value: "Important ask" }, { name: "From", value: "vip@example.com" }] } });
    const meta2 = jsonResponse({ id: "msg_2", threadId: "thread_2", snippet: "s2", labelIds: ["INBOX"], payload: { headers: [{ name: "Subject", value: "Newsletter" }, { name: "From", value: "news@example.com" }] } });
    const full1 = jsonResponse({ id: "msg_1", threadId: "thread_1", labelIds: ["INBOX"], payload: { headers: [{ name: "Subject", value: "Important ask" }, { name: "From", value: "vip@example.com" }], mimeType: "text/plain", body: { data: Buffer.from("Can you call me today?", "utf-8").toString("base64") } } });
    const full2 = jsonResponse({ id: "msg_2", threadId: "thread_2", labelIds: ["INBOX"], payload: { headers: [{ name: "Subject", value: "Newsletter" }, { name: "From", value: "news@example.com" }], mimeType: "text/plain", body: { data: Buffer.from("This week's roundup...", "utf-8").toString("base64") } } });
    const draftResponse = jsonResponse({ id: "draft_9", message: { id: "msg_draft_9" } });
    const labelListResponse = jsonResponse({ labels: [{ id: "Label_review", name: GMAIL_DRAFT_REVIEW_LABEL_NAME, type: "user" }] });
    const modifyResponse = jsonResponse({});

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(listResponse)
      .mockResolvedValueOnce(meta1)
      .mockResolvedValueOnce(meta2)
      .mockResolvedValueOnce(full1)
      .mockResolvedValueOnce(draftResponse)
      .mockResolvedValueOnce(labelListResponse)
      .mockResolvedValueOnce(modifyResponse)
      .mockResolvedValueOnce(full2);

    const streamers = {
      openai: vi
        .fn()
        .mockResolvedValueOnce({
          provider: "openai" as const,
          modelLabel: "gpt-4o-mini",
          completed: true,
          content: "IMPORTANT: yes\nREASON: A VIP asked to call.\nDRAFT:\nHi, happy to call today, what time works?"
        })
        .mockResolvedValueOnce({
          provider: "openai" as const,
          modelLabel: "gpt-4o-mini",
          completed: true,
          content: "IMPORTANT: no\nREASON: Routine newsletter.\nDRAFT:\nNONE"
        }),
      azure: vi.fn()
    };

    const controller = new AbortController();
    const results = await triageAndDraftImportantMessages({
      accessToken: "at",
      maxMessages: 2,
      signal: controller.signal,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl,
      streamers
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ messageId: "msg_1", important: true, draftId: "draft_9" });
    expect(results[1]).toMatchObject({ messageId: "msg_2", important: false, draftId: undefined });

    // Never calls a send endpoint anywhere in the sequence of requests made.
    for (const call of fetchImpl.mock.calls) {
      expect(String(call[0])).not.toContain("/send");
    }
  });
});
