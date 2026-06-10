import { PlaceholderPage } from "@/components/placeholder-page";

export default function FilesPage() {
  return (
    <PlaceholderPage
      eyebrow="Files"
      title="Ministry Files"
      description="Future Google Drive connection area. Live Google Drive folder creation is not enabled in MVP 1."
      stubLabel="Future Drive Area"
      sections={["Event folders", "Waivers", "Packing lists", "Slides", "Receipts", "Leader resources"]}
    />
  );
}
