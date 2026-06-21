import { Suspense } from "react";
import { CampAdministerMedicineToolPage } from "@/components/camp/camp-tool-pages";

export default function CampAdministerMedicinePage() {
  return (
    <Suspense fallback={<p className="camp-cc-muted">Loading medication administration...</p>}>
      <CampAdministerMedicineToolPage />
    </Suspense>
  );
}
