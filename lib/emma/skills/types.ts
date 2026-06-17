import type { AuthSession } from "@/lib/auth/server";
import type { Role } from "@/lib/types";
import type { z } from "zod";

import type {
  ContextManifest,
  EmmaContextCategory,
  EmmaRequestRecord,
  EmmaRiskLevel,
  EmmaWorkflow
} from "@/lib/emma/types";

export interface EmmaSkillPromptContext {
  request: EmmaRequestRecord;
  contextManifest: ContextManifest;
  session: AuthSession;
}

export interface EmmaSkillDefinition<TOutput = unknown> {
  key: string;
  workflow: EmmaWorkflow;
  displayName: string;
  riskLevel: EmmaRiskLevel;
  actionType: "none";
  requiresApproval: false;
  allowedRoles: readonly Role[];
  allowedContextCategories: readonly EmmaContextCategory[];
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  featureKey: string;
  systemPrompt: string;
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  buildUserPrompt(context: EmmaSkillPromptContext): string;
}

export type RegisteredEmmaSkill = EmmaSkillDefinition;
