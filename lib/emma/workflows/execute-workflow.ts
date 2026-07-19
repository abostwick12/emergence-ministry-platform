import type { AuthSession } from "@/lib/auth/server";
import type { Role } from "@/lib/types";
import { containsForbiddenKeys } from "@/lib/emma/context";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import { runEmmaProviderForRequest } from "@/lib/emma/providers/run-provider";
import type { EmmaProviderId } from "@/lib/emma/providers/types";
import { getAiRequest } from "@/lib/emma/repository";
import { classifyRisk, isRestricted, isSensitiveCategory, requiresApprovalForRisk } from "@/lib/emma/risk";
import { resolveEmmaSkill } from "@/lib/emma/skills/registry";
import type { RegisteredEmmaSkill } from "@/lib/emma/skills/types";
import type {
  ContextManifest,
  ContextManifestEntry,
  EmmaContextCategory,
  EmmaResponse,
  EmmaRiskLevel,
  SafeEventPlanningContext
} from "@/lib/emma/types";
import { EMMA_CONTEXT_CATEGORIES } from "@/lib/emma/types";
import { z } from "zod";

const id = z.string().min(1);
const SAFE_CONTEXT_CATEGORY_SET: ReadonlySet<string> = new Set(EMMA_CONTEXT_CATEGORIES);

const workflowContextEntrySchema = z
  .object({
    recordId: id,
    recordType: z.string().min(1),
    category: z.string().min(1),
    sourceTable: z.string().min(1).optional()
  })
  .passthrough();

const safeEventContextSchema = z
  .object({
    eventId: id,
    title: z.string().min(1),
    eventType: z.enum(["retreat", "weekly", "service", "camp"]),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    location: z.string().nullable(),
    targetGroup: z.string().nullable(),
    ownerId: z.string().nullable(),
    status: z.enum(["draft", "planning", "ready", "not_started", "in_progress", "working_on_it", "stuck", "completed"]),
    priority: z.string().nullable(),
    volunteersNeeded: z.number().nullable(),
    description: z.string().nullable(),
    missingInformation: z.array(z.string())
  })
  .strict();

const executeWorkflowInputSchema = z
  .object({
    requestId: id,
    workflowKey: z.string().min(1),
    contextManifest: z
      .object({
        entries: z.array(workflowContextEntrySchema),
        safeEventContext: safeEventContextSchema.optional()
      })
      .passthrough()
      .optional(),
    provider: z.enum(["mock", "gemini", "openai", "azure"]).optional(),
    model: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().optional()
  })
  .strict();

export type ExecuteEmmaWorkflowInput = z.infer<typeof executeWorkflowInputSchema>;

export interface ExecuteEmmaWorkflowResult<TOutput = unknown> {
  requestId: string;
  runId: string;
  skillKey: string;
  workflow: RegisteredEmmaSkill["workflow"];
  riskLevel: EmmaRiskLevel;
  provider: EmmaProviderId;
  model: string;
  output: TOutput;
  proposalCreated: false;
  approvalRequired: false;
}

export async function executeEmmaWorkflow(
  session: AuthSession | null,
  rawInput: unknown
): Promise<EmmaResponse<ExecuteEmmaWorkflowResult>> {
  try {
    if (!session) {
      throw emmaErrors.unauthorized();
    }

    const input = parseExecuteInput(rawInput);
    const skill = resolveEmmaSkill(input.workflowKey);
    if (!skill) {
      throw emmaErrors.unknownWorkflow("Unknown EMMA workflow.");
    }

    assertRoleAllowed(session, skill);

    const request = await getAiRequest(session, input.requestId);
    if (request.workflow !== skill.workflow) {
      throw emmaErrors.conflict("EMMA request is not valid for this workflow.");
    }

    const contextManifest = buildValidatedContextManifest(skill, input.contextManifest);
    const riskLevel = classifyRisk({
      workflow: skill.workflow,
      contextCategories: contextManifest.entries.map((entry) => entry.category)
    });

    if (isRestricted(riskLevel)) {
      throw emmaErrors.restrictedContext();
    }
    if (requiresApprovalForRisk(riskLevel) || skill.requiresApproval) {
      throw emmaErrors.conflict("This EMMA workflow cannot run automatically.");
    }

    const providerResult = await runEmmaProviderForRequest(session, {
      requestId: request.id,
      skillKey: skill.key,
      inputSchemaVersion: skill.inputSchemaVersion,
      outputSchemaVersion: skill.outputSchemaVersion,
      featureKey: skill.featureKey,
      contextManifest,
      systemPrompt: skill.systemPrompt,
      userPrompt: skill.buildUserPrompt({ request, contextManifest, session }),
      outputSchema: skill.outputSchema,
      provider: input.provider,
      model: input.model,
      timeoutMs: input.timeoutMs,
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens
    });

    if (!providerResult.ok) {
      return providerResult;
    }

    return emmaOk({
      requestId: providerResult.data.requestId,
      runId: providerResult.data.runId,
      skillKey: skill.key,
      workflow: skill.workflow,
      riskLevel,
      provider: providerResult.data.provider,
      model: providerResult.data.model,
      output: providerResult.data.output,
      proposalCreated: false,
      approvalRequired: false
    });
  } catch (error) {
    return emmaFail(error);
  }
}

function parseExecuteInput(rawInput: unknown): ExecuteEmmaWorkflowInput {
  const parsed = executeWorkflowInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw emmaErrors.validation(issue?.message ?? "Invalid EMMA workflow request.");
  }
  return parsed.data;
}

function assertRoleAllowed(session: AuthSession, skill: RegisteredEmmaSkill): void {
  if (!skill.allowedRoles.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden();
  }
}

function buildValidatedContextManifest(
  skill: RegisteredEmmaSkill,
  rawManifest: ExecuteEmmaWorkflowInput["contextManifest"]
): ContextManifest {
  if (!rawManifest) return { entries: [] };
  if (containsForbiddenKeys(rawManifest)) {
    throw emmaErrors.restrictedContext();
  }

  const allowedCategories: ReadonlySet<string> = new Set(skill.allowedContextCategories);
  const entries: ContextManifestEntry[] = rawManifest.entries.map((entry) => {
    if (isSensitiveCategory(entry.category)) {
      throw emmaErrors.restrictedContext();
    }
    if (!SAFE_CONTEXT_CATEGORY_SET.has(entry.category) || !allowedCategories.has(entry.category)) {
      throw emmaErrors.restrictedContext();
    }

    return {
      recordId: entry.recordId,
      recordType: entry.recordType,
      category: entry.category as EmmaContextCategory,
      ...(entry.sourceTable ? { sourceTable: entry.sourceTable } : {})
    };
  });

  const manifest: ContextManifest = { entries };
  if (rawManifest.safeEventContext) {
    manifest.safeEventContext = rawManifest.safeEventContext as SafeEventPlanningContext;
  }
  return manifest;
}
