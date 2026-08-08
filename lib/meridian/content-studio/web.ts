import type { AuthSession } from "@/lib/auth/server";
import { previewInterviewPlaybook } from "@/lib/meridian/content-studio/interview";
import { SupabaseContentStudioRepository } from "@/lib/meridian/content-studio/repository";
import { ContentStudioService } from "@/lib/meridian/content-studio/service";
import type { ContentGuideData, ContentStudioWorkspace } from "@/lib/meridian/content-studio/types";
import { SupabaseMeridianMcpRepository } from "@/lib/meridian/mcp/repository";

export function createContentStudioService() {
  return new ContentStudioService(
    new SupabaseMeridianMcpRepository(),
    new SupabaseContentStudioRepository()
  );
}

export async function loadContentStudioWorkspace(session: AuthSession): Promise<ContentStudioWorkspace> {
  if (session.isMock) return previewContentStudioWorkspace();
  return createContentStudioService().getWorkspace(session);
}

export function previewContentStudioWorkspace(): ContentStudioWorkspace {
  const ministryId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000002";
  const sessionId = "00000000-0000-4000-8000-000000000003";
  const voiceActiveId = "00000000-0000-4000-8000-000000000010";
  const voiceRetiredId = "00000000-0000-4000-8000-000000000011";
  const visualId = "00000000-0000-4000-8000-000000000012";
  const instagramGuideId = "00000000-0000-4000-8000-000000000013";
  const slideGuideId = "00000000-0000-4000-8000-000000000014";
  const interviewerId = "00000000-0000-4000-8000-000000000015";
  const linkedInGuideId = "00000000-0000-4000-8000-000000000016";
  const instagramDraftId = "00000000-0000-4000-8000-000000000020";
  const slideDraftId = "00000000-0000-4000-8000-000000000021";
  const linkedInDraftId = "00000000-0000-4000-8000-000000000022";

  return {
    accessLevel: "admin",
    source: "preview",
    sessions: [{
      id: sessionId,
      ministryId,
      createdByUserId: userId,
      topic: "Students at MOTION Conference",
      contentType: "conference recap",
      platforms: ["instagram", "church_slide", "linkedin"],
      interviewMode: "guided",
      status: "drafted",
      questionCount: 6,
      maxQuestions: 6,
      coveredDimensions: ["audience", "hope", "formation", "evidence", "invitation"],
      transcript: [],
      currentQuestion: null,
      guideVersionIds: [voiceActiveId, visualId, instagramGuideId, slideGuideId, interviewerId],
      createdAt: "2026-08-08T14:30:00.000Z",
      updatedAt: "2026-08-08T15:05:00.000Z"
    }],
    drafts: [
      {
        id: instagramDraftId,
        ministryId,
        sessionId,
        createdByUserId: userId,
        platform: "instagram",
        bodyMarkdown: "A generation in motion.\n\nAt MOTION Conference, the energy and faith our students worshiped with was truly moving. Not because one emotional moment proves transformation—but because we saw a faith community ready to be united in worship and set loose to follow Jesus.\n\nStudents: keep putting your faith in motion. Adults: help them love Scripture, stay rooted in community, and follow Jesus in everyday life. Revival may be closer than we think—and discipleship helps us walk faithfully toward it.",
        design: {
          aspectRatio: "9:16",
          overlayText: "A GENERATION IN MOTION",
          visualDirection: "Vertical reel. Cut on musical movement; reveal five short text beats across the full video with kinetic scale and position changes. Keep faces unobstructed and use no text boxes.",
          accessibilityText: "Students worshiping together at MOTION Conference as short hopeful phrases animate across the vertical video."
        },
        status: "draft",
        voiceGuideVersionId: voiceActiveId,
        visualGuideVersionId: visualId,
        platformGuideVersionId: linkedInGuideId,
        contentHash: "preview-instagram",
        createdAt: "2026-08-08T15:03:00.000Z"
      },
      {
        id: slideDraftId,
        ministryId,
        sessionId,
        createdByUserId: userId,
        platform: "church_slide",
        bodyMarkdown: "A GENERATION IN MOTION\n\nROOTED IN SCRIPTURE.\nUNITED IN WORSHIP.\nFAITH IN EVERYDAY LIFE.",
        design: {
          aspectRatio: "16:9",
          overlayText: "A GENERATION IN MOTION",
          visualDirection: "One room-readable statement over a wide worship image. High contrast, generous safe margins, no caption language, and no more than four short lines.",
          accessibilityText: "Wide church screen slide showing students worshiping with the headline A Generation in Motion."
        },
        status: "draft",
        voiceGuideVersionId: voiceActiveId,
        visualGuideVersionId: visualId,
        platformGuideVersionId: slideGuideId,
        contentHash: "preview-slide",
        createdAt: "2026-08-08T15:04:00.000Z"
      },
      {
        id: linkedInDraftId,
        ministryId,
        sessionId,
        createdByUserId: userId,
        platform: "linkedin",
        bodyMarkdown: "What if the next generation is not disconnected—but waiting for a faith community willing to unite, worship, and practice the way of Jesus together?\n\nMOTION Conference gave our adults a hopeful picture of the passion already present in our students. The long work now is discipleship: teaching students to love Scripture, rooting them in community, and helping them put faith into motion in ordinary life.",
        design: {
          aspectRatio: "1:1",
          overlayText: "HOPE FOR THE NEXT GENERATION",
          visualDirection: "Editorial still with restrained typography and room for a thoughtful professional caption.",
          accessibilityText: "Students gathered in worship at MOTION Conference."
        },
        status: "draft",
        voiceGuideVersionId: voiceActiveId,
        visualGuideVersionId: visualId,
        platformGuideVersionId: instagramGuideId,
        contentHash: "preview-linkedin",
        createdAt: "2026-08-08T15:05:00.000Z"
      }
    ],
    feedback: [
      feedback("00000000-0000-4000-8000-000000000030", instagramDraftId, "positive", "Keep the hopeful framing and the distinction between a moving moment and long-term transformation.", "voice"),
      feedback("00000000-0000-4000-8000-000000000031", slideDraftId, "correction", "Keep church slides readable from the back of the room with fewer words.", "platform", "church_slide"),
      feedback("00000000-0000-4000-8000-000000000032", linkedInDraftId, "positive", "The adults-as-guides framing is strong and should stay.", "voice")
    ],
    batches: [{
      id: "00000000-0000-4000-8000-000000000040",
      ministryId,
      status: "pending",
      feedbackIds: [
        "00000000-0000-4000-8000-000000000030",
        "00000000-0000-4000-8000-000000000031",
        "00000000-0000-4000-8000-000000000032"
      ],
      changes: [{
        sourceGuideVersionId: voiceActiveId,
        proposedBodyMarkdown: "Use hope without hype. Separate emotional intensity from evidence of spiritual formation. Connect moments of worship to Scripture, community, and everyday obedience.",
        proposedGuideData: { antiSlop: true },
        changeSummary: "Strengthen the hope-without-hype rule from three reviewed drafts."
      }],
      resultingGuideVersionIds: [],
      createdAt: "2026-08-08T16:00:00.000Z",
      approvedAt: null
    }],
    guides: [
      guide(voiceActiveId, "voice", null, 2, "Ministry Voice & Anti-Slop Guide", "active", voiceRetiredId, "Clarified hope without hype and everyday discipleship language."),
      guide(voiceRetiredId, "voice", null, 1, "Ministry Voice & Anti-Slop Guide", "retired", null, "Initial approved voice guide."),
      guide(visualId, "visual", null, 1, "Lead Emergence Visual Guide", "active", null, "Initial visual system."),
      guide(instagramGuideId, "platform", "instagram", 1, "Instagram Design Guide", "active", null, "Vertical reel and feed-specific direction."),
      guide(slideGuideId, "platform", "church_slide", 1, "Church Slide Design Guide", "active", null, "Room-distance readability rules."),
      guide(linkedInGuideId, "platform", "linkedin", 1, "LinkedIn Design Guide", "active", null, "Professional reflection and editorial visual direction."),
      guide(interviewerId, "interviewer", null, 1, "Dynamic Content Interviewer", "active", null, "Adaptive six-answer interview playbook.", previewInterviewPlaybook)
    ]
  };

  function feedback(
    id: string,
    draftId: string,
    sentiment: "positive" | "correction",
    feedbackText: string,
    guideTarget: "voice" | "visual" | "platform",
    targetPlatform: "church_slide" | null = null
  ) {
    return { id, ministryId, draftId, createdByUserId: userId, sentiment, feedbackText, guideTarget, targetPlatform, batchId: "00000000-0000-4000-8000-000000000040", createdAt: "2026-08-08T15:30:00.000Z" };
  }

  function guide(
    id: string,
    kind: "voice" | "visual" | "platform" | "interviewer",
    platform: "instagram" | "church_slide" | "linkedin" | null,
    version: number,
    title: string,
    status: "active" | "retired",
    parentVersionId: string | null,
    changeSummary: string,
    guideData: ContentGuideData = {}
  ) {
    return { id, ministryId, kind, platform, version, title, bodyMarkdown: changeSummary, guideData, status, parentVersionId, changeSummary, createdAt: "2026-08-08T13:00:00.000Z", activatedAt: "2026-08-08T13:00:00.000Z" };
  }
}
