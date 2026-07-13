export default function DiscipleshipLoading() {
  return (
    <div className="discipleship-workspace-stack platform-route-loading" aria-busy="true" aria-label="Loading Discipleship workspace">
      <section className="scripture-trial-insights platform-loading-panel" aria-hidden="true">
        <div className="platform-loading-line short" />
        <div className="platform-loading-line title" />
        <div className="platform-loading-grid">
          <div className="platform-loading-block" />
          <div className="platform-loading-block" />
          <div className="platform-loading-block" />
        </div>
      </section>
      <section className="knowledge-control-room platform-loading-panel" aria-hidden="true">
        <div className="platform-loading-line short" />
        <div className="platform-loading-line title" />
        <div className="platform-loading-line" />
        <div className="platform-loading-block tall" />
      </section>
      <section className="student-curated-resource-manager platform-loading-panel" aria-hidden="true">
        <div className="platform-loading-line short" />
        <div className="platform-loading-line title" />
        <div className="platform-loading-list">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="scripture-leader-review platform-loading-panel" aria-hidden="true">
        <div className="platform-loading-line short" />
        <div className="platform-loading-line title" />
        <div className="platform-loading-grid">
          <div className="platform-loading-block tall" />
          <div className="platform-loading-block tall" />
        </div>
      </section>
    </div>
  );
}
