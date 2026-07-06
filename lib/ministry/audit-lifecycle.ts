export type AuditLifecycleStatus = "Active" | "Corrected" | "Superseded" | "Voided";

type AuditableRecord = {
  id: string;
};

function hasValue(value: unknown): boolean {
  return Boolean(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function activeAuditItems<
  T extends AuditableRecord,
  SupersedesKey extends keyof T,
  VoidedKey extends keyof T
>(items: T[], supersedesKey: SupersedesKey, voidedKey: VoidedKey): T[] {
  const supersededIds = new Set<string>();
  for (const item of items) {
    const value = stringValue(item[supersedesKey]);
    if (value) supersededIds.add(value);
  }
  return items.filter((item) => !hasValue(item[voidedKey]) && !supersededIds.has(item.id));
}

export function auditStatusFor<
  T extends AuditableRecord,
  SupersedesKey extends keyof T,
  VoidedKey extends keyof T
>(
  item: T,
  allItems: T[],
  supersedesKey: SupersedesKey,
  voidedKey: VoidedKey
): AuditLifecycleStatus {
  if (hasValue(item[voidedKey])) return "Voided";
  if (hasValue(item[supersedesKey])) return "Corrected";
  return allItems.some((candidate) => candidate[supersedesKey] === item.id) ? "Superseded" : "Active";
}

export function withAuditStatus<
  T extends AuditableRecord,
  SupersedesKey extends keyof T,
  VoidedKey extends keyof T
>(
  item: T,
  allItems: T[],
  supersedesKey: SupersedesKey,
  voidedKey: VoidedKey
): T & { auditStatus: AuditLifecycleStatus } {
  return { ...item, auditStatus: auditStatusFor(item, allItems, supersedesKey, voidedKey) };
}
