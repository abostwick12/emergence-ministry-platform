import { getServerSession } from "@/lib/auth/server";
import { listIntegrations } from "@/lib/command-center/repository";

const INTEGRATION_LABELS: Record<string, string> = {
  firecrawl: "Firecrawl",
  slack: "Slack",
  google_calendar: "Google Calendar",
  gmail: "Gmail",
  google_drive: "Google Drive",
  linkedin: "LinkedIn",
  monday: "Monday.com"
};

const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  firecrawl: "Gather a curated daily resource feed.",
  slack: "Send notifications and daily briefings to Slack.",
  google_calendar: "Read your schedule and create events from tasks.",
  gmail: "Triage recent email and draft replies for review.",
  google_drive: "Search for relevant documents during conversations.",
  linkedin: "Draft posts and outreach messages for your network.",
  monday: "Sync personal tasks with your Monday.com boards."
};

export default async function CommandCenterIntegrationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const integrations = await listIntegrations(session);

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Integrations</p>
        <h2 className="section-title flush">Connected Tools</h2>
        <p className="muted">Phase 1 ships the status view and access gates. Live connections activate in Phase 2.</p>
      </section>
      <div className="grid grid-3">
        {integrations.map((integration) => (
          <section className="panel" key={integration.service}>
            <p className="eyebrow">{INTEGRATION_LABELS[integration.service] ?? integration.service}</p>
            <h3 className="section-title flush">{integration.status === "connected" ? "Connected" : "Not connected"}</h3>
            <p className="muted">{INTEGRATION_DESCRIPTIONS[integration.service]}</p>
            <button className="button" type="button" disabled>
              Coming in Phase 2
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
