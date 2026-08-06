"use client";

import { Check, Copy, KeyRound, ShieldCheck, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MeridianConnectionResponse = {
  available?: boolean;
  endpoint?: string;
  canManage?: boolean;
  oauthReady?: boolean;
  grant?: MeridianGrant | null;
  oauthGrants?: Array<{ clientId: string; clientName: string; clientUri: string; scopes: string[]; grantedAt: string }>;
  error?: string;
};

type MeridianGrant = {
  enabled: boolean;
  canSearch: boolean;
  canSaveDrafts: boolean;
  canSubmitCandidates: boolean;
  canReadPlatform: boolean;
  canManageEvents: boolean;
  canManageTasks: boolean;
  canSaveResources: boolean;
  canReviewResources: boolean;
  pilotStage: PilotStage;
  accessLevel: string | null;
};

type PilotStage = "not_enrolled" | "admin_pilot" | "leader_pilot";
type PilotMember = {
  userId: string;
  name: string;
  role: "admin" | "leader";
  grantEnabled: boolean;
  pilotStage: PilotStage;
  canReadPlatform: boolean;
  canManageEvents: boolean;
  canManageTasks: boolean;
  canSaveResources: boolean;
  canReviewResources: boolean;
};
type PilotMetrics = {
  windowDays: number;
  cohort: { admins: number; leaders: number };
  calls: number;
  successfulCalls: number;
  rejectedCalls: number;
  failedCalls: number;
  duplicateSafeReplays: number;
  privacyBlocks: number;
  placementVerifiedWrites: number;
  successfulWrites: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  reviewOutcomes: { ready: number; changesRequired: number; blocked: number };
  feedback: { responses: number; useful: number; mixed: number; notUseful: number; placementCorrect: number; groundingHelpful: number; privacyConcerns: number; duplicateWriteIncidents: number };
};
type PilotReview = {
  reviewId: string;
  bundleId: string;
  bundleTitle: string;
  destinationType: "event" | "weekly_leader_prep";
  destinationId: string;
  outcome: "ready_for_human_review" | "changes_required" | "blocked";
  summary: string;
  humanReviewStatus: "pending";
  createdAt: string;
  feedback: null | {
    usefulness: "useful" | "mixed" | "not_useful";
    placementCorrect: boolean;
    groundingHelpful: boolean;
    privacyHandling: "correct" | "concern" | "not_applicable";
    issueCodes: string[];
    createdAt: string;
  };
};
type PilotDashboard = {
  available?: boolean;
  isAdmin?: boolean;
  pilotStage?: PilotStage;
  members?: PilotMember[];
  metrics?: PilotMetrics | null;
  reviews?: PilotReview[];
  error?: string;
};
type FeedbackDraft = {
  usefulness: "useful" | "mixed" | "not_useful";
  placementCorrect: boolean;
  groundingHelpful: boolean;
  privacyHandling: "correct" | "concern" | "not_applicable";
  issueCode: "" | "wrong_destination" | "weak_grounding" | "citation_problem" | "privacy_concern" | "permission_concern" | "theology_concern" | "audience_mismatch" | "too_many_false_positives" | "duplicate_write";
};

type GrantPermissions = Pick<MeridianGrant, "canSaveDrafts" | "canSubmitCandidates" | "canReadPlatform" | "canManageEvents" | "canManageTasks" | "canSaveResources" | "canReviewResources">;

export function MeridianPersonalAiPanel({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<MeridianConnectionResponse>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pilot, setPilot] = useState<PilotDashboard>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/meridian-mcp", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as MeridianConnectionResponse;
      if (!response.ok) setMessage({ tone: "error", text: payload.error ?? "Personal AI settings could not be loaded." });
      setState(payload);
      const pilotResponse = await fetch("/api/settings/meridian-mcp/pilot", { cache: "no-store" });
      const pilotPayload = (await pilotResponse.json().catch(() => ({}))) as PilotDashboard;
      setPilot(pilotResponse.ok || pilotPayload.available === false ? pilotPayload : {});
    } catch {
      setMessage({ tone: "error", text: "Personal AI settings could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveGrant(enabled: boolean, permissions: GrantPermissions) {
    setBusy("grant");
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, ...permissions })
      });
      const payload = (await response.json().catch(() => ({}))) as MeridianConnectionResponse;
      if (!response.ok || !payload.grant) {
        setMessage({ tone: "error", text: payload.error ?? "Meridian access could not be updated." });
        return;
      }
      setState((current) => ({ ...current, grant: payload.grant }));
      setMessage({ tone: "success", text: enabled ? "Your Meridian access grant is ready." : "Your Meridian tool access is disabled." });
    } catch {
      setMessage({ tone: "error", text: "Meridian access could not be updated." });
    } finally {
      setBusy("");
    }
  }

  async function revoke(clientId: string, clientName: string) {
    if (!window.confirm(`Disconnect ${clientName} from your Lead Emergence account?`)) return;
    setBusy(clientId);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "The AI connection could not be revoked." });
        return;
      }
      setState((current) => ({ ...current, oauthGrants: current.oauthGrants?.filter((grant) => grant.clientId !== clientId) }));
      setMessage({ tone: "success", text: `${clientName} was disconnected.` });
    } catch {
      setMessage({ tone: "error", text: "The AI connection could not be revoked." });
    } finally {
      setBusy("");
    }
  }

  async function updatePilotMember(member: PilotMember, pilotStage: PilotStage) {
    setBusy(`pilot-member-${member.userId}`);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp/pilot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, pilotStage })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Pilot enrollment could not be updated." });
        return;
      }
      await load();
      setMessage({ tone: "success", text: pilotStage === "not_enrolled" ? `${member.name} was removed from the platform pilot.` : `${member.name} is enrolled in the ${member.role} pilot.` });
    } catch {
      setMessage({ tone: "error", text: "Pilot enrollment could not be updated." });
    } finally {
      setBusy("");
    }
  }

  async function savePilotFeedback(review: PilotReview) {
    const draft = feedbackDrafts[review.reviewId] ?? defaultFeedbackDraft();
    setBusy(`pilot-feedback-${review.reviewId}`);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.reviewId,
          idempotencyKey: `pilot-feedback-${crypto.randomUUID()}`,
          usefulness: draft.usefulness,
          placementCorrect: draft.placementCorrect,
          groundingHelpful: draft.groundingHelpful,
          privacyHandling: draft.privacyHandling,
          issueCodes: draft.issueCode ? [draft.issueCode] : []
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Pilot feedback could not be saved." });
        return;
      }
      await load();
      setMessage({ tone: "success", text: "Pilot feedback was saved without changing the human review decision." });
    } catch {
      setMessage({ tone: "error", text: "Pilot feedback could not be saved." });
    } finally {
      setBusy("");
    }
  }

  async function copyEndpoint() {
    if (!state.endpoint) return;
    try {
      await navigator.clipboard.writeText(state.endpoint);
      setMessage({ tone: "success", text: "Meridian MCP address copied." });
    } catch {
      setMessage({ tone: "error", text: "Copy failed. Select the address and copy it manually." });
    }
  }

  const grant = state.grant;
  const permissions = grantPermissions(grant);
  const connections = state.oauthGrants ?? [];
  return (
    <section className="website-access-panel meridian-personal-ai-panel" id="meridian-personal-ai" aria-labelledby="meridian-personal-ai-title">
      <header className="website-access-heading meridian-personal-ai-heading">
        <div>
          <p className="eyebrow">Personal AI connection</p>
          <h2 id="meridian-personal-ai-title">Bring Codex to Meridian</h2>
          <p>Codex uses your personal AI membership. Lead Emergence supplies approved knowledge and guardrails; it does not pay for the model conversation.</p>
        </div>
        <span className={`status-badge ${grant?.enabled ? "tone-success" : "tone-info"}`}><ShieldCheck aria-hidden="true" size={14} />{grant?.enabled ? "Access granted" : "Not granted"}</span>
      </header>

      <div className="meridian-personal-ai-grid">
        <div className="meridian-personal-ai-step">
          <span>1</span><div><strong>Grant Meridian access</strong><p>This is separate from OAuth and remains under ministry control.</p></div>
          {canManage ? (
            <div className="meridian-personal-ai-actions">
              <button className="button" type="button" disabled={loading || busy === "grant"} onClick={() => void saveGrant(!grant?.enabled, permissions)}>{grant?.enabled ? "Disable tools" : "Enable approved search"}</button>
              {grant?.enabled ? (
                <div className="meridian-personal-ai-permissions" aria-label="Personal AI permissions">
                  <label><input type="checkbox" checked={grant.canSaveDrafts} disabled={busy === "grant"} onChange={(event) => void saveGrant(true, { ...permissions, canSaveDrafts: event.target.checked })} /> Allow review-only Meridian draft submission</label>
                  <label><input type="checkbox" checked={grant.canSubmitCandidates} disabled={busy === "grant"} onChange={(event) => void saveGrant(true, { ...permissions, canSubmitCandidates: event.target.checked })} /> Allow confirmed private-note nominations for admin review</label>
                  <label><input type="checkbox" checked={grant.canReadPlatform} disabled={busy === "grant"} onChange={(event) => void saveGrant(true, {
                    ...permissions,
                    canReadPlatform: event.target.checked,
                    ...(!event.target.checked ? { canManageEvents: false, canManageTasks: false, canSaveResources: false, canReviewResources: false } : {})
                  })} /> Allow event, task, team, and resource viewing</label>
                  <label><input type="checkbox" checked={grant.canManageEvents} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canManageEvents: event.target.checked })} /> Allow confirmed event creation and editing</label>
                  <label><input type="checkbox" checked={grant.canManageTasks} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canManageTasks: event.target.checked })} /> Allow confirmed task creation and editing</label>
                  <label><input type="checkbox" checked={grant.canSaveResources} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canSaveResources: event.target.checked })} /> Allow private resource bundles for review</label>
                  <label><input type="checkbox" checked={grant.canReviewResources} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canReviewResources: event.target.checked })} /> Allow confirmed EMMA bundle review</label>
                </div>
              ) : null}
            </div>
          ) : <p className="muted">An administrator must grant this access.</p>}
        </div>

        <div className="meridian-personal-ai-step">
          <span>2</span><div><strong>Add the MCP server in Codex</strong><p>Use this address as a Streamable HTTP MCP server, then choose Authenticate.</p></div>
          <div className="meridian-personal-ai-endpoint"><code>{state.endpoint ?? "Loading secure address..."}</code><button type="button" aria-label="Copy Meridian MCP address" disabled={!state.endpoint} onClick={() => void copyEndpoint()}><Copy aria-hidden="true" /></button></div>
        </div>

        <div className="meridian-personal-ai-step">
          <span>3</span><div><strong>Approve the secure sign-in</strong><p>OAuth proves who you are. Your Meridian grant decides what Codex may do.</p></div>
          <p className="meridian-personal-ai-boundary"><KeyRound aria-hidden="true" /> Vault discovery stays local. Draft checks retain hashes only; an explicitly nominated note enters the private admin review queue.</p>
        </div>
      </div>

      {pilot.available ? (
        <div className="meridian-pilot" aria-labelledby="meridian-pilot-title">
          <div className="meridian-pilot-heading">
            <div>
              <p className="eyebrow">Controlled rollout</p>
              <h3 id="meridian-pilot-title">Platform MCP pilot</h3>
              <p>Platform tools stay behind an administrator-managed cohort gate. Metrics retain IDs, counts, outcomes, and timing only—never prompts, draft bodies, note text, or pastoral details.</p>
            </div>
            <span className={`status-badge ${pilot.pilotStage && pilot.pilotStage !== "not_enrolled" ? "tone-success" : "tone-info"}`}>
              {pilotStageLabel(pilot.pilotStage ?? grant?.pilotStage ?? "not_enrolled")}
            </span>
          </div>

          {pilot.isAdmin && pilot.metrics ? (
            <>
              <div className="meridian-pilot-metrics" aria-label="Last 30 days of MCP pilot metrics">
                {pilotMetricEntries(pilot.metrics).map((metric) => <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></div>)}
              </div>

              <div className="meridian-pilot-members">
                <h4>Pilot cohort</h4>
                <p>Leaders enter read-only by default. Write capabilities remain separately granted, and removing someone immediately disables all platform capabilities.</p>
                {(pilot.members ?? []).map((member) => {
                  const enrolledStage = member.role === "admin" ? "admin_pilot" : "leader_pilot";
                  return (
                    <div key={member.userId}>
                      <span><strong>{member.name}</strong><small>{member.role} · {pilotStageLabel(member.pilotStage)}</small></span>
                      <button
                        className="button"
                        type="button"
                        disabled={busy === `pilot-member-${member.userId}`}
                        onClick={() => void updatePilotMember(member, member.pilotStage === "not_enrolled" ? enrolledStage : "not_enrolled")}
                      >
                        {member.pilotStage === "not_enrolled" ? "Enroll" : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {(pilot.reviews ?? []).length ? (
            <div className="meridian-pilot-reviews">
              <h4>Human usefulness check</h4>
              <p>Feedback evaluates EMMA’s review; it does not approve, reject, publish, or send the bundle.</p>
              {(pilot.reviews ?? []).map((review) => {
                const draft = feedbackDrafts[review.reviewId] ?? defaultFeedbackDraft();
                return (
                  <article key={review.reviewId}>
                    <header>
                      <span><strong>{review.bundleTitle}</strong><small>{reviewOutcomeLabel(review.outcome)} · {new Date(review.createdAt).toLocaleDateString()}</small></span>
                      <a className="button" href={pilotReviewUrl(review)}>Open workspace</a>
                    </header>
                    <p>{review.summary}</p>
                    {review.feedback ? <p className="auth-success">Feedback recorded {new Date(review.feedback.createdAt).toLocaleDateString()}. You may submit a corrected evaluation below; history is retained.</p> : null}
                    <div className="meridian-pilot-feedback">
                      <label>Usefulness<select value={draft.usefulness} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [review.reviewId]: { ...draft, usefulness: event.target.value as FeedbackDraft["usefulness"] } }))}><option value="useful">Useful</option><option value="mixed">Mixed</option><option value="not_useful">Not useful</option></select></label>
                      <label>Privacy handling<select value={draft.privacyHandling} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [review.reviewId]: { ...draft, privacyHandling: event.target.value as FeedbackDraft["privacyHandling"] } }))}><option value="correct">Correct</option><option value="concern">Concern</option><option value="not_applicable">Not applicable</option></select></label>
                      <label>Primary issue<select value={draft.issueCode} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [review.reviewId]: { ...draft, issueCode: event.target.value as FeedbackDraft["issueCode"] } }))}><option value="">None</option><option value="wrong_destination">Wrong destination</option><option value="weak_grounding">Weak grounding</option><option value="citation_problem">Citation problem</option><option value="privacy_concern">Privacy concern</option><option value="permission_concern">Permission concern</option><option value="theology_concern">Theology concern</option><option value="audience_mismatch">Audience mismatch</option><option value="too_many_false_positives">Too many false positives</option><option value="duplicate_write">Duplicate write</option></select></label>
                      <label className="meridian-pilot-check"><input type="checkbox" checked={draft.placementCorrect} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [review.reviewId]: { ...draft, placementCorrect: event.target.checked } }))} /> Correct workspace placement</label>
                      <label className="meridian-pilot-check"><input type="checkbox" checked={draft.groundingHelpful} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [review.reviewId]: { ...draft, groundingHelpful: event.target.checked } }))} /> Grounding review was helpful</label>
                      <button className="button" type="button" disabled={busy === `pilot-feedback-${review.reviewId}`} onClick={() => void savePilotFeedback(review)}>Save evaluation</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : canManage && pilot.available === false ? <p className="website-access-notice">The platform MCP pilot remains inactive until its additive migration and matching application release are deliberately activated.</p> : null}

      {connections.length ? (
        <div className="meridian-personal-ai-connections">
          <h3>Authorized AI clients</h3>
          {connections.map((connection) => <div key={connection.clientId}><span><Check aria-hidden="true" /><strong>{connection.clientName}</strong><small>Authorized {new Date(connection.grantedAt).toLocaleDateString()}</small></span><button className="button" type="button" disabled={busy === connection.clientId} onClick={() => void revoke(connection.clientId, connection.clientName)}><Unplug aria-hidden="true" /> Disconnect</button></div>)}
        </div>
      ) : null}
      {state.available === false ? <p className="website-access-notice">Live Supabase authentication is required to connect a personal AI account.</p> : null}
      {state.oauthReady === false ? <p className="website-access-notice">The application is ready, but the Supabase OAuth server still needs its consent URL enabled before Codex can authenticate.</p> : null}
      {message ? <p className={message.tone === "error" ? "auth-error" : "auth-success"} role="status">{message.text}</p> : null}
    </section>
  );
}

