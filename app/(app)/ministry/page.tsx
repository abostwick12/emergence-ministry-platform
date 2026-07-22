import Link from "next/link";
import { ArrowRight, CalendarDays, CheckSquare, Mail, Music2, WalletCards, type LucideIcon } from "lucide-react";

import { EditorialSection, PageIntro } from "@/components/platform-ui";

const ministryAreas = [
  { href: "/events", title: "Events", detail: "Plan and update event readiness.", action: "Review events", icon: CalendarDays },
  { href: "/tasks", title: "Tasks", detail: "See what needs an owner, update, or follow-up.", action: "Work tasks", icon: CheckSquare },
  { href: "/communications", title: "Communications", detail: "Prepare drafts for review. Nothing sends live.", action: "Review drafts", icon: Mail },
  { href: "/worship", title: "Worship", detail: "Plan services, rehearsals, and presentation prep.", action: "Plan worship", icon: Music2 },
  { href: "/budget", title: "Budget", detail: "Track event expenses and budget targets.", action: "Check budget", icon: WalletCards }
] satisfies Array<{ href: string; title: string; detail: string; action: string; icon: LucideIcon }>;

export default function MinistryHubPage() {
  return (
    <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
      <PageIntro
        eyebrow="Ministry Hub"
        title="Ministry operations"
        description="Open the workspaces your team uses every week."
      />

      <EditorialSection eyebrow="Open" title="Choose a workspace">
        <div className="placeholder-capability-list ministry-launch-list">
          {ministryAreas.map((area) => (
            <Link className="placeholder-capability-row" href={area.href} key={area.href}>
              <span className="ministry-launch-icon" aria-hidden="true">
                <area.icon />
              </span>
              <strong>{area.title}</strong>
              <p>{area.detail}</p>
              <span className="ministry-launch-action">
                {area.action}
                <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </EditorialSection>
    </section>
  );
}
