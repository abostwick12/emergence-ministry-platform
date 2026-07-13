import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import type { MinistryEmmaPage } from "@/lib/emma/ministry-page-assistant";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: string[];
  stubLabel?: string;
  emmaPage?: MinistryEmmaPage;
  emmaSignals?: string[];
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  sections,
  stubLabel = "Preview Mode",
  emmaPage,
  emmaSignals
}: PlaceholderPageProps) {
  return (
    <section className="panel placeholder-page liquid-page-panel">
      <div className="toolbar split placeholder-page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title flush">
            {title}
          </h2>
        </div>
        <span className="pill stub">{stubLabel}</span>
      </div>
      <p className="muted">{description}</p>
      {emmaPage ? <MinistryEmmaPanel page={emmaPage} staticSignals={emmaSignals} /> : null}
      <div className="grid grid-3">
        {sections.map((section) => (
          <article className="card placeholder-card liquid-card" key={section}>
            <strong>{section}</strong>
            <p className="muted">
              Planned capability. This area will stay preview-only until the matching workflow and provider boundary are approved.
            </p>
            <span className="pill placeholder-card-status">Not live yet</span>
          </article>
        ))}
      </div>
    </section>
  );
}
