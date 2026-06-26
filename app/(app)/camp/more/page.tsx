"use client";

import Link from "next/link";
import { useCamp } from "@/components/camp/camp-provider";

type MoreTile = {
  href: string;
  label: string;
  description: string;
  marker: string;
};

const SAFE_TOOLS: MoreTile[] = [
  { href: "/camp/schedule", label: "Full Schedule", description: "Camp-wide timeline by day.", marker: "SC" },
  { href: "/camp/vehicles", label: "Transportation / Vehicles", description: "Vehicles, drivers, and visible riders.", marker: "TR" },
  { href: "/camp/forms", label: "Forms & Documents", description: "Leader packet and document status.", marker: "FD" },
  { href: "/camp/announcements", label: "Camp Announcements", description: "Current leader-facing schedule signals.", marker: "CA" },
  { href: "/camp/partner-campers", label: "Partner Church Campers", description: "Separate view for partner roster participants.", marker: "PC" },
  { href: "/camp/checkout", label: "Checkout / Return Home", description: "Return-home planning status.", marker: "CO" },
  { href: "/camp/my-team", label: "My Team / My Assignments", description: "Assignments visible to this access view.", marker: "MT" },
  { href: "/camp/safety", label: "Leader Safety", description: "Safe indicators and contact guidance.", marker: "LS" }
];

const RESTRICTED_TOOLS: MoreTile[] = [
  { href: "/camp/medicine-intake", label: "Medicine Intake / Return", description: "Restricted handoff and return records.", marker: "MI" },
  { href: "/camp/medication-schedule", label: "Medication Schedule", description: "Restricted schedule status.", marker: "MS" },
  { href: "/camp/medication-history", label: "Medication History & Corrections", description: "Restricted audit history.", marker: "MH" },
  { href: "/camp/medical-quick-view", label: "Medical Quick View", description: "Restricted operational flags.", marker: "MQ" }
];

const MEDICAL_COMMAND_TOOLS: MoreTile[] = [
  { href: "/camp/medical-command", label: "Medical Dashboard", description: "Andrew-only Medical Command summary.", marker: "MD" },
  { href: "/camp/medical-command/administer", label: "Administer Medicine", description: "Andrew-only administration queue.", marker: "AM" },
  { href: "/camp/all-campers", label: "All Campers", description: "Combined Emerge and partner camper oversight.", marker: "AC" },
  { href: "/camp/settings/import?mode=partner", label: "Partner Church Upload", description: "Admin import flow for reviewed partner rosters.", marker: "PU" },
  { href: "/camp/settings/staff", label: "Leader / Staff Details", description: "Edit imported leader and staff operational fields.", marker: "LD" },
  { href: "/camp/settings", label: "Camp Settings", description: "Camp access and settings entry point.", marker: "CS" }
];

export default function CampMorePage() {
  const { capabilities } = useCamp();
  const groups = [
    { title: "Camp Menu", eyebrow: "Launcher", tiles: SAFE_TOOLS, tone: "safe" },
    ...(capabilities.restrictedMedical ? [{ title: "Restricted Workflows", eyebrow: "Authorized staff", tiles: RESTRICTED_TOOLS, tone: "restricted" }] : []),
    ...(capabilities.medicalCommand ? [{ title: "Admin Tools", eyebrow: "Admin/import", tiles: MEDICAL_COMMAND_TOOLS, tone: "admin" }] : [])
  ];

  return (
    <div className="camp-cc-more">
      <header className="camp-cc-page-head">
        <h1>More Camp tools</h1>
        <p className="camp-cc-muted">Camp-only launcher. Restricted tools appear only for authorized staff.</p>
      </header>
      <section className="camp-more-sheet" aria-label="Camp tools menu">
        {groups.map((group) => (
          <div className="camp-more-group" key={group.title}>
            <p className="camp-cc-eyebrow">{group.eyebrow}</p>
            <h2 className="camp-tool-group-title">{group.title}</h2>
            <div className={`camp-more-grid ${group.tone}`}>
              {group.tiles.map((tile) => (
                <Link className="camp-more-tile" href={tile.href} key={tile.href} aria-label={tile.label}>
                  <span className="camp-more-tile-marker" aria-hidden="true">{tile.marker}</span>
                  <span className="camp-more-tile-body">
                    <strong>{tile.label}</strong>
                    <span>{tile.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
