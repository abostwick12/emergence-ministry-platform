import { PlaceholderPage } from "@/components/placeholder-page";

export default function CommunicationsPage() {
  return (
    <PlaceholderPage
      eyebrow="Communications"
      title="Communication Drafts"
      description="Stub Mode - not connected to live sending yet."
      sections={["Parent Email Drafts", "Leader Announcements", "Blast Texts", "Podcast / Leader Briefing Drafts", "Approval Queue"]}
    />
  );
}
