// Static integration catalog for the Personal Command Center.
//
// This is metadata only: safe display labels, descriptions, phases, and
// which env vars gate each integration. It never reads or exposes secret
// values, only whether the required env vars are present. See
// docs/architecture/command-center-integrations.md for the full readiness
// plan, priority order, and approval rules this catalog implements.

import type { IntegrationService } from "@/lib/command-center/types";

export type IntegrationCapability = "read" | "write";

export type IntegrationPhase = "phase_2" | "phase_3";

export interface IntegrationMeta {
  service: IntegrationService;
  label: string;
  description: string;
  phase: IntegrationPhase;
  priority: number;
  capabilities: IntegrationCapability[];
  requiredEnv: string[];
  requiresAndrewConfirmation: boolean;
  autonomous: boolean;
}

// Priority order matches docs/architecture/command-center-integrations.md.
export const INTEGRATION_CATALOG: IntegrationMeta[] = [
  {
    service: "google_calendar",
    label: "Google Calendar",
    description: "Read Andrew's schedule to inform SAGE's daily briefing and task planning.",
    phase: "phase_2",
    priority: 1,
    capabilities: ["read"],
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "gmail",
    label: "Gmail",
    description: "Read recent email for triage context and draft replies for Andrew to review. SAGE never sends email.",
    phase: "phase_2",
    priority: 2,
    capabilities: ["read", "write"],
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "google_drive",
    label: "Google Drive",
    description: "Search for relevant documents to bring into SAGE conversations. Read-only.",
    phase: "phase_2",
    priority: 3,
    capabilities: ["read"],
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "slack",
    label: "Slack",
    description: "Push daily briefings and notifications to a private Slack channel Andrew controls.",
    phase: "phase_2",
    priority: 4,
    capabilities: ["write"],
    requiredEnv: ["COMMAND_CENTER_SLACK_WEBHOOK_URL"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "firecrawl",
    label: "Firecrawl",
    description: "Crawl curated sources to build the daily resource and briefing feed.",
    phase: "phase_2",
    priority: 5,
    capabilities: ["read"],
    requiredEnv: ["FIRECRAWL_API_KEY"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "monday",
    label: "Monday.com",
    description: "Sync personal tasks with Andrew's Monday.com boards.",
    phase: "phase_3",
    priority: 6,
    capabilities: ["read", "write"],
    requiredEnv: ["MONDAY_API_TOKEN"],
    requiresAndrewConfirmation: true,
    autonomous: false
  },
  {
    service: "linkedin",
    label: "LinkedIn",
    description: "Draft posts and outreach messages for Andrew's job search. SAGE never posts or sends on Andrew's behalf.",
    phase: "phase_3",
    priority: 7,
    capabilities: ["write"],
    requiredEnv: [],
    requiresAndrewConfirmation: true,
    autonomous: false
  }
];

export function integrationMeta(service: IntegrationService): IntegrationMeta {
  const meta = INTEGRATION_CATALOG.find((entry) => entry.service === service);
  if (!meta) throw new Error(`Unknown integration service: ${service}`);
  return meta;
}

// True only when every required env var is present. Never reads or returns
// the values themselves. LinkedIn has no requiredEnv because Phase 1 scaffolding
// includes no LinkedIn API integration (draft-only, nothing to configure yet).
export function isIntegrationConfigured(service: IntegrationService, env: NodeJS.ProcessEnv = process.env): boolean {
  const meta = integrationMeta(service);
  if (meta.requiredEnv.length === 0) return false;
  return meta.requiredEnv.every((key) => Boolean(env[key]?.trim()));
}

export type IntegrationDisplayStatus = "not_configured" | "configured" | "connected";

export function integrationDisplayStatus(params: {
  service: IntegrationService;
  storedStatus: "connected" | "disconnected" | "error";
  env?: NodeJS.ProcessEnv;
}): IntegrationDisplayStatus {
  if (!isIntegrationConfigured(params.service, params.env)) return "not_configured";
  return params.storedStatus === "connected" ? "connected" : "configured";
}
