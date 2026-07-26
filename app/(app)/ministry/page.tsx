import {
  DecisionMetricGrid,
  DecisionSignalList,
  EvidenceStack,
  JudgedIntegrationFlowList,
  LeadershipAttentionList
} from "@/components/decision-center";
import { EditorialSection, PageIntro, QuietState, StatusBadge } from "@/components/platform-ui";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { buildMinistryDecisionCenterState } from "@/lib/decision-center/ministry";
import { getOverview } from "@/lib/data/ministry-repository";

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
      <section className="ministry-launch-page" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Ministry Hub"
          title={center.title}
          description="A leadership view for direction, signals, evidence, and operational next steps without replacing the existing workspaces."
          actions={<StatusBadge tone="info">Architecture Evolution - Phase 1-3</StatusBadge>}
        />

        <EditorialSection eyebrow="Direction" title={center.direction.emphasis} description={`${center.direction.horizon} - owner: ${center.direction.owner}. ${center.direction.reviewedAt}.`}>
          <DecisionMetricGrid metrics={center.metrics} />
        </EditorialSection>

        <EditorialSection eyebrow="Signals" title="What the current ministry data is saying" description="Signals are factual observations from existing events, tasks, budgets, activity, and judged Scripture integration boundaries.">
          <DecisionSignalList signals={center.signals} />
        </EditorialSection>

        <EditorialSection eyebrow="Attention" title="Areas for leadership attention" description="These are review prompts, not automated decisions. Use the linked operational workspace to act.">
          <LeadershipAttentionList items={center.attention} />
        </EditorialSection>

        <EditorialSection eyebrow="Evidence" title="Evidence drawers" description="Each signal keeps the source and boundary visible before anyone treats it as an insight.">
          <EvidenceStack signals={center.signals} />
        </EditorialSection>

        <EditorialSection eyebrow="Competition Proof" title="Judged YouVersion and Gloo flow" description="The architecture keeps the scored integration path visible instead of burying it under generic decision-center language.">
          <JudgedIntegrationFlowList flows={center.judgedIntegrationFlows} />
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
