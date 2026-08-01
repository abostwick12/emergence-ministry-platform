import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { competitionGuestQuestions } from "@/lib/guest/competition-demo-content";
import {
  decideLocalStudentDiscussionPrompt,
  listLocalApprovedStudentDiscussionPrompts,
  listLocalStudentDiscussionPrompts,
  resetLocalStudentStateForTests,
  saveLocalStudentDiscussionPrompt,
  saveLocalStudentQuestionReflection
} from "@/lib/scripture/student-local-state";

describe("local student state", () => {
  beforeEach(() => {
    resetLocalStudentStateForTests();
  });

  it("summarizes reflected prompts without exposing private notes", () => {
    const prompt = saveLocalStudentDiscussionPrompt(session(), {
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3",
      metanarrativeMovement: "Fall",
      draft: {
        discussionPrompt: "What does Genesis 3 show about trust, failure, and God's pursuit?",
        escalationReason: "",
        safetyLabel: "safe",
        safetyNotes: "Ready for leader review.",
        topicTags: ["garden"]
      },
      knowledgeContext: []
    });

    saveLocalStudentQuestionReflection(session(), {
      promptId: prompt.id,
      reflected: true,
      privateNote: "This is the student's private journal thought."
    });

    const prompts = listLocalStudentDiscussionPrompts(session());

    expect(prompts[0]).toMatchObject({
      id: prompt.id,
      studentReflectionCount: 1
    });
    expect(prompts[0]?.studentLastReflectedAt).toEqual(expect.any(String));
    expect(JSON.stringify(prompts[0])).not.toContain("private journal thought");
    expect(JSON.stringify(prompts[0])).not.toContain("privateNote");
  });

  it("supports the local leader approve, share, discussed, and follow-up cycle", () => {
    const prompt = saveLocalStudentDiscussionPrompt(session(), {
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3",
      metanarrativeMovement: "Fall",
      draft: {
        discussionPrompt: "What does Genesis 3 show about trust, failure, and God's pursuit?",
        escalationReason: "",
        safetyLabel: "safe",
        safetyNotes: "Ready for leader review.",
        topicTags: ["garden"]
      },
      knowledgeContext: []
    });

    const approved = decideLocalStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "approve",
      leaderNotes: "Use this for Wednesday.",
      discussionPrompt: "Where does Genesis 3 show trust breaking and God still pursuing?"
    });
    expect(approved).toMatchObject({
      status: "approved",
      approvedByUserId: "usr_leader",
      leaderNotes: "Use this for Wednesday."
    });
    expect(listLocalApprovedStudentDiscussionPrompts(session())).toEqual([
      expect.objectContaining({
        id: prompt.id,
        discussionPrompt: "Where does Genesis 3 show trust breaking and God still pursuing?",
        status: "approved"
      })
    ]);

    const discussed = decideLocalStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "mark_discussed",
      leaderNotes: "Discussed with group.",
      discussionPrompt: approved.discussionPrompt
    });
    expect(discussed.leaderDiscussedAt).toEqual(expect.any(String));

    const flagged = decideLocalStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "flag_follow_up",
      leaderNotes: "Check in with the student next week.",
      discussionPrompt: approved.discussionPrompt
    });
    expect(flagged).toMatchObject({
      leaderFollowUpFlaggedAt: expect.any(String),
      leaderFollowUpFlagCount: 1
    });

    const shared = decideLocalStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "post",
      leaderNotes: flagged.leaderNotes,
      discussionPrompt: approved.discussionPrompt
    });
    expect(shared).toMatchObject({
      status: "posted",
      deliveryChannel: "Local preview",
      deliveryStatus: "not_configured",
      deliveryMessage: "Local preview only. No Slack message was sent."
    });
  });

  it("isolates saved discussion drafts between guest sessions", () => {
    const prompt = saveLocalStudentDiscussionPrompt(guestSession("guest-one"), {
      question: "What should our group notice?",
      scriptureReference: "Luke 15",
      metanarrativeMovement: "Jesus / Kingdom Fulfilled",
      draft: {
        discussionPrompt: "What does Jesus reveal about welcome?",
        escalationReason: "",
        safetyLabel: "safe",
        safetyNotes: "Leader review required.",
        topicTags: ["welcome"]
      },
      knowledgeContext: []
    });

    expect(prompt.aiProvider).toBe("guest-stock-responses");
    const guestOnePrompts = listLocalStudentDiscussionPrompts(guestSession("guest-one"));
    expect(guestOnePrompts).toHaveLength(competitionGuestQuestions.length + 1);
    expect(guestOnePrompts.map((item) => item.id)).toEqual(expect.arrayContaining([prompt.id, ...competitionGuestQuestions.map((item) => item.id)]));
    expect(listLocalStudentDiscussionPrompts(guestSession("guest-two"))).toHaveLength(competitionGuestQuestions.length);

    resetLocalStudentStateForTests();
    expect(listLocalStudentDiscussionPrompts(guestSession("guest-one")).map((item) => item.id)).toEqual(
      [...competitionGuestQuestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => item.id)
    );
  });
});

function session(): AuthSession {
  return {
    isMock: true,
    accessToken: "",
    user: {
      id: "usr_student",
      email: "student@example.test",
      fullName: "Student User",
      role: "student"
    }
  };
}

function leaderSession(): AuthSession {
  return {
    isMock: true,
    accessToken: "",
    user: {
      id: "usr_leader",
      email: "leader@example.test",
      fullName: "Leader User",
      role: "leader"
    }
  };
}

function guestSession(guestSessionId: string): AuthSession {
  return {
    isGuest: true,
    isMock: false,
    guestSessionId,
    user: {
      id: `guest_${guestSessionId}`,
      email: "guest@lead-emergence.local",
      fullName: "Guest",
      role: "guest"
    }
  };
}
