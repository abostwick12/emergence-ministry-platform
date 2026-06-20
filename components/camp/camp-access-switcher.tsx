"use client";

import { campAccessLabels, campAccessRoles } from "@/lib/camp/access";
import { useCamp } from "@/components/camp/camp-provider";

// Mirrors the existing Camp "Access Preview" control. Server-side rules remain
// authoritative; this only previews server-filtered access while building rosters.
export function CampAccessSwitcher() {
  const { role, setRole } = useCamp();
  return (
    <section className="camp-cc-access" aria-label="Camp access preview">
      <p className="camp-cc-eyebrow">Access preview</p>
      <div className="camp-cc-access-tabs" role="group" aria-label="Camp access role">
        {campAccessRoles.map((option) => (
          <button
            key={option}
            type="button"
            className={option === role ? "camp-cc-access-tab active" : "camp-cc-access-tab"}
            onClick={() => setRole(option)}
          >
            {campAccessLabels[option]}
          </button>
        ))}
      </div>
    </section>
  );
}
