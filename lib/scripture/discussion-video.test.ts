import { describe, expect, it } from "vitest";

import { buildDiscussionVideoScript, formatDiscussionVideoScriptForCopy } from "@/lib/scripture/discussion-video";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

describe("discussion video script builder", () => {
  it("builds a Remotion-ready script from a leader-approved discussion prompt", () => {
    const script = buildDiscussionVideoScript(
      prompt({
        id: "prompt_tree",
        question: "Why did God put the tree of knowledge of good and evil in the garden?",
        scriptureReference: "Genesis 3",
        discussionPrompt: "What does the garden story show about God's gifts, human trust, and God's pursuit after failure?",
        status: "approved",
        topicTags: ["garden"]
      })
    );

    expect(script).toMatchObject({
      compositionId: "LeaderDiscussionVideo",
      promptId: "prompt_tree",
      status: "ready_for_review",
      remotion: {
        fps: 30,
        width: 1080,
        height: 1920
      }
    });
    expect(script.scenes.map((scene) => scene.kind)).toEqual(["title", "scripture", "question", "reflect", "pray", "next_step"]);
    expect(script.scenes[1]).toMatchObject({
      eyebrow: "Open Scripture",
      headline: "Genesis 3"
    });
    expect(script.scenes.at(-1)?.headline).toContain("garden story");
    expect(script.guardrails).toContain("Do not include student names, emails, private notes, or care-sensitive details in the video.");
  });

  it("marks unapproved prompts as needing leader approval before rendering", () => {
    const script = buildDiscussionVideoScript(
      prompt({
        status: "pending_review",
        discussionPrompt: ""
      })
    );

    expect(script.status).toBe("needs_leader_approval");
    expect(script.guardrails[0]).toBe("Leader review is required before rendering or sharing.");
  });

  it("adds care guardrails without exposing student identity or private notes", () => {
    const source = prompt({
      submittedByName: "Jordan Student",
      submittedByEmail: "jordan@example.test",
      question: "How can I pray when grief and anxiety make everything feel heavy?",
      safetyLabel: "needs_leader_care",
      escalationReason: "suffering"
    });
    const script = buildDiscussionVideoScript(source);
    const copy = formatDiscussionVideoScriptForCopy(script);

    expect(script.guardrails).toContain("Frame this topic slowly and invite direct leader follow-up where needed.");
    expect(copy).toContain("Guardrails:");
    expect(copy).toContain("Scenes:");
    expect(copy).not.toContain("Jordan Student");
    expect(copy).not.toContain("jordan@example.test");
  });
});

function prompt(overrides: Partial<StudentDiscussionPrompt> = {}): StudentDiscussionPrompt {
  return {
    id: "prompt_1",
    submittedByUserId: "usr_student",
    submittedByName: "Student User",
    submittedByEmail: "student@example.test",
    question: "How do I trust God?",
    scriptureReference: "Psalm 13",
    metanarrativeMovement: "Wisdom",
    aiProvider: "gloo",
    aiStatus: "generated",
    aiModel: "GPT-5 Nano",
    aiModelTier: "default",
    aiModelReason: "",
    aiConfidence: 0.82,
    topicTags: ["trust"],
    escalationReason: "",
    safetyLabel: "safe",
    safetyNotes: "",
    discussionPrompt: "Where does Psalm 13 give us language for honest trust?",
    leaderNotes: "",
    status: "approved",
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}
