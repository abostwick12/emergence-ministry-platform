import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { listIntegrations } from "@/lib/command-center/repository";
import { INTEGRATION_CATALOG, integrationDisplayStatus, isIntegrationConfigured } from "@/lib/command-center/integrations-meta";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const stored = await listIntegrations(access.session);
  const storedByService = new Map(stored.map((integration) => [integration.service, integration]));

  const integrations = INTEGRATION_CATALOG.map((meta) => {
    const storedStatus = storedByService.get(meta.service)?.status ?? "disconnected";
    return {
      service: meta.service,
      label: meta.label,
      description: meta.description,
      phase: meta.phase,
      priority: meta.priority,
      capabilities: meta.capabilities,
      requiredEnv: meta.requiredEnv,
      configured: isIntegrationConfigured(meta.service),
      status: storedStatus,
      displayStatus: integrationDisplayStatus({ service: meta.service, storedStatus })
    };
  }).sort((a, b) => a.priority - b.priority);

  return NextResponse.json({ integrations });
}
