import { MinistryAlignmentWorkspace } from "@/components/ministry-alignment-workspace";
import { PageIntro, QuietState, StatusBadge } from "@/components/platform-ui";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getOverview } from "@/lib/data/ministry-repository";
import { defaultMinistryAlignmentProfile } from "@/lib/ministry/alignment";

export default async function MinistryHubPage() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) {
    return (
      <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Access check"
          title="Decision workspace unavailable"
          description="Ministry workspace access could not be verified."
          actions={<StatusBadge tone="warning">Access needed</StatusBadge>}
        />
      </section>
    );
  }

  try {
    const overview = await getOverview(access.session);

    return (
      <section className="ministry-launch-page ministry-conversation-first" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Decision center"
          title="Lead with shared context"
          description="Leadership-authored direction, EMMA conversation, observable signals, and inspectable evidence in one discernment workspace."
          actions={<StatusBadge tone="info">Architecture Evolution - Phase 1-3</StatusBadge>}
        />
        <MinistryAlignmentWorkspace
          generatedAt={new Date().toISOString()}
          initialProfile={defaultMinistryAlignmentProfile}
          overview={overview}
        />
      </section>
    );
  } catch {
    return (
      <section className="placeholder-page editorial-placeholder-page" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Snapshot status"
          title="Decision workspace unavailable"
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
