export default function StudentPortalLoading() {
  return (
    <div className="student-feed platform-route-loading" aria-busy="true" aria-label="Loading Student Portal">
      <section className="student-reading-helps" aria-hidden="true">
        <div className="student-reading-help platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-line title" />
          <div className="platform-loading-line" />
        </div>
        <div className="student-reading-help platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-line title" />
          <div className="platform-loading-line" />
        </div>
      </section>
      <section className="student-feed-main" aria-hidden="true">
        <div className="student-feed-welcome platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-line title" />
          <div className="platform-loading-line" />
        </div>
        <div className="student-progress-card platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-line title" />
          <div className="platform-loading-block" />
        </div>
        <div className="student-feed-section platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-list">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
      <aside className="student-feed-rail" aria-hidden="true">
        <div className="student-question-composer platform-loading-panel">
          <div className="platform-loading-line short" />
          <div className="platform-loading-line title" />
          <div className="platform-loading-block tall" />
        </div>
      </aside>
    </div>
  );
}
