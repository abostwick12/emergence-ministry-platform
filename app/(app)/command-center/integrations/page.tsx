import type { ComponentType } from "react";
import { GmailConnection } from "@/components/command-center/gmail-connection";
import { GoogleCalendarConnection } from "@/components/command-center/google-calendar-connection";
import { getServerSession } from "@/lib/auth/server";
import { listIntegrations } from "@/lib/command-center/repository";
import {
  INTEGRATION_CATALOG,
  integrationDisplayStatus,
  type IntegrationDisplayStatus
} from "@/lib/command-center/integrations-meta";
import type { IntegrationService } from "@/lib/command-center/types";

const STATUS_LABELS: Record<IntegrationDisplayStatus, string> = {
  not_configured: "Not configured",
  configured: "Configured — connecting later",
  connected: "Connected"
};

const PHASE_LABELS: Record<string, string> = {
  phase_2: "Phase 2",
  phase_3: "Phase 3"
};

// Live connect/disconnect controls, added one integration at a time. Every
// service not listed here still shows the disabled "Not active yet" button.
const CONNECTION_COMPONENTS: Partial<Record<IntegrationService, ComponentType<{ displayStatus: IntegrationDisplayStatus }>>> = {
  google_calendar: GoogleCalendarConnection,
  gmail: GmailConnection
};

const CALLBACK_MESSAGES: Record<string, Record<string, string>> = {
  google_calendar: {
    connected: "Google Calendar connected. SAGE can now read upcoming events.",
    error: "Google Calendar connection failed. Try connecting again."
  },
  gmail: {
    connected: "Gmail connected for read-only triage and draft-only replies.",
    error: "Gmail connection failed. Try connecting again."
  }
};

export default async function CommandCenterIntegrationsPage({
  searchParams
}: {
  searchParams?: { google_calendar?: string; gmail?: string };
}) {
  const session = await getServerSession();
  if (!session) return null;
  const stored = await listIntegrations(session);
  const storedByService = new Map(stored.map((integration) => [integration.service, integration]));

  const catalog = [...INTEGRATION_CATALOG].sort((a, b) => a.priority - b.priority);
  const callbackMessages = [
    searchParams?.google_calendar ? CALLBACK_MESSAGES.google_calendar[searchParams.google_calendar] : undefined,
    searchParams?.gmail ? CALLBACK_MESSAGES.gmail[searchParams.gmail] : undefined
  ].filter((message): message is string => Boolean(message));

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Integrations</p>
        <h2 className="section-title flush">Connected Tools</h2>
        <p className="muted">
          Integrations are added one at a time. Google Calendar and Gmail are live connections now (read-only, plus
          draft-only replies for Gmail); every other card below remains an inert placeholder until it is wired the
          same way, with Andrew&rsquo;s explicit confirmation before it goes live.
        </p>
        {callbackMessages.map((message) => (
          <p className="muted" key={message}>
            {message}
          </p>
        ))}
      </section>
      <div className="grid grid-3">
        {catalog.map((meta) => {
          const storedStatus = storedByService.get(meta.service)?.status ?? "disconnected";
          const displayStatus = integrationDisplayStatus({ service: meta.service, storedStatus });
          const Connection = CONNECTION_COMPONENTS[meta.service];

          return (
            <section className="panel" key={meta.service}>
              <p className="eyebrow">{meta.label}</p>
              <h3 className="section-title flush">{STATUS_LABELS[displayStatus]}</h3>
              <p className="muted">{meta.description}</p>
              <p className="muted">
                {PHASE_LABELS[meta.phase] ?? meta.phase} · {meta.capabilities.join(" + ")}
              </p>
              {Connection ? (
                <Connection displayStatus={displayStatus} />
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
