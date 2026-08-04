import type { AuthSession } from "@/lib/auth/server";
import type { MeridianAuthorityClass, MeridianClaimKind } from "@/lib/meridian/knowledge/types";

export type MeridianMcpCapability =
  | "search"
  | "save_drafts"
  | "read_platform"
  | "manage_events"
  | "manage_tasks"
  | "save_resources";

export type MeridianMcpGrant = {
  ministryId: string;
  userId: string;
  accessLevel: "volunteer_creator" | "leader_creator" | "admin";
  canSearch: boolean;
  canSaveDrafts: boolean;
  canReadPlatform: boolean;
  canManageEvents: boolean;
  canManageTasks: boolean;
  canSaveResources: boolean;
};

export type MeridianMcpSearchResult = {
  id: string;
  title: string;
  url: string;
};

export type MeridianMcpFetchedItem = {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: {
    claimKind: MeridianClaimKind;
    authorityClass: MeridianAuthorityClass;
    attribution?: string;
    approvalStatus: "approved";
    quotePermission: "allowed" | "not_allowed";
    sourceTitles: string[];
    fragmentIds: string[];
  };
};

export const meridianResourceTypes = [
  "lesson",
  "leader_guide",
  "devotional",
  "discussion_guide",
  "activity",
  "curriculum",
  "sermon_support",
  "other"
] as const;

export type MeridianResourceType = (typeof meridianResourceTypes)[number];

export type SubmitMeridianResourceDraftInput = {
  title: string;
  resourceType: MeridianResourceType;
  audience: string;
  taskType: string;
  bodyMarkdown: string;
  claimIds: string[];
  idempotencyKey: string;
  clientName: string;
  safetyFindings: Array<{ code: string; detail: string }>;
};

export type SubmittedMeridianResourceDraft = {
  id: string;
  status: "submitted";
  safetyStatus: "review_required";
  reviewRequired: true;
  idempotentReplay: boolean;
};

export interface MeridianMcpRepository {
  requireGrant(session: AuthSession, capability: MeridianMcpCapability): Promise<MeridianMcpGrant>;
  search(session: AuthSession, query: string): Promise<MeridianMcpSearchResult[]>;
  fetch(session: AuthSession, id: string): Promise<MeridianMcpFetchedItem | null>;
  submitDraft(session: AuthSession, input: SubmitMeridianResourceDraftInput): Promise<SubmittedMeridianResourceDraft>;
}

export class MeridianMcpError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MeridianMcpError";
  }
}
