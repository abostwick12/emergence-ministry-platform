import { Suspense } from "react";
import { CampSettingsImportToolPage } from "@/components/camp/camp-tool-pages";

export default function CampSettingsImportPage() {
  return (
    <Suspense fallback={<p className="camp-cc-muted">Loading import tools...</p>}>
      <CampSettingsImportToolPage />
    </Suspense>
  );
}
