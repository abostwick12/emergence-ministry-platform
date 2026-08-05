import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import {
  createResourceAttachment,
  createMcpTextResourceAttachment,
  getResourceAttachmentOpenUrl,
  listResourceAttachments,
  resetLocalResourceAttachmentsForTests
} from "@/lib/resources/repository";

describe("resource attachment repository", () => {
  beforeEach(() => {
    resetLocalResourceAttachmentsForTests();
  });

  it("creates and lists external links through the shared local fallback", async () => {
    const resource = await createResourceAttachment(session("admin"), {
      externalUrl: "https://drive.google.com/file/d/example",
      parentId: "what-is-the-bible",
      parentType: "how_to_read_lesson",
      title: "Guide handout",
      visibility: "students"
    });

    expect(resource.resourceType).toBe("google_drive");
    expect(resource.externalUrl).toContain("drive.google.com");

    const studentResources = await listResourceAttachments(session("student"), {
      parentId: "what-is-the-bible",
      parentType: "how_to_read_lesson"
    });
    const parentResources = await listResourceAttachments(session("parent"), {
      parentId: "what-is-the-bible",
      parentType: "how_to_read_lesson"
    });

    expect(studentResources).toHaveLength(1);
    expect(parentResources).toHaveLength(0);
  });

  it("returns external resource URLs only when the reader is allowed", async () => {
    const resource = await createResourceAttachment(session("admin"), {
      externalUrl: "https://youtube.com/watch?v=abc123",
      parentId: "overview",
      parentType: "how_to_read_section",
      title: "Overview video",
      visibility: "public"
    });

    await expect(getResourceAttachmentOpenUrl(null, resource.id)).resolves.toMatchObject({
      url: expect.stringContaining("youtube.com")
    });
  });

  it("saves YouTube embeds only for YouTube URLs", async () => {
    const resource = await createResourceAttachment(session("admin"), {
      externalUrl: "https://youtu.be/7_CGP-12AE0",
      parentId: "group_8th_boys",
      parentType: "small_group_resource",
      resourceType: "youtube",
      title: "Leader prep video",
      visibility: "volunteer_leaders"
    });

    expect(resource.resourceType).toBe("youtube");
    expect(resource.externalUrl).toContain("youtu.be");

    await expect(
      createResourceAttachment(session("admin"), {
        externalUrl: "https://example.com/not-a-video",
        parentId: "group_8th_boys",
        parentType: "small_group_resource",
        resourceType: "youtube",
        title: "Wrong video"
      })
    ).rejects.toThrow("valid YouTube URL");
  });

  it("allows leaders to manage volunteer resources", async () => {
    const resource = await createResourceAttachment(session("leader"), {
      externalUrl: "https://youtube.com/watch?v=abc123",
      parentId: "quarterly-training-center",
      parentType: "volunteer_training",
      resourceType: "youtube",
      title: "Leader training video"
    });

    expect(resource.parentType).toBe("volunteer_training");
    expect(resource.resourceType).toBe("youtube");
  });

  it("blocks leader management of student-facing resources", async () => {
    await expect(
      createResourceAttachment(session("leader"), {
        externalUrl: "https://example.com",
        parentId: "overview",
        parentType: "how_to_read_section",
        title: "Leader link"
      })
    ).rejects.toThrow("permission to manage");
  });

  it("replays deterministic MCP text attachments without duplicating a draft", async () => {
    const attachmentId = "123e4567-e89b-42d3-a456-426614174000";
    const input = {
      attachmentId,
      parentId: "current-week",
      parentType: "weekly_leader_prep" as const,
      title: "Leader guide",
      bodyMarkdown: "# Leader guide\n\nA synthetic draft for review."
    };
    const first = await createMcpTextResourceAttachment(session("admin"), input);
    const replay = await createMcpTextResourceAttachment(session("admin"), input);
    const resources = await listResourceAttachments(session("admin"), {
      parentId: "current-week",
      parentType: "weekly_leader_prep"
    });
    expect(first.id).toBe(attachmentId);
    expect(replay.id).toBe(attachmentId);
    expect(resources.filter((resource) => resource.id === attachmentId)).toHaveLength(1);
    expect(first.visibility).toBe("volunteer_leaders");
  });
});

function session(role: string): AuthSession {
  return {
    isMock: true,
    user: {
      email: `${role}@example.test`,
      fullName: role,
      id: `user_${role}`,
      role
    }
  };
}
