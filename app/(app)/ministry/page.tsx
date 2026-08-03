import { GuestMinistryNarrativeHub } from "@/components/guest-ministry-narrative-hub";
import { MinistryAlignmentWorkspace } from "@/components/ministry-alignment-workspace";
import { PageIntro, QuietState, StatusBadge } from "@/components/platform-ui";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { buildGuestMinistryNarratives } from "@/lib/guest/ministry-narratives";
import { defaultMinistryAlignmentProfile } from "@/lib/ministry/alignment";
import { buildAuthenticatedMinistryNarratives } from "@/lib/ministry/authenticated-narratives";
import { getAuthenticatedMinistryNarrativeContext } from "@/lib/ministry/narrative-repository";

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

  if (access.session.isGuest) {
    return <GuestMinistryNarrativeHub narratives={buildGuestMinistryNarratives()} />;
  }

  try {
    const context = await getAuthenticatedMinistryNarrativeContext(access.session);
    const narratives = buildAuthenticatedMinistryNarratives(context);

    return (
      <section className="ministry-launch-page ministry-conversation-first" aria-labelledby="ministry-hub-title">
        <PageIntro
          eyebrow="Decision center"
          title="Lead with shared context"
          description="Leadership-authored direction, Meridian organizational memory, EMMA conversation, observable signals, and inspectable evidence in one discernment workspace."
          actions={<StatusBadge tone="info">Architecture Evolution - Phase 1-3</StatusBadge>}
        />
        <MinistryAlignmentWorkspace
          initialProfile={defaultMinistryAlignmentProfile}
          narratives={narratives}
          overview={context.overview}
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
