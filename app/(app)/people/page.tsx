import { PlaceholderPage } from "@/components/placeholder-page";

export default function PeoplePage() {
  return (
    <PlaceholderPage
      eyebrow="People"
      title="Ministry Roster"
      description="Planning Center-ready roster visibility for leaders, volunteers, students, households, and pastoral follow-up. Live sync is not enabled yet."
      stubLabel="Future Sync Area"
      sections={["Leaders", "Volunteers", "Students", "Parents / Households", "Birthdays and Anniversaries"]}
    />
  );
}
