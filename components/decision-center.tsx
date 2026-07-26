import Link from "next/link";

import { ActionQueue, ActionRow, QuietState, StatusBadge, type PlatformTone } from "@/components/platform-ui";
import type {
  DecisionCenterMetric,
  DecisionEvidence,
  DecisionSignal,
  JudgedIntegrationFlow,
  LeadershipAttentionItem
} from "@/lib/decision-center/types";
import type { ResponsibilityVisibility } from "@/lib/ministry/alignment";

export function DecisionMetricGrid({ metrics }: { metrics: DecisionCenterMetric[] }) {
  return (
    <div className="ministry-launch-grid" aria-label="Decision center metrics">
      {metrics.map((metric, index) => (
        <article className={`ministry-launch-metric ${metric.tone === "gold" ? "gold" : metric.tone === "critical" ? "violet" : "cyan"}`} key={metric.id}>
          <span className="ministry-launch-icon" aria-hidden="true">{index + 1}</span>
          <div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DecisionSignalList({ signals }: { signals: DecisionSignal[] }) {
  if (!signals.length) {
    return (
      <QuietState title="No verified signals yet">
        Connect events, task outcomes, ministry goals, and approved student formation data to begin building this view.
      </QuietState>
    );
  }

  return (
    <ActionQueue label="Verified decision signals">
      {signals.map((signal) => (
        <ActionRow
          key={signal.id}
          title={signal.title}
          summary={signal.summary}
          meta={`${evidenceSupportLabel(signal.confidence)} - ${signal.freshness} - ${signal.definition}`}
          tone={signal.tone}
          action={<SignalAction signal={signal} />}
        />
      ))}
    </ActionQueue>
  );
}

export function EvidenceStack({ signals }: { signals: DecisionSignal[] }) {
  return (
    <div className="ministry-launch-list" aria-label="Evidence drawer previews">
      {signals.map((signal) => (
        <details className="ministry-launch-panel" key={signal.id} open>
          <summary>
            <strong>{signal.title}</strong>
            <StatusBadge tone={confidenceTone(signal.confidence)}>{evidenceSupportLabel(signal.confidence)}</StatusBadge>
          </summary>
          <p className="decision-signal-boundary">{signal.boundary}</p>
          <EvidenceList evidence={signal.evidence} />
        </details>
      ))}
    </div>
  );
}

export function LeadershipAttentionList({ items }: { items: LeadershipAttentionItem[] }) {
  return (
    <div className="ministry-launch-list" aria-label="Leadership attention items">
      {items.map((item) => (
        <article className="ministry-launch-panel" key={item.id}>
          <div className="ministry-launch-section-head">
            <p className="eyebrow">{item.status}</p>
            <h3>{item.title}</h3>
          </div>
          <p className="muted">{item.summary}</p>
          <div className="toolbar split">
            <StatusBadge tone="info">{item.owner}</StatusBadge>
            <Link className="button compact-button" href={item.nextStepHref}>
              {item.nextStepLabel}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function JudgedIntegrationFlowList({ flows }: { flows: JudgedIntegrationFlow[] }) {
  return (
    <div className="ministry-launch-card-list" aria-label="Judged integration flow">
      {flows.map((flow) => (
        <article className="ministry-launch-mini-card" key={flow.id}>
          <strong>{flow.provider}</strong>
          <span>{flow.visibleStep}</span>
          <p>{flow.scoringPurpose}</p>
          <EvidenceList
            evidence={[
              { id: `${flow.id}.route`, sourceKind: "integration", label: "Route", detail: flow.route },
              { id: `${flow.id}.server`, sourceKind: "integration", label: "Server flow", detail: flow.serverFlow },
              { id: `${flow.id}.boundary`, sourceKind: "integration", label: "Boundary", detail: flow.storageBoundary }
            ]}
          />
        </article>
      ))}
    </div>
  );
}

export function ResponsibilityVisibilityList({ items }: { items: ResponsibilityVisibility[] }) {
  return (
    <div className="ministry-launch-card-list" aria-label="Responsibility visibility">
      {items.map((item) => (
        <article className="ministry-launch-mini-card" key={item.id}>
          <strong>{item.area}</strong>
          <span>{item.status}</span>
          <p>{item.ownerLabel}</p>
          <EvidenceList
            evidence={[
              { id: `${item.id}.source`, sourceKind: "activity", label: "Source", detail: item.source },
              { id: `${item.id}.milestone`, sourceKind: "task", label: "Next milestone", detail: item.nextMilestone }
            ]}
          />
        </article>
      ))}
    </div>
  );
}

function SignalAction({ signal }: { signal: DecisionSignal }) {
  return (
    <div className="toolbar">
      <StatusBadge tone={confidenceTone(signal.confidence)}>{evidenceSupportLabel(signal.confidence)}</StatusBadge>
      <Link className="button compact-button" href={signal.targetHref}>
        {signal.targetLabel}
      </Link>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: DecisionEvidence[] }) {
  return (
    <dl className="decision-evidence-list">
      {evidence.map((item) => (
        <div className="decision-evidence-item" key={item.id}>
          <dt>
            <StatusBadge tone={sourceTone(item.sourceKind)}>{item.sourceKind}</StatusBadge>
            <strong>{item.label}</strong>
          </dt>
          <dd>{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function confidenceTone(confidence: DecisionSignal["confidence"]): PlatformTone {
  if (confidence === "High") return "success";
  if (confidence === "Moderate") return "gold";
  return "warning";
}

function evidenceSupportLabel(confidence: DecisionSignal["confidence"]) {
  if (confidence === "High") return "Strong evidence support";
  if (confidence === "Moderate") return "Partial evidence support";
  return "Limited evidence support";
}

function sourceTone(sourceKind: DecisionEvidence["sourceKind"]): PlatformTone {
  if (sourceKind === "integration" || sourceKind === "scripture") return "info";
  if (sourceKind === "budget") return "gold";
  if (sourceKind === "task") return "warning";
  return "neutral";
}
