import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { ScriptureKnowledgeControlRoom } from "@/components/student/scripture-knowledge-control-room";
import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { ScriptureTrialInsightsPanel } from "@/components/student/scripture-trial-insights";
import { StudentCuratedResourceManager } from "@/components/student/student-curated-resource-manager";
import { EditorialSection, PageIntro } from "@/components/platform-ui";
import { getServerSession } from "@/lib/auth/server";
import { getStudentCuratedResourceState } from "@/lib/scripture/curated-resources";
import { getKnowledgeControlRoomState } from "@/lib/scripture/knowledge-control-room";
import { getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { getScriptureTrialInsights } from "@/lib/scripture/trial-insights";
import { resolveStudentHubAccess } from "@/lib/student/access";
import { getStudentGroupLeaderState } from "@/lib/student/groups";

export default async function DiscipleshipPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    redirect(access.destination);
  }

  if (access.role === "student") {
    redirect("/student");
  }

  const requestOrigin = getRequestOrigin();
  const [state, groupState, knowledgeState, curatedResourceState] = await Promise.all([
    getStudentDiscussionWorkflowState(access.session),
    getStudentGroupLeaderState(access.session, requestOrigin),
    getKnowledgeControlRoomState(access.session),
    getStudentCuratedResourceState(access.session, { includeInactive: true })
  ]);
  const trialInsights = await getScriptureTrialInsights(access.session, state);
  return (
    <div className="discipleship-workspace-stack">
      <PageIntro
        eyebrow="Discipleship"
        title="Care, formation, and contribution"
        description="Begin with real student-care and review work. Formation signals and administrative tools follow in the order leaders use them."
      />
      <EditorialSection eyebrow="Care" title="Student care and review" description="Questions needing review, pastoral attention, and a prepared next conversation stay dominant." accent="cyan">
        <ScriptureLeaderReview initialGroupState={groupState} initialState={state} />
      </EditorialSection>
      <EditorialSection eyebrow="Formation" title="Formation signals" description="See what students are asking, where Scripture is surfacing, and whether next steps are being saved." accent="gold">
        <ScriptureTrialInsightsPanel groupState={groupState} insights={trialInsights} />
      </EditorialSection>
      <EditorialSection eyebrow="Contribution" title="Advanced administration" description="Knowledge imports, resource packaging, launch diagnostics, and video controls remain available without competing with care work.">
        <details className="formation-advanced-workspace">
          <summary>Open knowledge and resource administration</summary>
          <div className="formation-advanced-stack">
            <ScriptureKnowledgeControlRoom initialDiscussionState={state} initialState={knowledgeState} />
            <StudentCuratedResourceManager canManageVideoEmbeds={access.role === "admin"} initialState={curatedResourceState} />
          </div>
        </details>
      </EditorialSection>
    </div>
  );
}

function getRequestOrigin() {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return "";

  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
