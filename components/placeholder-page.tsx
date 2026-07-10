type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: string[];
  stubLabel?: string;
};

export function PlaceholderPage({ eyebrow, title, description, sections, stubLabel = "Preview Mode" }: PlaceholderPageProps) {
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
