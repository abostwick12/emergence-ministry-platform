"use server";

import { revalidatePath } from "next/cache";

import { getServerSession } from "@/lib/auth/server";
import { createContentStudioService } from "@/lib/meridian/content-studio/web";
import type { ContentPlatform, ContentSession } from "@/lib/meridian/content-studio/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export type ContentStudioActionResult = { ok: boolean; message: string };
export type ContentStudioInterviewActionResult = ContentStudioActionResult & {
  brief?: Record<string, unknown>;
  readyToDraft?: boolean;
  session?: ContentSession;
};

export async function startContentInterviewAction(input: {
  contentType: string;
  platform: ContentPlatform;
  skipInterview: boolean;
  topic: string;
}): Promise<ContentStudioInterviewActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, message: "Sign in to use Content Studio." };
  if (!input.topic.trim()) return { ok: false, message: "Add a short brief before starting." };
  if (session.isMock) return { ok: false, message: "Preview interviews run in the browser only." };

  try {
    const result = await createContentStudioService().startSession(session, {
      contentType: input.contentType.trim() || "ministry content",
      platforms: [input.platform],
      skipInterview: input.skipInterview,
      topic: input.topic.trim()
    });
    revalidatePath("/content-studio");
    return {
      ok: true,
      message: input.skipInterview ? "Interview skipped. Your brief is ready for drafting." : "Meridian started a guided interview.",
      readyToDraft: result.session.status === "ready",
      session: result.session
    };
  } catch (error) {
    return interviewError(error);
  }
}

export async function continueContentInterviewAction(input: {
  answer: string;
  finishNow: boolean;
  sessionId: string;
}): Promise<ContentStudioInterviewActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, message: "Sign in to use Content Studio." };
  if (!input.answer.trim()) return { ok: false, message: "Add your answer before continuing." };
  if (session.isMock) return { ok: false, message: "Preview interviews run in the browser only." };

  try {
    const result = await createContentStudioService().continueInterview(session, {
      answer: input.answer.trim(),
      finishNow: input.finishNow,
      sessionId: input.sessionId
    });
    revalidatePath("/content-studio");
    return {
      brief: result.brief as Record<string, unknown> | undefined,
      message: result.readyToDraft ? "Interview complete. Your brief is ready for drafting." : "Answer saved. Meridian chose the next question from the active playbook.",
      ok: true,
      readyToDraft: result.readyToDraft,
      session: result.session
    };
  } catch (error) {
    return interviewError(error);
  }
}

export async function submitContentFeedbackAction(input: {
  draftId: string;
  feedbackText: string;
  guideTarget: "voice" | "visual" | "platform";
  sentiment: "positive" | "correction";
}): Promise<ContentStudioActionResult> {
  return runStudioAction(async (session) => {
    if (!input.feedbackText.trim()) return { ok: false, message: "Add the feedback you want Meridian to learn from." };
    if (session.isMock) return { ok: true, message: "Preview feedback logged. The active guide was not changed." };
    await createContentStudioService().submitFeedback(session, {
      draftId: input.draftId,
      feedbackText: input.feedbackText,
      guideTarget: input.guideTarget,
      sentiment: input.sentiment
    });
    revalidatePath("/content-studio");
    return { ok: true, message: "Feedback logged for batch review. The active guide was not changed." };
  });
}

export async function approveContentFeedbackBatchAction(batchId: string): Promise<ContentStudioActionResult> {
  return runStudioAction(async (session) => {
    if (session.isMock) return { ok: true, message: "Preview batch approved. Live guides were not changed." };
    await createContentStudioService().approveFeedbackBatch(session, batchId);
    revalidatePath("/content-studio");
    return { ok: true, message: "Batch approved. New guide versions are active and prior versions remain in history." };
  });
}

export async function rollbackContentGuideAction(input: { reason: string; targetVersionId: string }): Promise<ContentStudioActionResult> {
  return runStudioAction(async (session) => {
    if (!input.reason.trim()) return { ok: false, message: "Add a reason for this rollback." };
    if (session.isMock) return { ok: true, message: "Preview rollback complete. Live guides were not changed." };
    await createContentStudioService().rollbackGuide(session, input);
    revalidatePath("/content-studio");
    return { ok: true, message: "Rollback complete. Meridian created a new active version and preserved the full history." };
  });
}

async function runStudioAction(run: (session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>) => Promise<ContentStudioActionResult>) {
  const session = await getServerSession();
  if (!session) return { ok: false, message: "Sign in to use Content Studio." };
  try {
    return await run(session);
  } catch (error) {
    if (error instanceof MeridianMcpError) return { ok: false, message: error.message };
    return { ok: false, message: "Content Studio could not complete that action." };
  }
}

function interviewError(error: unknown): ContentStudioInterviewActionResult {
  if (error instanceof MeridianMcpError) return { ok: false, message: error.message };
  return { ok: false, message: "Meridian could not continue that interview. No draft or guide was changed." };
}
