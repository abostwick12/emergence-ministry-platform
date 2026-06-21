"use client";

import { campAccessLabels, campAccessRoles } from "@/lib/camp/access";
import { useCamp } from "@/components/camp/camp-provider";

// Development/test-only "Access Preview" control. Server-side rules are always
// authoritative; this never renders in production or normal Preview (gated by the
// server-decided rolePreviewEnabled flag), so no normal user can self-select a role.
export function CampAccessSwitcher() {
  const { role, setRole, rolePreviewEnabled } = useCamp();
  if (!rolePreviewEnabled) return null;
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
