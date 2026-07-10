import { PlaceholderPage } from "@/components/placeholder-page";

export default function FilesPage() {
  return (
    <PlaceholderPage
      eyebrow="Files"
      title="Ministry Files"
      description="Google Drive-ready file organization for event folders, forms, slides, receipts, and leader resources. Live Drive creation is not enabled yet."
      stubLabel="Future Drive Area"
      sections={["Event folders", "Waivers", "Packing lists", "Slides", "Receipts", "Leader resources"]}
    />
  );
}
