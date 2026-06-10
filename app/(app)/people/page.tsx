import { PlaceholderPage } from "@/components/placeholder-page";

export default function PeoplePage() {
  return (
    <PlaceholderPage
      eyebrow="People"
      title="Ministry Roster"
      description="Future Planning Center / ministry roster sync area. Live Planning Center sync is not enabled in MVP 1."
      stubLabel="Future Sync Area"
      sections={["Leaders", "Volunteers", "Students", "Parents / Households", "Birthdays and Anniversaries"]}
    />
  );
}
