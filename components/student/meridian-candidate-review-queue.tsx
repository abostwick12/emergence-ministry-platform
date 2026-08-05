"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import type {
  MeridianCandidateApprovalStatus,
  MeridianCandidateReviewItem,
  MeridianPromotionInput
} from "@/lib/meridian/knowledge/repository";

type MeridianCandidateReviewQueueProps = {
  initialCandidates: MeridianCandidateReviewItem[];
};

type ReviewResponse = {
  ok?: boolean;
  error?: string;
  candidateId?: string;
  approvalStatus?: MeridianCandidateApprovalStatus;
  event?: MeridianCandidateReviewItem["reviewEvents"][number];
};

type PromotionResponse = {
  ok?: boolean;
  error?: string;
  sourceId?: string;
  fragmentId?: string;
  claimId?: string;
};

type PromotionPayload = Omit<MeridianPromotionInput, "candidateId">;

const claimPromotionTypes = new Set(["passage", "doctrine", "formation"]);

export function MeridianCandidateReviewQueue({ initialCandidates }: MeridianCandidateReviewQueueProps) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState(
    initialCandidates.length
      ? "Imported candidates remain private and cannot guide answers until an admin completes review."
      : "No imported Meridian candidates are waiting for review."
  );
  const counts = useMemo(() => ({
    unreviewed: candidates.filter((candidate) => candidate.approvalStatus === "unreviewed").length,
    inReview: candidates.filter((candidate) => candidate.approvalStatus === "in_review").length,
    promoted: candidates.filter((candidate) => candidate.approvalStatus === "promoted").length,
    rejected: candidates.filter((candidate) => candidate.approvalStatus === "rejected").length
  }), [candidates]);

  async function submitDecision(candidateId: string, decision: "started_review" | "rejected", rationale: string) {
    setBusyId(candidateId);
    setStatus(decision === "started_review" ? "Starting a governed review..." : "Recording the rejection and rationale...");
    try {
      const response = await fetch(`/api/meridian/knowledge/candidates/${candidateId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rationale })
      });
      const payload = (await response.json()) as ReviewResponse;
      if (!response.ok || !payload.ok || !payload.candidateId || !payload.approvalStatus || !payload.event) {
        setStatus(payload.error ?? "The candidate decision could not be recorded.");
        return;
      }

      setCandidates((current) => current.map((candidate) => candidate.id === payload.candidateId
        ? {
            ...candidate,
            approvalStatus: payload.approvalStatus!,
            reviewedAt: payload.approvalStatus === "rejected" ? payload.event!.createdAt : candidate.reviewedAt,
            reviewEvents: [payload.event!, ...candidate.reviewEvents]
          }
        : candidate));
      setStatus(decision === "started_review"
        ? "Review started. Compare the source, narrow the evidence, and choose the correct governed destination."
        : "Candidate rejected. The reason is preserved in the review history.");
    } catch {
      setStatus("The candidate decision could not be recorded.");
    } finally {
      setBusyId("");
    }
  }

  async function submitPromotion(candidateId: string, payload: PromotionPayload) {
    setBusyId(candidateId);
    setStatus("Promoting one narrowed claim with its exact supporting excerpt...");
    try {
      const response = await fetch(`/api/meridian/knowledge/candidates/${candidateId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as PromotionResponse;
      if (!response.ok || !result.ok || !result.sourceId || !result.claimId) {
        setStatus(result.error ?? "The candidate could not be promoted.");
        return;
      }

      const promotedAt = new Date().toISOString();
      setCandidates((current) => current.map((candidate) => candidate.id === candidateId
        ? {
            ...candidate,
            approvalStatus: "promoted",
            reviewedAt: promotedAt,
            promotedSourceId: result.sourceId,
            reviewEvents: [{
              id: result.claimId!,
              decision: "promoted",
              rationale: payload.rationale,
              createdAt: promotedAt
            }, ...candidate.reviewEvents]
          }
        : candidate));
      setStatus("Claim promoted. Meridian can retrieve only the narrowed claim and exact excerpt that were approved.");
    } catch {
      setStatus("The candidate could not be promoted.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="meridian-candidate-review" aria-label="Meridian candidate review queue">
      <div className="meridian-candidate-review-heading">
        <div>
          <p className="eyebrow">Meridian review gate</p>
          <h2>Review imported knowledge candidates</h2>
          <p>
            Imports are discovery material only. Review the original context, narrow any approved claim to what the evidence supports,
            or reject it with a recorded reason.
          </p>
        </div>
        <div className="meridian-candidate-counts" aria-label="Candidate review counts">
          <CandidateCount label="Waiting" value={counts.unreviewed} />
          <CandidateCount label="In review" value={counts.inReview} />
          <CandidateCount label="Promoted" value={counts.promoted} />
          <CandidateCount label="Rejected" value={counts.rejected} />
        </div>
      </div>

      <p className="leader-review-status" aria-live="polite">{status}</p>

      {candidates.length ? (
        <div className="meridian-candidate-list">
          {candidates.map((candidate) => (
            <CandidateReviewCard
              candidate={candidate}
              isBusy={busyId === candidate.id}
              key={candidate.id}
              onDecision={submitDecision}
              onPromote={submitPromotion}
            />
          ))}
        </div>
      ) : (
        <div className="meridian-candidate-empty">
          <strong>The review queue is clear.</strong>
          <p>New Obsidian material will appear here only after it passes the private candidate-import contract.</p>
        </div>
      )}
    </section>
  );
}

function CandidateCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CandidateReviewCard({
  candidate,
  isBusy,
  onDecision,
  onPromote
}: {
  candidate: MeridianCandidateReviewItem;
  isBusy: boolean;
  onDecision: (candidateId: string, decision: "started_review" | "rejected", rationale: string) => Promise<void>;
  onPromote: (candidateId: string, payload: PromotionPayload) => Promise<void>;
}) {
  const canPromoteClaim = claimPromotionTypes.has(candidate.objectType);
  return (
    <article className="meridian-candidate-card">
      <div className="meridian-candidate-card-heading">
        <div>
          <div className="knowledge-source-tags">
            <span>{candidateTypeLabel(candidate.objectType)}</span>
            <span>{candidate.sensitivity.replace(/_/g, " ")}</span>
            <span className={`meridian-candidate-status ${candidate.approvalStatus}`}>{statusLabel(candidate.approvalStatus)}</span>
          </div>
          <h3>{candidate.title}</h3>
          <p>{candidate.studentSummary || "No summary was supplied with this candidate."}</p>
        </div>
        <small>Imported {formatDate(candidate.createdAt)}</small>
      </div>

      <dl className="meridian-candidate-provenance">
        <div>
          <dt>Vault source</dt>
          <dd>{candidate.sourceUri || "Source path not supplied"}</dd>
        </div>
        <div>
          <dt>Content fingerprint</dt>
          <dd>{candidate.contentHash.slice(0, 12)}</dd>
        </div>
      </dl>

      <CandidateEvidence candidate={candidate} />

      <details className="meridian-candidate-source">
        <summary>Compare the full imported note</summary>
        <pre>{candidate.rawText}</pre>
      </details>

      {candidate.approvalStatus === "unreviewed" ? (
        <div className="meridian-candidate-actions">
          <button
            className="button primary"
            disabled={isBusy}
            onClick={() => onDecision(candidate.id, "started_review", "Opened for source comparison and bounded claim review.")}
            type="button"
          >
            {isBusy ? "Starting review..." : "Start Review"}
          </button>
          <CandidateRejectionForm candidate={candidate} disabled={isBusy} onDecision={onDecision} />
        </div>
      ) : null}

      {candidate.approvalStatus === "in_review" ? (
        <div className="meridian-candidate-decision-grid">
          {canPromoteClaim ? (
            <CandidatePromotionForm candidate={candidate} disabled={isBusy} onPromote={onPromote} />
          ) : (
            <div className="meridian-candidate-route-lock">
              <strong>{candidateTypeLabel(candidate.objectType)} promotion stays locked.</strong>
              <p>{dedicatedRouteMessage(candidate.objectType)}</p>
            </div>
          )}
          <CandidateRejectionForm candidate={candidate} disabled={isBusy} onDecision={onDecision} />
        </div>
      ) : null}

      {candidate.approvalStatus === "promoted" ? (
        <p className="meridian-candidate-terminal green">Promoted through human review. The imported note itself remains separate from approved generation evidence.</p>
      ) : null}
      {candidate.approvalStatus === "rejected" ? (
        <p className="meridian-candidate-terminal red">Rejected. This candidate remains unavailable to Meridian generation.</p>
      ) : null}

      <CandidateReviewHistory events={candidate.reviewEvents} />
    </article>
  );
}

function CandidateEvidence({ candidate }: { candidate: MeridianCandidateReviewItem }) {
  const evidenceGroups = [
    { label: "Proposed claims", values: candidate.claimProposals },
    { label: "Question facets", values: candidate.questionFacets },
    { label: "Question aliases", values: candidate.questionAliases },
    { label: "Scripture locators", values: candidate.scriptureReferences },
    { label: "Prohibited conclusions", values: candidate.prohibitedConclusions }
  ].filter((group) => group.values.length);

  return (
    <div className="meridian-candidate-evidence">
      {evidenceGroups.map((group) => (
        <div key={group.label}>
          <strong>{group.label}</strong>
          <ul>{group.values.map((value) => <li key={value}>{value}</li>)}</ul>
        </div>
      ))}
      {candidate.relationshipProposal ? (
        <div>
          <strong>Proposed relationship</strong>
          <p>{candidate.relationshipProposal.kind}: {candidate.relationshipProposal.from} → {candidate.relationshipProposal.to}</p>
          {candidate.relationshipProposal.rationale ? <p>{candidate.relationshipProposal.rationale}</p> : null}
        </div>
      ) : null}
      {candidate.pastoralPosture ? <p><strong>Pastoral posture:</strong> {candidate.pastoralPosture}</p> : null}
      {candidate.traditionScope ? <p><strong>Tradition scope:</strong> {candidate.traditionScope}</p> : null}
      {candidate.consensusStatus ? <p><strong>Consensus status:</strong> {candidate.consensusStatus}</p> : null}
      {candidate.guardrailRationale ? <p><strong>Guardrail rationale:</strong> {candidate.guardrailRationale}</p> : null}
    </div>
  );
}

function CandidatePromotionForm({
  candidate,
  disabled,
  onPromote
}: {
  candidate: MeridianCandidateReviewItem;
  disabled: boolean;
  onPromote: (candidateId: string, payload: PromotionPayload) => Promise<void>;
}) {
  return (
    <details className="meridian-candidate-decision" open>
      <summary>Narrow and promote one claim</summary>
      <form onSubmit={(event) => submitPromotionForm(event, candidate, onPromote)}>
        <p>Promotion creates one approved claim tied to one exact excerpt. Edit both until they say no more than the source supports.</p>
        <label className="leader-review-field">
          <span>Approved authority</span>
          <select className="input" name="authorityClass" defaultValue="" required>
            <option disabled value="">Choose deliberately</option>
            <option value="approved_teaching">Approved teaching</option>
            <option value="adopted_doctrine">Adopted doctrine</option>
          </select>
        </label>
        <label className="leader-review-field">
          <span>Atomic claim</span>
          <textarea name="claim" defaultValue={candidate.claimProposals[0] ?? ""} required />
        </label>
        <label className="leader-review-field">
          <span>Claim type</span>
          <select className="input" name="claimKind" defaultValue={defaultClaimKind(candidate.objectType)}>
            <option value="doctrinal_position">Doctrinal position</option>
            <option value="interpretation">Interpretation</option>
            <option value="recommendation">Formation recommendation</option>
          </select>
        </label>
        <label className="leader-review-field">
          <span>Exact supporting excerpt</span>
          <textarea name="fragmentText" defaultValue={candidate.rawText.slice(0, 12000)} required />
          <small>Remove frontmatter, unrelated material, and any sentence that is not needed to support this one claim.</small>
        </label>
        <div className="knowledge-source-field-grid">
          <label className="leader-review-field">
            <span>Topics</span>
            <input className="input" name="topics" defaultValue={candidate.topicTags.join(", ")} />
          </label>
          <label className="leader-review-field">
            <span>Scripture locators</span>
            <input className="input" name="scriptureReferences" defaultValue={candidate.scriptureReferences.join(", ")} />
          </label>
        </div>
        <label className="leader-review-field">
          <span>Approval rationale</span>
          <textarea name="rationale" placeholder="Why this exact claim and excerpt are trustworthy, bounded, and useful." required />
        </label>
        <button className="button primary" disabled={disabled} type="submit">
          {disabled ? "Saving decision..." : "Promote Narrowed Claim"}
        </button>
        <small>Conservative defaults: ministry-only, no quotation, paraphrase and citation allowed, external communication blocked.</small>
      </form>
    </details>
  );
}

function CandidateRejectionForm({
  candidate,
  disabled,
  onDecision
}: {
  candidate: MeridianCandidateReviewItem;
  disabled: boolean;
  onDecision: (candidateId: string, decision: "started_review" | "rejected", rationale: string) => Promise<void>;
}) {
  return (
    <details className="meridian-candidate-decision danger">
      <summary>Reject candidate</summary>
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onDecision(candidate.id, "rejected", String(form.get("rejectionRationale") || ""));
      }}>
        <label className="leader-review-field">
          <span>Why should Meridian not use this?</span>
          <textarea name="rejectionRationale" placeholder="Name the unsupported claim, source problem, duplication, or unsafe scope." required />
        </label>
        <button className="button" disabled={disabled} type="submit">Record Rejection</button>
      </form>
    </details>
  );
}

function CandidateReviewHistory({ events }: { events: MeridianCandidateReviewItem["reviewEvents"] }) {
  if (!events.length) return <p className="meridian-candidate-history-empty">No decisions recorded yet.</p>;
  return (
    <details className="meridian-candidate-history">
      <summary>Review history ({events.length})</summary>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.decision.replace(/_/g, " ")}</strong>
            <span>{formatDate(event.createdAt)}</span>
            {event.rationale ? <p>{event.rationale}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function submitPromotionForm(
  event: FormEvent<HTMLFormElement>,
  candidate: MeridianCandidateReviewItem,
  onPromote: (candidateId: string, payload: PromotionPayload) => Promise<void>
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const authorityClass = String(form.get("authorityClass")) as "approved_teaching" | "adopted_doctrine";
  const claimKind = String(form.get("claimKind")) as MeridianPromotionInput["claim"]["kind"];
  const proposition = String(form.get("claim") || "").trim();
  const fragmentText = String(form.get("fragmentText") || "").trim();
  const rationale = String(form.get("rationale") || "").trim();
  const topics = commaList(String(form.get("topics") || ""));
  const scriptureReferences = commaList(String(form.get("scriptureReferences") || ""));

  void onPromote(candidate.id, {
    rationale,
    source: {
      title: candidate.title,
      authorityClass,
      externalVisibility: "ministry",
      quotePolicy: "never",
      sensitivity: "internal"
    },
    fragment: {
      text: fragmentText,
      locator: { kind: "note_block", value: candidate.sourceUri || candidate.title },
      canQuote: false,
      canParaphrase: true,
      canCite: true,
      canUseFinalAnswer: true,
      canUseExternalCommunication: false
    },
    claim: {
      proposition,
      kind: claimKind,
      authorityClass,
      confidence: 0.9,
      scope: {
        topics,
        scriptureReferences,
        sensitivity: ["internal"]
      }
    }
  });
}

function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function defaultClaimKind(objectType: MeridianCandidateReviewItem["objectType"]): MeridianPromotionInput["claim"]["kind"] {
  if (objectType === "formation") return "recommendation";
  if (objectType === "passage") return "interpretation";
  return "doctrinal_position";
}

function candidateTypeLabel(objectType: MeridianCandidateReviewItem["objectType"]) {
  const labels: Record<MeridianCandidateReviewItem["objectType"], string> = {
    passage: "Passage map",
    doctrine: "Doctrine",
    formation: "Formation",
    question: "Question map",
    guardrail_proposal: "Guardrail proposal",
    relationship_proposal: "Relationship proposal",
    derived_journey: "Derived journey",
    unknown: "Unclassified"
  };
  return labels[objectType];
}

function statusLabel(status: MeridianCandidateApprovalStatus) {
  return status === "in_review" ? "In review" : status.charAt(0).toUpperCase() + status.slice(1);
}

function dedicatedRouteMessage(objectType: MeridianCandidateReviewItem["objectType"]) {
  if (objectType === "question") return "Question maps shape query decomposition; they must not be disguised as answer claims.";
  if (objectType === "guardrail_proposal") return "Guardrails need rule-by-rule approval and enforcement semantics before activation.";
  if (objectType === "relationship_proposal") return "Relationships can be approved only after both endpoint objects exist and are reviewed.";
  return "This object type does not yet have a safe promotion path.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
