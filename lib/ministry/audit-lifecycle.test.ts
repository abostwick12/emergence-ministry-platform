import { describe, expect, it } from "vitest";
import { activeAuditItems, auditStatusFor, withAuditStatus } from "@/lib/ministry/audit-lifecycle";

describe("audit lifecycle helpers", () => {
  it("filters active camelCase items by voided and superseded rows", () => {
    const original = { id: "med-1", voidedAt: undefined, supersedesMedicationRecordId: undefined };
    const corrected = { id: "med-2", voidedAt: undefined, supersedesMedicationRecordId: "med-1" };
    const voided = { id: "med-3", voidedAt: "2026-07-06T00:00:00.000Z", supersedesMedicationRecordId: undefined };

    expect(activeAuditItems([original, corrected, voided], "supersedesMedicationRecordId", "voidedAt"))
      .toEqual([corrected]);
  });

  it("calculates camelCase audit status without changing status labels", () => {
    const original = { id: "intake-1", voidedAt: undefined, supersedesIntakeId: undefined };
    const corrected = { id: "intake-2", voidedAt: undefined, supersedesIntakeId: "intake-1" };
    const voided = { id: "intake-3", voidedAt: "2026-07-06T00:00:00.000Z", supersedesIntakeId: undefined };
    const active = { id: "intake-4", voidedAt: undefined, supersedesIntakeId: undefined };
    const allItems = [original, corrected, voided, active];

    expect(auditStatusFor(original, allItems, "supersedesIntakeId", "voidedAt")).toBe("Superseded");
    expect(auditStatusFor(corrected, allItems, "supersedesIntakeId", "voidedAt")).toBe("Corrected");
    expect(auditStatusFor(voided, allItems, "supersedesIntakeId", "voidedAt")).toBe("Voided");
    expect(auditStatusFor(active, allItems, "supersedesIntakeId", "voidedAt")).toBe("Active");
  });

  it("supports snake_case repository rows", () => {
    const original = { id: "row-1", voided_at: null, supersedes_schedule_item_id: null };
    const corrected = { id: "row-2", voided_at: null, supersedes_schedule_item_id: "row-1" };
    const voided = { id: "row-3", voided_at: "2026-07-06T00:00:00.000Z", supersedes_schedule_item_id: null };
    const rows = [original, corrected, voided];

    expect(activeAuditItems(rows, "supersedes_schedule_item_id", "voided_at")).toEqual([corrected]);
    expect(auditStatusFor(original, rows, "supersedes_schedule_item_id", "voided_at")).toBe("Superseded");
    expect(auditStatusFor(corrected, rows, "supersedes_schedule_item_id", "voided_at")).toBe("Corrected");
    expect(auditStatusFor(voided, rows, "supersedes_schedule_item_id", "voided_at")).toBe("Voided");
  });

  it("attaches audit status without mutating the source item", () => {
    const original = { id: "return-1", voidedAt: undefined, supersedesReturnItemId: undefined, label: "Original" };
    const corrected = { id: "return-2", voidedAt: undefined, supersedesReturnItemId: "return-1", label: "Corrected" };

    const result = withAuditStatus(original, [original, corrected], "supersedesReturnItemId", "voidedAt");

    expect(result).toEqual({ ...original, auditStatus: "Superseded" });
    expect(original).not.toHaveProperty("auditStatus");
  });
});
