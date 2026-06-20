"use client";

import { CampDaySelector } from "@/components/camp/camp-day-selector";
import { CampMedicalCommand } from "@/components/camp/camp-medical-command";

export default function CampMedicalCommandPage() {
  // Visibility and data are enforced server-side (Andrew only). Non-Andrew
  // identities receive a 403 from the API and a calm "not available" message;
  // no Medical Command payload is ever delivered to them.
  return (
    <div className="camp-cc-page">
      <CampDaySelector />
      <CampMedicalCommand />
    </div>
  );
}
