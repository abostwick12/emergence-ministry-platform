"use client";

import Link from "next/link";
import { useCamp } from "@/components/camp/camp-provider";
import { CampDaySelector } from "@/components/camp/camp-day-selector";
import { CampNextUpCard } from "@/components/camp/camp-next-up-card";
import { CampTeamCarousel } from "@/components/camp/camp-team-carousel";
import { CampMedicalCommand } from "@/components/camp/camp-medical-command";

export function CampHome() {
  const { capabilities, loading, homeMode, setHomeMode } = useCamp();

  return (
    <div className="camp-cc-home">
      {capabilities.medicalCommand ? (
        <div className="camp-cc-mode" role="group" aria-label="Camp Home mode">
          <button
            type="button"
            className={homeMode === "operations" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"}
            onClick={() => setHomeMode("operations")}
          >
            Operations
          </button>
          <button
            type="button"
            className={homeMode === "medical" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"}
            onClick={() => setHomeMode("medical")}
          >
            Medical Command
          </button>
        </div>
      ) : null}

      <CampDaySelector />

      {homeMode === "medical" && capabilities.medicalCommand ? (
        <CampMedicalCommand />
      ) : (
        <>
          <CampNextUpCard />
          <Link href="/camp/safety" className="camp-cc-entry" aria-label="Open Leader Safety view">
            <span className="camp-cc-entry-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" />
                <path d="M9.3 12l1.8 1.8 3.6-3.8" />
              </svg>
            </span>
            <span className="camp-cc-entry-body">
              <strong>Leader Safety</strong>
              <span className="camp-cc-muted">Safety basics for your campers — No leader safety alerts on file.</span>
            </span>
            <span className="camp-cc-entry-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
          {loading ? <p className="camp-cc-muted">Loading camp data…</p> : <CampTeamCarousel />}
        </>
      )}
    </div>
  );
}
