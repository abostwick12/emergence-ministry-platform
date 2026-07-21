import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";

const fromCalls: string[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from(table: string) {
      fromCalls.push(table);
      if (table === "resource_attachments") return resourceAttachmentQuery();
      if (table === "profiles") return profileQuery();
      throw new Error(`Unexpected table: ${table}`);
    }
  }))
}));

import { listResourceAttachments, resourceStorageReady } from "@/lib/resources/repository";

describe("guest live resource reads", () => {
  beforeEach(() => {
    fromCalls.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads public static resources for guests without requiring a profile", async () => {
    const guest = guestSession();

    await expect(
      listResourceAttachments(guest, {
        parentId: "what-is-the-bible",
        parentType: "how_to_read_lesson"
      })
    ).resolves.toMatchObject([
      {
        title: "Public overview handout",
        visibility: "public"
      }
    ]);

    expect(resourceStorageReady(guest)).toBe(true);
    expect(fromCalls).toEqual(["resource_attachments"]);
  });
});

function resourceAttachmentQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    is: vi.fn(() => query),
    returns: vi.fn(async () => ({
      data: [
        resourceRow({ title: "Public overview handout", visibility: "public" }),
        resourceRow({ id: "students-only", title: "Students only guide", visibility: "students" })
      ],
      error: null
    }))
  };
  return query;
}

function profileQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: null,
      error: { message: "Guests do not have profiles." }
    }))
  };
  return query;
}

function resourceRow(input: { id?: string; title: string; visibility: "public" | "students" }) {
  const now = "2026-07-20T00:00:00.000Z";
  return {
    id: input.id ?? "public-overview",
    organization_id: DEFAULT_MINISTRY_ID,
    parent_type: "how_to_read_lesson",
    parent_id: "what-is-the-bible",
    title: input.title,
    description: "",
    resource_type: "external_link",
    storage_bucket: "resource-attachments",
    storage_path: null,
    external_url: "https://example.com/resource",
    original_filename: null,
    mime_type: null,
    file_size_bytes: null,
    display_order: 0,
    visibility: input.visibility,
    is_featured: false,
    is_downloadable: true,
    opens_in_new_tab: true,
    uploaded_by: "admin-user",
    created_at: now,
    updated_at: now,
    archived_at: null
  };
}

function guestSession(): AuthSession {
  return {
    isGuest: true,
    isMock: false,
    guestSessionId: "guest-session",
    user: {
      email: "guest@lead-emergence.local",
      fullName: "Guest",
      id: "guest_guest-session",
      role: "guest"
    }
  };
}
