"use client";

import Link from "next/link";
import { CampDaySelector } from "@/components/camp/camp-day-selector";
import { CampMedicalCommand } from "@/components/camp/camp-medical-command";

export default function CampMedicalCommandPage() {
  // Visibility and data are enforced server-side (Andrew only). Non-Andrew
  // identities receive a 403 from the API and a calm "not available" message;
  // no Medical Command payload is ever delivered to them.
  return (
    <div className="camp-cc-page">
      <Link href="/camp/more" className="camp-cc-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>More</span>
      </Link>
      <CampDaySelector />
      <CampMedicalCommand />
    </div>
  );
}
