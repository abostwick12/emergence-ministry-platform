"use client";

import { useEffect, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { CampAccessSwitcher } from "@/components/camp/camp-access-switcher";
import { CampDaySelector } from "@/components/camp/camp-day-selector";
import { CampNextUpCard } from "@/components/camp/camp-next-up-card";
import { CampTeamCarousel } from "@/components/camp/camp-team-carousel";
import { CampMedicalCommand } from "@/components/camp/camp-medical-command";

type HomeMode = "operations" | "medical";

export function CampHome() {
  const { capabilities, loading } = useCamp();
  const [mode, setMode] = useState<HomeMode>("operations");

  // If the current identity loses Medical Command access (e.g. role preview
  // switched to Jaci), force back to Operations so no medical UI lingers.
  useEffect(() => {
    if (!capabilities.medicalCommand && mode === "medical") setMode("operations");
  }, [capabilities.medicalCommand, mode]);

  return (
    <div className="camp-cc-home">
      <CampAccessSwitcher />

      {capabilities.medicalCommand ? (
        <div className="camp-cc-mode" role="group" aria-label="Camp Home mode">
          <button
            type="button"
            className={mode === "operations" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"}
            onClick={() => setMode("operations")}
          >
            Operations
          </button>
          <button
            type="button"
            className={mode === "medical" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"}
            onClick={() => setMode("medical")}
          >
            Medical Command
          </button>
        </div>
      ) : null}

      <CampDaySelector />

      {mode === "medical" && capabilities.medicalCommand ? (
        <CampMedicalCommand />
      ) : (
        <>
          <CampNextUpCard />
          {loading ? <p className="camp-cc-muted">Loading camp data…</p> : <CampTeamCarousel />}
        </>
      )}
    </div>
  );
}
