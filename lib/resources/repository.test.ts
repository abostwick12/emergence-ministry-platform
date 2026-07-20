import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import {
  createResourceAttachment,
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

  it("blocks non-admin resource management", async () => {
    await expect(
      createResourceAttachment(session("leader"), {
        externalUrl: "https://example.com",
        parentId: "overview",
        parentType: "how_to_read_section",
        title: "Leader link"
      })
    ).rejects.toThrow("Only admins can manage resources.");
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
