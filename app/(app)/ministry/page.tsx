import Link from "next/link";

import { EditorialSection, PageIntro, StatusBadge } from "@/components/platform-ui";

const ministryAreas = [
  { href: "/events", title: "Events", detail: "Create event plans, readiness work, and Master Event Card updates." },
  { href: "/worship", title: "Worship", detail: "Plan services, rehearsal details, and presentation prep." },
  { href: "/tasks", title: "Tasks", detail: "Track ownership, status, due dates, and follow-up work." },
  { href: "/communications", title: "Communications", detail: "Prepare reviewed communication drafts without sending live messages." },
  { href: "/budget", title: "Budget", detail: "Record planning expenses and watch event budget targets." }
] as const;

export default function MinistryHubPage() {
  return (
    <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
      <PageIntro
        eyebrow="Ministry Hub"
        title="Ministry operations"
        description="The core event, worship, task, communication, and budget pages are grouped here so the sidebar stays focused once you are inside ministry work."
        actions={<StatusBadge>Live workspace links</StatusBadge>}
      />

      <EditorialSection eyebrow="Open" title="Choose a ministry workspace" description="Each workspace keeps its existing data and preview-only provider boundaries.">
        <div className="placeholder-capability-list">
          {ministryAreas.map((area) => (
            <Link className="placeholder-capability-row" href={area.href} key={area.href}>
              <strong>{area.title}</strong>
              <p>{area.detail}</p>
              <StatusBadge>Open</StatusBadge>
            </Link>
          ))}
        </div>
      </EditorialSection>
    </section>
  );
}
