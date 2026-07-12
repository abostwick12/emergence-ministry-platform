import { readFileSync } from "fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { isSupabaseConfiguredMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  isSupabaseConfiguredMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import {
  archiveStudentCuratedResource,
  createStudentCuratedResource,
  resetLocalStudentCuratedResourcesForTests,
  updateStudentCuratedResource
} from "@/lib/scripture/curated-resources";
import { matchCuratedResourcesToPrompt } from "@/lib/scripture/curated-resource-shared";
import { buildStudentHomeFeed } from "@/lib/scripture/student-home";

describe("student curated resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(false);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
    resetLocalStudentCuratedResourcesForTests();
  });

  it("supports a local leader create, update, and archive cycle", async () => {
    const created = await createStudentCuratedResource(leaderSession(), {
      kind: "practice",
      title: "Walk the garden slowly",
      summary: "A student practice for garden questions.",
      body: "Take a quiet walk before reading Genesis 2-3.",
      scriptureReferences: "Genesis 2, Genesis 3",
      themes: "garden, trust",
      questionPatterns: "tree, eden",
      practicePrompt: "Name three gifts before the problem.",
      href: "/student/scripture/resources",
      sortOrder: "5",
      isActive: true
    });

    expect(created).toMatchObject({
      kind: "practice",
      title: "Walk the garden slowly",
      scriptureReferences: ["Genesis 2", "Genesis 3"],
      themes: ["garden", "trust"],
      isActive: true
    });

    const updated = await updateStudentCuratedResource(leaderSession(), created.id, {
      ...created,
      title: "Walk the garden with attention",
      summary: "A tighter student practice for garden questions.",
      body: "Read Genesis 2-3 after noticing creation.",
      scriptureReferences: created.scriptureReferences,
      themes: created.themes,
      questionPatterns: created.questionPatterns,
      sortOrder: created.sortOrder,
      isActive: false
    });
    expect(updated).toMatchObject({ title: "Walk the garden with attention", isActive: false });

    const archived = await archiveStudentCuratedResource(leaderSession(), created.id);
    expect(archived.isActive).toBe(false);
  });

  it("matches student questions to active resources without source metadata", async () => {
    const resource = await createStudentCuratedResource(leaderSession(), {
      kind: "guide",
      title: "Garden trust guide",
      summary: "Read Genesis by noticing gift before command.",
      body: "The student-facing help stays short and does not expose papers.",
      scriptureReferences: ["Genesis 2", "Genesis 3"],
      themes: ["garden", "trust"],
      questionPatterns: ["tree", "eden"],
      practicePrompt: "Ask what is already good before asking what went wrong.",
      href: "/student/scripture/resources",
      sortOrder: 1,
      isActive: true
    });

    const matches = matchCuratedResourcesToPrompt(
      {
        question: "Why did God put the tree in the garden?",
        scriptureReference: "Genesis 3",
        topicTags: ["creation"]
      },
      [resource]
    );

    expect(matches).toEqual([expect.objectContaining({ title: "Garden trust guide" })]);
    expect(matches[0]).not.toHaveProperty("sourceChunkId");
    expect(matches[0]).not.toHaveProperty("citation");
  });

  it("attaches curated resources to student journeys instead of exposing academic source slots", async () => {
    const curated = await createStudentCuratedResource(leaderSession(), {
      kind: "reading_tool",
      title: "Context before answer",
      summary: "Read around the passage before rushing to answer.",
      body: "Look at the paragraph before and after the passage.",
      scriptureReferences: ["Romans 8:18"],
      themes: ["context", "suffering"],
      questionPatterns: ["suffering", "pain"],
      practicePrompt: "Write one sentence about what is happening in the chapter.",
      href: "/student/scripture/how-to-read",
      sortOrder: 1,
      isActive: true
    });

    const feed = buildStudentHomeFeed(
      [
        {
          id: "question_romans",
          submittedByUserId: "usr_student",
          submittedByName: "Student User",
          submittedByEmail: "student@example.test",
          question: "How do I trust God when suffering feels pointless?",
          scriptureReference: "Romans 8:18",
          metanarrativeMovement: undefined,
          aiProvider: "gloo",
          aiStatus: "generated",
          aiModel: "",
          aiModelTier: "default",
          aiModelReason: "",
          aiConfidence: null,
          topicTags: ["suffering"],
          escalationReason: "",
          safetyLabel: "safe",
          safetyNotes: "",
          discussionPrompt: "",
          leaderNotes: "",
          status: "pending_review",
          knowledgeContext: [
            {
              id: "knowledge-romans-hope",
              sourceChunkId: "chunk_private",
              label: "Because you asked about suffering",
              title: "Private academic paper title",
              description: "Private source summary.",
              href: "/student/scripture/resources",
              digQuestions: [],
              topicTags: ["suffering"],
              scriptureReferences: ["Romans 8:18"]
            }
          ],
          deliveryStatus: "not_requested",
          deliveryMessage: "",
          createdAt: "2026-07-08T00:00:00.000Z",
          updatedAt: "2026-07-08T00:00:00.000Z"
        }
      ],
      "usr_student",
      [],
      {},
      [curated]
    );

    expect(feed.questionNextSteps[0].curatedResources).toEqual([expect.objectContaining({ title: "Context before answer" })]);
    expect(feed.questionNextSteps[0].curatedResources[0]).not.toHaveProperty("sourceChunkId");
  });

  it("creates a separate RLS-protected table from knowledge sources", () => {
    const migration = readFileSync("supabase/migrations/20260712120000_student_curated_resources.sql", "utf8");

    expect(migration).toContain("create table if not exists public.student_curated_resources");
    expect(migration).toContain("students can select active curated resources");
    expect(migration).toContain("leaders can manage student curated resources");
    expect(migration).not.toContain("references public.knowledge_sources");
    expect(migration).not.toContain("references public.knowledge_chunks");
  });
});

function leaderSession(): AuthSession {
  return {
    isMock: true,
    accessToken: undefined,
    user: {
      id: "usr_leader",
      email: "leader@example.test",
      fullName: "Leader User",
      role: "leader"
    }
  };
}
