import Link from "next/link";
import { Mail, Calendar, TrendingUp, Sparkle, ArrowRight, Plug } from "lucide-react";
import { CaptureInboxPanel } from "@/components/command-center/capture-inbox-panel";
import { DashboardFeedRail, type ActivityItem } from "@/components/command-center/dashboard-feed-rail";
import { DOMAIN_LABELS, DOMAIN_ORDER } from "@/components/command-center/domain-meta";
import { getServerSession } from "@/lib/auth/server";
import { getOverview, listJobApplications, listPersonalTasks, listUnprocessedCaptures } from "@/lib/command-center/repository";
import { integrationDisplayStatus } from "@/lib/command-center/integrations-meta";
import { formatDate } from "@/lib/utils";
import type { JobApplicationStatus, PersonalIntegration } from "@/lib/command-center/types";

const PIPELINE_STAGES: { status: JobApplicationStatus; label: string }[] = [
  { status: "researching", label: "Research" },
  { status: "applied", label: "Applied" },
  { status: "phone_screen", label: "Screen" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" }
];

function buildActivityFeed(params: {
  tasks: Awaited<ReturnType<typeof listPersonalTasks>>;
  jobApplications: Awaited<ReturnType<typeof listJobApplications>>;
  captures: Awaited<ReturnType<typeof listUnprocessedCaptures>>;
}): ActivityItem[] {
  const taskItems: ActivityItem[] = params.tasks.map((task) => ({
    id: `task:${task.id}`,
    source: "task",
    title: task.title,
    detail: `${DOMAIN_LABELS[task.domain]} · ${task.status.replace("_", " ")}`,
    timestamp: task.updatedAt
  }));
  const jobItems: ActivityItem[] = params.jobApplications.map((application) => ({
    id: `job:${application.id}`,
    source: "job_application",
    title: `${application.company} — ${application.role}`,
    detail: `Status: ${application.status.replace("_", " ")}`,
    timestamp: application.updatedAt
  }));
  const captureItems: ActivityItem[] = params.captures.map((entry) => ({
    id: `capture:${entry.id}`,
    source: "capture",
    title: entry.rawText.length > 80 ? `${entry.rawText.slice(0, 80)}…` : entry.rawText,
    detail: "Awaiting review",
    timestamp: entry.createdAt
  }));

  return [...taskItems, ...jobItems, ...captureItems].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20);
}

function integrationSummary(integration: PersonalIntegration | undefined, service: PersonalIntegration["service"]) {
  const storedStatus = integration?.status ?? "disconnected";
  const displayStatus = integrationDisplayStatus({ service, storedStatus });
  const label = displayStatus === "connected" ? "Connected" : displayStatus === "configured" ? "Configured" : "Not configured";
  return { displayStatus, label };
}

