import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { ScriptureKnowledgeControlRoom } from "@/components/student/scripture-knowledge-control-room";
import { ScriptureLeaderReview } from "@/components/student/scripture-leader-review";
import { ScriptureTrialInsightsPanel } from "@/components/student/scripture-trial-insights";
import { StudentCuratedResourceManager } from "@/components/student/student-curated-resource-manager";
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

  const state = await getStudentDiscussionWorkflowState(access.session);
  const groupState = await getStudentGroupLeaderState(access.session, getRequestOrigin());
  const knowledgeState = await getKnowledgeControlRoomState(access.session);
  const curatedResourceState = await getStudentCuratedResourceState(access.session, { includeInactive: true });
  const trialInsights = await getScriptureTrialInsights(access.session, state);
  return (
    <div className="discipleship-workspace-stack">
      <ScriptureTrialInsightsPanel groupState={groupState} insights={trialInsights} />
      <ScriptureKnowledgeControlRoom initialDiscussionState={state} initialState={knowledgeState} />
      <StudentCuratedResourceManager canManageVideoEmbeds={access.role === "admin"} initialState={curatedResourceState} />
      <ScriptureLeaderReview initialGroupState={groupState} initialState={state} />
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
