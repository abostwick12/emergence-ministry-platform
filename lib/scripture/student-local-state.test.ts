import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import {
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