export default async function CommandCenterPage() {
  const session = await getServerSession();
  if (!session) return null;

  const [overview, jobApplications, tasks, captures] = await Promise.all([
    getOverview(session),
    listJobApplications(session),
    listPersonalTasks(session),
    listUnprocessedCaptures(session)
  ]);

  const activity = buildActivityFeed({ tasks, jobApplications, captures });
  const calendarIntegration = overview.integrations.find((integration) => integration.service === "google_calendar");
  const gmailIntegration = overview.integrations.find((integration) => integration.service === "gmail");
  const calendarSummary = integrationSummary(calendarIntegration, "google_calendar");
  const gmailSummary = integrationSummary(gmailIntegration, "gmail");
  const connectedCount = overview.integrations.filter((integration) => integration.status === "connected").length;

  const upcoming = DOMAIN_ORDER.map((domain) => overview.tasksByDomain[domain].nextDue)
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 4);

  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: jobApplications.filter((application) => application.status === stage.status).length
  }));

  return (
    <div className="cc-content">
      <div className="cc-content-main">
        <div className="cc-bento-grid">
          {/* Hero — today's priority */}
          <section className="cc-card-hero cc-col-2 cc-row-2" style={{ display: "flex", flexDirection: "column", minHeight: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkle size={14} color="var(--cc-brass)" fill="currentColor" />
                <span className="cc-eyebrow" style={{ color: "oklch(0.985 0.006 85 / 0.6)" }}>
                  SAGE · Today&apos;s Priority
                </span>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {overview.todayPriority ? (
                <>
                  <p className="cc-eyebrow" style={{ color: "var(--cc-brass)", marginBottom: 12 }}>
                    {DOMAIN_LABELS[overview.todayPriority.domain]}
                  </p>
                  <h2 className="cc-serif" style={{ fontSize: 28, lineHeight: 1.2, fontWeight: 500, color: "var(--cc-ivory)", marginBottom: 12 }}>
                    {overview.todayPriority.title}
                  </h2>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "oklch(0.985 0.006 85 / 0.7)", maxWidth: "48ch" }}>
                    {overview.todayPriority.description ?? "No further detail added."}
                    {overview.todayPriority.dueDate ? ` Due ${formatDate(overview.todayPriority.dueDate)}.` : ""}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 15, color: "oklch(0.985 0.006 85 / 0.8)" }}>
                  Nothing urgent right now. A good day to work ahead on SOTF or job search.
                </p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32 }}>
              <Link href="/command-center/chat" className="cc-button cc-on-hero">
                Ask SAGE <ArrowRight size={13} />
              </Link>
              {overview.jobFollowUpsDueCount > 0 ? (
                <Link
                  href="/command-center/job-search"
                  className="cc-button"
                  style={{ background: "transparent", color: "var(--cc-ivory)", borderColor: "oklch(0.985 0.006 85 / 0.2)" }}
                >
                  {overview.jobFollowUpsDueCount} follow-up{overview.jobFollowUpsDueCount === 1 ? "" : "s"} due
                </Link>
              ) : null}
            </div>
          </section>

          {/* Daily planner */}
          <section className="cc-card-paper cc-hover cc-col-2">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 className="cc-eyebrow">Daily Planner</h3>
              <span className="cc-mono-tab" style={{ fontSize: 10, color: "var(--cc-muted)" }}>
                {upcoming.length} upcoming
              </span>
            </div>
            {upcoming.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>
                No upcoming due dates across your domains.
              </p>
            ) : (
              <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {upcoming.map((task) => (
                  <li key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span className="cc-mono-tab" style={{ fontSize: 11, color: "var(--cc-teal)", width: 64, flexShrink: 0 }}>
                      {task.dueDate ? formatDate(task.dueDate) : "No date"}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{task.title}</p>
                      <p style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 2 }}>{DOMAIN_LABELS[task.domain]}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Calendar + Gmail status cells */}
          <IntegrationCell icon={Calendar} label="Google Calendar" status={calendarSummary} href="/command-center/integrations" />
          <IntegrationCell icon={Mail} label="Gmail" status={gmailSummary} href="/command-center/integrations" />

          {/* Domain summary row */}
          {DOMAIN_ORDER.map((domain) => {
            const summary = overview.tasksByDomain[domain];
            return (
              <section className="cc-card-paper cc-hover" key={domain}>
                <p className="cc-eyebrow" style={{ marginBottom: 8 }}>
                  {DOMAIN_LABELS[domain]}
                </p>
                <p className="cc-serif" style={{ fontSize: 26, fontWeight: 500, color: "var(--cc-navy)" }}>
                  {summary.open}
                  <span style={{ fontSize: 12, fontWeight: 400, color: "var(--cc-muted)", marginLeft: 6 }}>open</span>
                </p>
                <p style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 8 }}>
                  {summary.nextDue ? `Next: ${summary.nextDue.title}` : "Nothing scheduled."}
                </p>
              </section>
            );
          })}

          {/* Job pipeline */}
          <section className="cc-card-paper cc-hover cc-col-4">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={14} color="var(--cc-muted)" />
                <h3 className="cc-eyebrow">Career Pipeline</h3>
              </div>
              <Link href="/command-center/job-search" className="button ghost" style={{ fontSize: 11 }}>
                View all
              </Link>
            </div>
            {jobApplications.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>
                No applications tracked yet.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
                {pipelineCounts.map((stage) => (
                  <div key={stage.status}>
                    <p className="cc-serif" style={{ fontSize: 22, fontWeight: 500 }}>
                      {stage.count}
                    </p>
                    <p className="cc-eyebrow" style={{ fontSize: 9, marginTop: 4 }}>
                      {stage.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Integrations overview */}
          <section className="cc-card-paper cc-hover cc-col-2">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Plug size={14} color="var(--cc-muted)" />
                <h3 className="cc-eyebrow">Integrations</h3>
              </div>
              <span className="cc-mono-tab" style={{ fontSize: 10, color: "var(--cc-brass)", fontWeight: 600 }}>
                {connectedCount} / {overview.integrations.length} connected
              </span>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Manage Calendar, Gmail, Drive, Slack, Firecrawl, Monday.com, and LinkedIn from one place.
            </p>
            <Link href="/command-center/integrations" className="button ghost" style={{ fontSize: 11 }}>
              View all integrations
            </Link>
          </section>
        </div>

        <CaptureInboxPanel initialCount={overview.unprocessedCaptureCount} />

        <section className="cc-card-paper" style={{ marginTop: 20 }}>
          <p className="cc-eyebrow" style={{ marginBottom: 8 }}>
            Morning Briefing
          </p>
          <h2 style={{ fontWeight: 600, marginBottom: 12 }}>Manual Resource Feed</h2>
          {overview.briefingItems.map((item) => (
            <div key={item.id} style={{ borderBottom: "1px solid var(--cc-border)", paddingBottom: 10, marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>{item.title}</strong>
              <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {item.summary} — <span>{item.source}</span>
              </p>
            </div>
          ))}
          <Link href="/command-center/feed" className="button ghost" style={{ fontSize: 11 }}>
            View full feed
          </Link>
        </section>
      </div>

      <DashboardFeedRail items={activity} />
    </div>
  );
}

function IntegrationCell({
  icon: Icon,
  label,
  status,
  href
}: {
  icon: typeof Mail;
  label: string;
  status: { displayStatus: string; label: string };
  href: string;
}) {
  return (
    <Link href={href} className="cc-card-paper cc-hover" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            background: "oklch(0.22 0.045 258 / 0.06)",
            display: "grid",
            placeItems: "center"
          }}
        >
          <Icon size={14} color="oklch(0.22 0.045 258 / 0.7)" />
        </div>
        <span
          className={`cc-pill${
            status.displayStatus === "connected" ? " cc-connected" : status.displayStatus === "configured" ? " cc-configured" : ""
          }`}
        >
          {status.label}
        </span>
      </div>
      <h3 className="cc-eyebrow">{label}</h3>
    </Link>
  );
}
