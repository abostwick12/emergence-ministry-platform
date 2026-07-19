import { PlaceholderPage } from "@/components/placeholder-page";

export default function VolunteerDashboardPage() {
  return (
    <PlaceholderPage
      eyebrow="Directors Hub"
      title="Volunteer Dashboard"
      description="Monitor volunteer coverage, leader readiness, and resource gaps without creating a separate people database."
      emmaPage="people"
      sections={[
        "Volunteer coverage monitoring",
        "Resource readiness by team",
        "Planning Center-backed volunteer sync boundary"
      ]}
    />
  );
}
