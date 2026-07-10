import { PlaceholderPage } from "@/components/placeholder-page";

export default function BudgetPage() {
  return (
    <PlaceholderPage
      eyebrow="Budget"
      title="Budget Workspace"
      description="Budget visibility for event planning, proposed costs, receipts, and approval readiness. Live accounting integrations are not connected yet."
      sections={["Event budgets", "Proposed vs actual", "Receipts", "Approval status", "Categories"]}
    />
  );
}
