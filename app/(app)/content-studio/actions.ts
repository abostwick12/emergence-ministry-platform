"use server";

import { revalidatePath } from "next/cache";

import { getServerSession } from "@/lib/auth/server";
import { createContentStudioService } from "@/lib/meridian/content-studio/web";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export type ContentStudioActionResult = { ok: boolean; message: string };

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
