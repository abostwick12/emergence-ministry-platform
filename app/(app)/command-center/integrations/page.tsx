import { GoogleCalendarConnection } from "@/components/command-center/google-calendar-connection";
import { getServerSession } from "@/lib/auth/server";
import { listIntegrations } from "@/lib/command-center/repository";
import { INTEGRATION_CATALOG, integrationDisplayStatus, type IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

const STATUS_LABELS: Record<IntegrationDisplayStatus, string> = {
  not_configured: "Not configured",
  configured: "Configured — connecting later",
  connected: "Connected"
};

const PHASE_LABELS: Record<string, string> = {
  phase_2: "Phase 2",
  phase_3: "Phase 3"
};

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Google Calendar connected. SAGE can now read upcoming events.",
  error: "Google Calendar connection failed. Try connecting again."
};

export default async function CommandCenterIntegrationsPage({
  searchParams
}: {
  searchParams?: { google_calendar?: string };
}) {
  const session = await getServerSession();
  if (!session) return null;
  const stored = await listIntegrations(session);
  const storedByService = new Map(stored.map((integration) => [integration.service, integration]));

  const catalog = [...INTEGRATION_CATALOG].sort((a, b) => a.priority - b.priority);
  const callbackMessage = searchParams?.google_calendar ? CALLBACK_MESSAGES[searchParams.google_calendar] : undefined;

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Integrations</p>
        <h2 className="section-title flush">Connected Tools</h2>
        <p className="muted">
          Integrations are added one at a time. Google Calendar is the first live connection (read-only); every
          other card below remains an inert placeholder until it is wired the same way, with Andrew&rsquo;s explicit
          confirmation before it goes live.
        </p>
        {callbackMessage ? <p className="muted">{callbackMessage}</p> : null}
      </section>
      <div className="grid grid-3">
        {catalog.map((meta) => {
          const storedStatus = storedByService.get(meta.service)?.status ?? "disconnected";
          const displayStatus = integrationDisplayStatus({ service: meta.service, storedStatus });

          return (
            <section className="panel" key={meta.service}>
              <p className="eyebrow">{meta.label}</p>
              <h3 className="section-title flush">{STATUS_LABELS[displayStatus]}</h3>
              <p className="muted">{meta.description}</p>
              <p className="muted">
                {PHASE_LABELS[meta.phase] ?? meta.phase} · {meta.capabilities.join(" + ")}
              </p>
              {meta.service === "google_calendar" ? (
                <GoogleCalendarConnection displayStatus={displayStatus} />
              ) : (
                <button className="button" type="button" disabled>
                  Not active yet
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
