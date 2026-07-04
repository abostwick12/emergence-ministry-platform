import Link from "next/link";
import { getServerSession } from "@/lib/auth/server";
import { getOverview } from "@/lib/command-center/repository";
import { DOMAIN_LABELS, DOMAIN_ORDER, domainClassName } from "@/components/command-center/domain-meta";
import { CaptureInboxPanel } from "@/components/command-center/capture-inbox-panel";
import { formatDate } from "@/lib/utils";

const INTEGRATION_LABELS: Record<string, string> = {
  slack: "Slack",
  google_calendar: "Google Calendar",
  gmail: "Gmail",
  google_drive: "Google Drive",
  linkedin: "LinkedIn",
  monday: "Monday.com"
};

export default async function CommandCenterPage() {
  const session = await getServerSession();
  if (!session) return null;
  const overview = await getOverview(session);

  return (
    <div className="grid workspace-page">
      <section className="panel command-center-priority-card">
        <p className="eyebrow">Today&apos;s Priority</p>
        {overview.todayPriority ? (
          <>
            <h2 className="section-title flush">{overview.todayPriority.title}</h2>
            <p className="muted">
              {DOMAIN_LABELS[overview.todayPriority.domain]}
              {overview.todayPriority.dueDate ? ` · Due ${formatDate(overview.todayPriority.dueDate)}` : ""}
            </p>
          </>
        ) : (
          <p className="muted">Nothing urgent right now — a good day to work ahead on SOTF or job search.</p>
        )}
        <div className="toolbar">
          <Link className="button primary" href="/command-center/chat">
            Ask SAGE
          </Link>
          {overview.jobFollowUpsDueCount > 0 ? (
            <Link className="button" href="/command-center/job-search">
              {overview.jobFollowUpsDueCount} job follow-up{overview.jobFollowUpsDueCount === 1 ? "" : "s"} due
            </Link>
          ) : null}
        </div>
      </section>

      <section className="command-center-domain-row">
        {DOMAIN_ORDER.map((domain) => {
          const summary = overview.tasksByDomain[domain];
          return (
            <div className={`panel command-center-domain-card ${domainClassName(domain)}`} key={domain}>
              <p className="eyebrow">{DOMAIN_LABELS[domain]}</p>
              <h3 className="section-title flush">{summary.open} open</h3>
              {summary.nextDue ? (
                <p className="muted">
                  Next: {summary.nextDue.title}
                  {summary.nextDue.dueDate ? ` (${formatDate(summary.nextDue.dueDate)})` : ""}
                </p>
              ) : (
                <p className="muted">Nothing scheduled.</p>
              )}
            </div>
          );
        })}
      </section>

      <CaptureInboxPanel initialCount={overview.unprocessedCaptureCount} />

      <section className="panel">
        <p className="eyebrow">Morning Briefing</p>
        <h2 className="section-title flush">Fresh Intelligence</h2>
        {overview.briefingItems.map((item) => (
          <div className="command-center-briefing-item" key={item.id}>
            <strong>{item.title}</strong>
            <p className="muted">
              {item.summary} — <span>{item.source}</span>
            </p>
          </div>
        ))}
        <Link className="button ghost" href="/command-center/feed">
          View full feed
        </Link>
      </section>

      <section className="panel">
        <p className="eyebrow">Integrations</p>
        <h2 className="section-title flush">Connected Tools</h2>
        <div className="command-center-integration-row">
          {overview.integrations.map((integration) => (
            <span
              className={`command-center-integration-chip${integration.status === "connected" ? " connected" : ""}`}
              key={integration.service}
            >
              {INTEGRATION_LABELS[integration.service] ?? integration.service}
            </span>
          ))}
        </div>
        <Link className="button ghost" href="/command-center/integrations">
          Manage integrations
        </Link>
      </section>
    </div>
  );
}