function grantPermissions(grant: MeridianGrant | null | undefined): GrantPermissions {
  return {
    canSaveDrafts: Boolean(grant?.canSaveDrafts),
    canSubmitCandidates: Boolean(grant?.canSubmitCandidates),
    canReadPlatform: Boolean(grant?.canReadPlatform),
    canManageEvents: Boolean(grant?.canManageEvents),
    canManageTasks: Boolean(grant?.canManageTasks),
    canSaveResources: Boolean(grant?.canSaveResources),
    canReviewResources: Boolean(grant?.canReviewResources)
  };
}

function defaultFeedbackDraft(): FeedbackDraft {
  return {
    usefulness: "useful",
    placementCorrect: true,
    groundingHelpful: true,
    privacyHandling: "correct",
    issueCode: ""
  };
}

function pilotStageLabel(stage: PilotStage) {
  if (stage === "admin_pilot") return "Admin pilot";
  if (stage === "leader_pilot") return "Leader pilot";
  return "Not enrolled";
}

function reviewOutcomeLabel(outcome: PilotReview["outcome"]) {
  if (outcome === "ready_for_human_review") return "Ready for human review";
  if (outcome === "changes_required") return "Changes required";
  return "Blocked";
}

function pilotReviewUrl(review: PilotReview) {
  return review.destinationType === "event"
    ? `/events?eventId=${encodeURIComponent(review.destinationId)}`
    : "/leader-prep";
}

function pilotMetricEntries(metrics: PilotMetrics) {
  return [
    { label: "Pilot cohort", value: `${metrics.cohort.admins} admin · ${metrics.cohort.leaders} leader` },
    { label: "Successful calls", value: `${metrics.successfulCalls} / ${metrics.calls}` },
    { label: "P95 latency", value: `${Math.round(metrics.p95LatencyMs)} ms` },
    { label: "Verified write placement", value: `${metrics.placementVerifiedWrites} / ${metrics.successfulWrites}` },
    { label: "Duplicate-safe replays", value: String(metrics.duplicateSafeReplays) },
    { label: "Reported duplicate writes", value: String(metrics.feedback.duplicateWriteIncidents) },
    { label: "Privacy blocks", value: String(metrics.privacyBlocks) },
    { label: "Useful reviews", value: `${metrics.feedback.useful} / ${metrics.feedback.responses}` },
    { label: "Review outcomes", value: `${metrics.reviewOutcomes.ready} ready · ${metrics.reviewOutcomes.changesRequired} change · ${metrics.reviewOutcomes.blocked} blocked` }
  ];
}
