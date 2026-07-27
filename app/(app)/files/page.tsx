import { PlaceholderPage } from "@/components/placeholder-page";

export default function FilesPage() {
  return (
    <PlaceholderPage
      eyebrow="Resource staging"
      title="Google Drive-ready organization"
      description="Google Drive-ready file organization for event folders, forms, slides, receipts, and leader resources. Live Drive creation is not enabled yet."
      stubLabel="Future Drive Area"
      emmaPage="files"
      emmaSignals={[
        "Event folders, forms, slides, receipts, and leader resources are planned file areas.",
        "Google Drive creation stays behind the adapter boundary until approved.",
        "EMMA can recommend organization next steps without moving files."
      ]}
      sections={["Event folders", "Waivers", "Packing lists", "Slides", "Receipts", "Leader resources"]}
    />
  );
}
