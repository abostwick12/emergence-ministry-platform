import { PlaceholderPage } from "@/components/placeholder-page";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      eyebrow="Settings"
      title="Platform Settings"
      description="MVP settings shell for configuration planning. API keys and secrets are not exposed in the UI."
      sections={[
        "User profile",
        "Roles and permissions",
        "Ministry areas",
        "Event types",
        "Locations",
        "Stub Mode integrations",
        "Future API connection settings"
      ]}
    />
  );
}
