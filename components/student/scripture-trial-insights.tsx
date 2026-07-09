import type { ScriptureTrialInsights, ScriptureTrialInsightTopic } from "@/lib/scripture/trial-insights";

type ScriptureTrialInsightsProps = {
  insights: ScriptureTrialInsights;
};

export function ScriptureTrialInsightsPanel({ insights }: ScriptureTrialInsightsProps) {
  return (
    <section className="scripture-trial-insights" aria-label="Small group tryout pulse">
      <div className="scripture-trial-insights-heading">
        <div>
          <p className="eyebrow">Small Group Tryout</p>
          <h2>Trial Pulse</h2>
          <p>Watch whether real student questions are becoming leader-reviewed conversations and student next steps.</p>
        </div>
        <div className="scripture-trial-actions">
          <span className={insights.readiness.liveStorage ? "pill green" : "pill amber"}>
            {insights.readiness.liveStorage ? "Live storage" : "Setup needed"}
          </span>
          <a className="button" href="/api/student/scripture/trial-report">
            Export report
          </a>
        </div>
      </div>

      <div className="scripture-trial-stat-grid" aria-label="Trial counts">
        {insights.stats.map((stat) => (
          <div className="scripture-trial-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </div>
        ))}
      </div>

      <div className="scripture-trial-grid">
        <InsightList emptyText="Tags will appear after Gloo generates or leaders add draft context." items={insights.topicCounts} title="What students are asking about" />
        <InsightList emptyText="Optional references students enter will appear here." items={insights.scriptureReferences} title="Passages surfacing" />
        <InsightList emptyText="Knowledge matches will appear as student questions connect to the brain." items={insights.knowledgeMatches} title="Knowledge brain matches" />
      </div>

      <div className="scripture-trial-recent">
        <div className="scripture-trial-section-title">
          <h3>Recent questions</h3>
          <p>
            {insights.recommendationPersistenceAvailable
              ? "Saved next-step status is coming from live recommendation records."
              : "Next-step status is inferred from available live question context."}
          </p>
        </div>
        {insights.recentQuestions.length ? (
          <div className="scripture-trial-question-list">
            {insights.recentQuestions.map((question) => (
              <article className="scripture-trial-question" key={question.id}>
                <div>
                  <span>{question.scriptureReference || "No passage selected"}</span>
                  <strong>{question.question}</strong>
                  <small>{question.submittedBy}</small>
                </div>
                <div className="scripture-trial-question-signals" aria-label="Question signals">
                  <Signal label={labelForStatus(question.status)} />
                  <Signal label={question.hasSavedNextSteps ? "next steps saved" : `${question.knowledgeMatchCount} brain match${question.knowledgeMatchCount === 1 ? "" : "es"}`} />
                  <Signal label={labelForSafety(question.safetyLabel)} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="scripture-trial-empty">
            <strong>No student questions yet.</strong>
            <p>Once students start asking, this becomes the launch readout for the two-week tryout.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function InsightList({ emptyText, items, title }: { emptyText: string; items: ScriptureTrialInsightTopic[]; title: string }) {
  return (
    <div className="scripture-trial-list">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function Signal({ label }: { label: string }) {
  return <span>{label}</span>;
}

function labelForStatus(status: string) {
  return status.replace(/_/g, " ");
}

function labelForSafety(label: string) {
  if (label === "needs_leader_care") return "leader care";
  if (label === "pastoral_escalation") return "pastoral care";
  return label;
}
