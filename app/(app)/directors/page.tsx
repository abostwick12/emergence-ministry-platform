import Link from "next/link";

import { EditorialSection, PageIntro, StatusBadge } from "@/components/platform-ui";

const directorAreas = [
  { href: "/leader-prep", title: "Sermon Prep", detail: "Draft sermons, leader guides, and preview-only preparation assets." },
  { href: "/directors/resources", title: "Resource Development", detail: "Stage leader resources and upload workflows before live provider actions exist." },
  { href: "/discipleship", title: "Discipleship Dashboard", detail: "Review student questions, formation signals, Scripture resources, and launch evidence." },
  { href: "/directors/volunteers", title: "Volunteer Dashboard", detail: "Monitor volunteer coverage and resource readiness from one leader view." }
] as const;

export default function DirectorsHubPage() {
  return (
    <section className="placeholder-page editorial-placeholder-page" aria-labelledby="directors-hub-title">
      <PageIntro
        eyebrow="Oversight"
        title="Formation and resource workspaces"
        description="Sermon preparation, resource development, discipleship monitoring, and volunteer readiness are grouped here for leader-level oversight."
        actions={<StatusBadge>Leader view</StatusBadge>}
      />

      <EditorialSection eyebrow="Monitor" title="Open a leader workspace" description="Live workflows stay in their existing pages; planned upload and publishing actions remain explicitly inactive.">
        <div className="placeholder-capability-list">
          {directorAreas.map((area) => (
            <Link className="placeholder-capability-row" href={area.href} key={area.href}>
              <strong>{area.title}</strong>
              <p>{area.detail}</p>
              <StatusBadge>{area.href.startsWith("/directors/") ? "Planned" : "Open"}</StatusBadge>
            </Link>
          ))}
        </div>
      </EditorialSection>
    </section>
  );
}
