import type { ReactNode } from "react";

export type PlatformTone = "neutral" | "info" | "gold" | "warning" | "critical" | "success";

export function PageIntro({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="platform-page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="platform-page-intro-actions">{actions}</div> : null}
    </header>
  );
}

export function EditorialSection({ eyebrow, title, description, accent = "none", children }: { eyebrow?: string; title: string; description?: string; accent?: "none" | "cyan" | "gold"; children: ReactNode }) {
  return (
    <section className={`editorial-section editorial-section-${accent}`}>
      <header className="editorial-section-heading">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function InteractivePanel({ label, children, className = "" }: { label?: string; children: ReactNode; className?: string }) {
  return <section className={`interactive-panel ${className}`.trim()} aria-label={label}>{children}</section>;
}

export function ActionQueue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="action-queue" role="list" aria-label={label}>{children}</div>;
}

export function ActionRow({ title, summary, meta, tone = "neutral", action }: { title: string; summary: string; meta?: string; tone?: PlatformTone; action?: ReactNode }) {
  return (
    <article className={`action-row tone-${tone}`} role="listitem">
      <span className="action-row-signal" aria-hidden="true" />
      <div className="action-row-copy">
        <strong>{title}</strong>
        <p>{summary}</p>
        {meta ? <small>{meta}</small> : null}
      </div>
      {action ? <div className="action-row-action">{action}</div> : null}
    </article>
  );
}

export function SummaryRail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="summary-rail" aria-label={label}>{children}</div>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: PlatformTone; children: ReactNode }) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}

export function QuietState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="quiet-state"><strong>{title}</strong><p>{children}</p></div>;
}

export function AssistantBrief({ summary, points, nextAction, action }: { summary: string; points: string[]; nextAction?: string; action: ReactNode }) {
  return (
    <div className="assistant-brief">
      <div className="assistant-brief-copy">
        <strong>{summary}</strong>
        {points.length ? <ul>{points.slice(0, 3).map((point) => <li key={point}>{point}</li>)}</ul> : null}
        {nextAction ? <p><span>Recommended next</span>{nextAction}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AssistantWorkspace({ id, children, hidden = false }: { id: string; children: ReactNode; hidden?: boolean }) {
  return <div className="assistant-workspace" id={id} hidden={hidden}>{children}</div>;
}
