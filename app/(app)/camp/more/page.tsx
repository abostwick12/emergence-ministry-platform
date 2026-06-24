"use client";

import Link from "next/link";
import { useCamp } from "@/components/camp/camp-provider";

type MoreTile = {
  href: string;
  label: string;
  description: string;
};

const SAFE_TOOLS: MoreTile[] = [
  { href: "/camp/schedule", label: "Full Schedule", description: "Camp-wide timeline by day." },
  { href: "/camp/vehicles", label: "Transportation / Vehicles", description: "Vehicles, drivers, and visible riders." },
  { href: "/camp/forms", label: "Forms & Documents", description: "Leader packet and document status." },
  { href: "/camp/announcements", label: "Camp Announcements", description: "Current leader-facing schedule signals." },
  { href: "/camp/checkout", label: "Checkout / Return Home", description: "Return-home planning status." },
  { href: "/camp/my-team", label: "My Team / My Assignments", description: "Assignments visible to this access view." },
  { href: "/camp/safety", label: "Leader Safety", description: "Safe indicators and contact guidance." }
];

const RESTRICTED_TOOLS: MoreTile[] = [
  { href: "/camp/medicine-intake", label: "Medicine Intake / Return", description: "Restricted handoff and return records." },
  { href: "/camp/medication-schedule", label: "Medication Schedule", description: "Restricted schedule status." },
  { href: "/camp/medication-history", label: "Medication History & Corrections", description: "Restricted audit history." },
  { href: "/camp/medical-quick-view", label: "Medical Quick View", description: "Restricted operational flags." }
];

const MEDICAL_COMMAND_TOOLS: MoreTile[] = [
  { href: "/camp/medical-command", label: "Medical Dashboard", description: "Andrew-only Medical Command summary." },
  { href: "/camp/medical-command/administer", label: "Administer Medicine", description: "Andrew-only administration queue." },
  { href: "/camp/settings/staff", label: "Leader / Staff Details", description: "Edit imported leader and staff operational fields." },
  { href: "/camp/settings", label: "Camp Settings", description: "Camp access and settings entry point." }
];

export default function CampMorePage() {
  const { capabilities } = useCamp();
  const groups = [
    { title: "Camp tools", eyebrow: "Camp menu", tiles: SAFE_TOOLS, medical: false },
    ...(capabilities.restrictedMedical ? [{ title: "Restricted staff tools", eyebrow: "Restricted workflows", tiles: RESTRICTED_TOOLS, medical: true }] : []),
    ...(capabilities.medicalCommand ? [{ title: "Andrew Medical Command", eyebrow: "Admin tools", tiles: MEDICAL_COMMAND_TOOLS, medical: true }] : [])
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
            <div className={group.medical ? "camp-more-grid medical" : "camp-more-grid"}>
              {group.tiles.map((tile) => (
                <Link href={tile.href} key={tile.href} aria-label={tile.label}>
                  <strong>{tile.label}</strong>
                  <span>{tile.description}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
