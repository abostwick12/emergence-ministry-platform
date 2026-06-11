type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: string[];
  stubLabel?: string;
};

export function PlaceholderPage({ eyebrow, title, description, sections, stubLabel = "Stub Mode" }: PlaceholderPageProps) {
  return (
    <section className="panel placeholder-page">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title" style={{ margin: 0 }}>
            {title}
          </h2>
        </div>
        <span className="pill stub">{stubLabel}</span>
      </div>
      <p className="muted">{description}</p>
      <div className="grid grid-3">
        {sections.map((section) => (
          <article className="card" key={section}>
            <strong>{section}</strong>
            <p className="muted">
              Placeholder area for a later build.
            </p>
            <button className="button compact-button" type="button" disabled>
              Coming soon
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
