import {
  DecisionMetricGrid,
  DecisionSignalList,
  EvidenceStack,
  JudgedIntegrationFlowList,
  LeadershipAttentionList
} from "@/components/decision-center";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, PageIntro, QuietState, StatusBadge } from "@/components/platform-ui";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { buildMinistryDecisionCenterState } from "@/lib/decision-center/ministry";
import { getOverview } from "@/lib/data/ministry-repository";

const ministryHubPrompts = [
  "What is the ministry telling us?",
  "Where should we focus next?",
  "If we add another event, what breaks?",
  "What evidence supports that?",
  "How healthy are our volunteers?"
] as const;

export default async function MinistryHubPage() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) {
    return (
      <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Ministry Hub"
          title="Ministry Decision Center"
          description="Ministry workspace access could not be verified."
          actions={<StatusBadge tone="warning">Access needed</StatusBadge>}
        />
      </section>
    );
  }

  try {
    const overview = await getOverview(access.session);
    const center = buildMinistryDecisionCenterState(overview);

    return (
      <section className="ministry-launch-page ministry-conversation-first" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Ministry Hub"
          title="Ministry Hub"
          description="Decision conversations for ministry direction, evidence, and next steps. EMMA helps leaders discover what matters before the page asks them to read a dashboard."
          actions={<StatusBadge tone="info">Architecture Evolution - Phase 1-3</StatusBadge>}
        />

        <EditorialSection eyebrow="Current Ministry Direction" title={center.direction.emphasis} description={`${center.direction.horizon} - next major focus: Fall Launch. Owner: ${center.direction.owner}.`}>
          <MinistryEmmaPanel
            defaultExpanded
            overview={overview}
            page="dashboard"
            title="Ask EMMA"
            promptTemplates={ministryHubPrompts}
            staticSignals={center.signals.map((signal) => `${signal.title}: ${signal.summary}`)}
          />
        </EditorialSection>

        <EditorialSection eyebrow="Conversation Support" title="Evidence appears when the conversation needs it" description="Metrics, signals, and proof stay available, but they support EMMA's decision conversation instead of leading the page.">
          <div className="decision-support-list">
            <details className="decision-support-disclosure">
              <summary>
                <strong>Current snapshot</strong>
                <StatusBadge tone="info">4 measures</StatusBadge>
              </summary>
              <DecisionMetricGrid metrics={center.metrics} />
            </details>

            <details className="decision-support-disclosure">
              <summary>
                <strong>Verified signals</strong>
                <StatusBadge tone="success">{center.signals.length} available</StatusBadge>
              </summary>
              <DecisionSignalList signals={center.signals} />
            </details>

            <details className="decision-support-disclosure">
              <summary>
                <strong>Leadership attention</strong>
                <StatusBadge tone="gold">{center.attention.length} prompts</StatusBadge>
              </summary>
              <LeadershipAttentionList items={center.attention} />
            </details>

            <details className="decision-support-disclosure">
              <summary>
                <strong>Evidence drawers</strong>
                <StatusBadge tone="info">source visible</StatusBadge>
              </summary>
              <EvidenceStack signals={center.signals} />
            </details>

            <details className="decision-support-disclosure">
              <summary>
                <strong>Judged YouVersion and Gloo flow</strong>
                <StatusBadge tone="info">provider path</StatusBadge>
              </summary>
              <JudgedIntegrationFlowList flows={center.judgedIntegrationFlows} />
            </details>
          </div>
        </EditorialSection>
      </section>
    );
  } catch {
    return (
      <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Ministry Hub"
          title="Ministry Decision Center"
          description="Current ministry signals could not be loaded."
          actions={<StatusBadge tone="warning">Needs data</StatusBadge>}
        />
        <QuietState title="Decision center unavailable">
          Open Events, Tasks, Communications, or Budget directly while the decision-center snapshot is unavailable.
        </QuietState>
      </section>
    );
  }
}
