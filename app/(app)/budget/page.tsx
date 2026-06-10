import { PlaceholderPage } from "@/components/placeholder-page";

export default function BudgetPage() {
  return (
    <PlaceholderPage
      eyebrow="Budget"
      title="Budget Workspace"
      description="Simple MVP budget planning shell. Detailed approvals and live accounting are future work."
      sections={["Event budgets", "Proposed vs actual", "Receipts", "Approval status", "Categories"]}
    />
  );
}
