import { PlaceholderPage } from "@/components/placeholder-page";

export default function ResourceDevelopmentPage() {
  return (
    <PlaceholderPage
      eyebrow="Leader Hub"
      title="Resource Development"
      description="Plan leader resources, discipleship assets, and upload review without connecting live file providers yet."
      emmaPage="files"
      sections={[
        "Leader resource upload queue",
        "Training and discipleship asset review",
        "Publishing readiness checklist"
      ]}
    />
  );
}
