import { PlaceholderPage } from "@/components/placeholder-page";

export default function CommunicationsPage() {
  return (
    <PlaceholderPage
      eyebrow="Communications"
      title="Communication Drafts"
      description="Draft and approval space for parent emails, leader updates, text copy, and briefing content. Nothing sends live from this workspace yet."
      sections={["Parent Email Drafts", "Leader Announcements", "Blast Texts", "Podcast / Leader Briefing Drafts", "Approval Queue"]}
    />
  );
}
