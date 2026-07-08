export const metanarrativeMovements = [
  "Creation",
  "Fall",
  "Covenant",
  "Exodus / Deliverance",
  "Law / Formation",
  "Land / Kingdom",
  "Wisdom",
  "Prophets / Exile",
  "Return / Waiting",
  "Jesus / Kingdom Fulfilled",
  "Church / Spirit",
  "New Creation"
] as const;

export type MetanarrativeMovement = (typeof metanarrativeMovements)[number];

export type ScripturePlan = {
  id: string;
  title: string;
  audience: string;
  duration: string;
  primaryScripture: string;
  movement: MetanarrativeMovement;
  summary: string;
  contextFocus: string;
  weeklyRhythm: string[];
  discussionPrompts: string[];
  guardrailNotes: string[];
};

export type ScriptureStudySeed = {
  id: string;
  title: string;
  audience: string;
  primaryScripture: string;
  movement: MetanarrativeMovement;
  purpose: string;
  contextQuestion: string;
  communityQuestion: string;
};

export type ScriptureResource = {
  id: string;
  title: string;
  summary: string;
  studentPractice: string;
};

export type ScriptureReviewDraftType = "Reading plan draft" | "Student-led study draft";

export type ScriptureReviewItem = {
  id: string;
  title: string;
  type: ScriptureReviewDraftType;
  submittedBy: string;
  audience: string;
  primaryScripture: string;
  movement: MetanarrativeMovement;
  status: string;
  guardrailFlags: string[];
  leaderNotes: string;
  suggestedNextAction: string;
};

export type StudentDiscussionStatus = "pending_review" | "approved" | "changes_requested" | "archived" | "posted";

export type StudentDiscussionDeliveryStatus = "not_requested" | "not_configured" | "delivered" | "failed";

export type StudentDiscussionPrompt = {
  id: string;
  groupId?: string;
  submittedByUserId: string;
  submittedByName: string;
  submittedByEmail: string;
  question: string;
  scriptureReference: string;
  scripturePassageId?: string;
  metanarrativeMovement?: MetanarrativeMovement;
  aiProvider: "gloo";
  aiStatus: "not_configured" | "pending" | "generated" | "failed";
  aiModel: string;
  aiModelTier: "default" | "escalation" | "long_context";
  aiModelReason: string;
  aiConfidence: number | null;
  topicTags: string[];
  escalationReason: string;
  safetyLabel: "safe" | "needs_leader_care" | "pastoral_escalation" | "unreviewed";
  safetyNotes: string;
  discussionPrompt: string;
  leaderNotes: string;
  status: StudentDiscussionStatus;
  deliveryChannel?: string;
  deliveryStatus: StudentDiscussionDeliveryStatus;
  deliveryMessage: string;
  approvedByUserId?: string;
  approvedAt?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
};
