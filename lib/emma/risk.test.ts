import { describe, expect, it } from "vitest";
import { EmmaError } from "@/lib/emma/errors";
import {
  assertWorkflowAllowed,
  classifyRisk,
  isKnownWorkflow,
  isWorkflowEnabled,
  requiresApprovalForRisk
} from "@/lib/emma/risk";

describe("classifyRisk", () => {
  it("returns the workflow's base risk", () => {
    expect(classifyRisk({ workflow: "GENERATE_MINISTRY_SUMMARY" })).toBe("low");
    expect(classifyRisk({ workflow: "ANALYZE_TASK_HEALTH" })).toBe("low");
    expect(classifyRisk({ workflow: "GENERATE_EVENT_TASKS" })).toBe("medium");
    expect(classifyRisk({ workflow: "DRAFT_PARENT_EMAIL" })).toBe("high");
  });

  it("escalates to restricted when sensitive context is involved", () => {
    expect(classifyRisk({ workflow: "GENERATE_EVENT_TASKS", contextCategories: ["event", "medical"] })).toBe("restricted");
    expect(classifyRisk({ workflow: "GENERATE_MINISTRY_SUMMARY", contextCategories: ["parent_contact"] })).toBe("restricted");
    expect(classifyRisk({ workflow: "ANALYZE_TASK_HEALTH", contextCategories: ["pastoral_care"] })).toBe("restricted");
  });

  it("never lowers risk for non-sensitive context", () => {
    expect(classifyRisk({ workflow: "DRAFT_PARENT_EMAIL", contextCategories: ["event", "task"] })).toBe("high");
  });
});

describe("requiresApprovalForRisk", () => {
  it("auto-runs low risk and requires approval for everything else", () => {
    expect(requiresApprovalForRisk("low")).toBe(false);
    expect(requiresApprovalForRisk("medium")).toBe(true);
    expect(requiresApprovalForRisk("high")).toBe(true);
    expect(requiresApprovalForRisk("restricted")).toBe(true);
  });
});

describe("workflow gating", () => {
  it("recognizes known and unknown workflows", () => {
    expect(isKnownWorkflow("GENERATE_EVENT_TASKS")).toBe(true);
    expect(isKnownWorkflow("NOPE")).toBe(false);
  });

  it("marks deferred workflows as disabled", () => {
    expect(isWorkflowEnabled("QUERY_MINISTRY_LIBRARY")).toBe(false);
    expect(isWorkflowEnabled("DRAFT_STUDENT_FOLLOW_UP")).toBe(false);
    expect(isWorkflowEnabled("GENERATE_EVENT_TASKS")).toBe(true);
  });

  it("assertWorkflowAllowed accepts enabled workflows", () => {
    expect(() => assertWorkflowAllowed("GENERATE_EVENT_TASKS")).not.toThrow();
  });

  it("assertWorkflowAllowed rejects unknown workflows", () => {
    try {
      assertWorkflowAllowed("NOPE");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EmmaError);
      expect((error as EmmaError).code).toBe("UNKNOWN_WORKFLOW");
    }
  });

  it("assertWorkflowAllowed rejects deferred workflows", () => {
    try {
      assertWorkflowAllowed("QUERY_MINISTRY_LIBRARY");
      throw new Error("expected throw");
    } catch (error) {
      expect((error as EmmaError).code).toBe("WORKFLOW_DISABLED");
    }
  });
});
