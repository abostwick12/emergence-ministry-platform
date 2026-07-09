import type { ScriptureTrialInsights, ScriptureTrialInsightTopic } from "@/lib/scripture/trial-insights";
import type { StudentGroupLeaderState } from "@/lib/student/groups";

type ScriptureTrialInsightsProps = {
  groupState: StudentGroupLeaderState;
  insights: ScriptureTrialInsights;
};

type LaunchReadinessItem = {
  label: string;
  detail: string;
  state: "ready" | "watch" | "setup";
};

export function ScriptureTrialInsightsPanel({ groupState, insights }: ScriptureTrialInsightsProps) {
  const launchReadiness = buildLaunchReadiness(insights, groupState);
  const activeInvites = groupState.invites.filter((invite) => invite.isActive).length;
  const activeStudents = groupState.members.filter((member) => member.status === "active").length;

  return (
    <section className="scripture-trial-insights" aria-label="Small group launch pulse">
      <div className="scripture-trial-insights-heading">
        <div>
          <p className="eyebrow">Small Group Launch</p>
          <h2>Launch Readiness</h2>
          <p>Track whether students can join, ask real questions, receive leader-reviewed prompts, and leave with next steps.</p>
        </div>
        <div className="scripture-trial-actions">
          <span className={insights.readiness.liveStorage ? "pill green" : "pill amber"}>
            {insights.readiness.liveStorage ? "Live storage" : "Setup needed"}
          </span>
          <span className={activeInvites ? "pill green" : "pill amber"}>{activeInvites} invite link{activeInvites === 1 ? "" : "s"}</span>
          <span className={activeStudents ? "pill green" : "pill amber"}>{activeStudents} student{activeStudents === 1 ? "" : "s"} joined</span>
          <a className="button" href="/api/student/scripture/trial-report">
            Export report
          </a>
        </div>
      </div>

      <div className="scripture-launch-readiness" aria-label="Small group launch checklist">
        {launchReadiness.map((item) => (
          <div className={`scripture-launch-readiness-item ${item.state}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{labelForReadinessState(item.state)}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
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
        <InsightList emptyText="Tags will appear after AI drafts or leaders add discussion context." items={insights.topicCounts} title="What students are asking about" />
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
            <p>Once students start asking, this becomes the launch readout for the two-week student group run.</p>
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

function buildLaunchReadiness(insights: ScriptureTrialInsights, groupState: StudentGroupLeaderState): LaunchReadinessItem[] {
  const activeInvites = groupState.invites.filter((invite) => invite.isActive).length;
  const activeStudents = groupState.members.filter((member) => member.status === "active").length;

  return [
    {
      label: "Student access",
      state: groupState.liveStorage && activeInvites > 0 ? "ready" : groupState.liveStorage ? "watch" : "setup",
      detail: groupState.liveStorage
        ? activeInvites > 0
          ? `${activeInvites} join link${activeInvites === 1 ? "" : "s"} ready to share`
          : "Create one join link before the group starts"
        : groupState.message
    },
    {
      label: "Students joined",
      state: activeStudents > 0 ? "ready" : activeInvites > 0 ? "watch" : "setup",
      detail: activeStudents > 0 ? `${activeStudents} student${activeStudents === 1 ? "" : "s"} can use the portal` : "Students appear here after using a link"
    },
    {
      label: "Question flow",
      state: insights.totalQuestions > 0 ? "ready" : activeStudents > 0 ? "watch" : "setup",
      detail: insights.totalQuestions > 0 ? `${insights.totalQuestions} real question${insights.totalQuestions === 1 ? "" : "s"} submitted` : "Ready for the first honest question"
    },
    {
      label: "Leader review",
      state: insights.pendingReview === 0 && insights.totalQuestions > 0 ? "ready" : insights.pendingReview > 0 ? "watch" : "setup",
      detail:
        insights.pendingReview > 0
          ? `${insights.pendingReview} question${insights.pendingReview === 1 ? "" : "s"} waiting on leader review`
          : insights.totalQuestions > 0
            ? "No review backlog"
            : "Review starts after questions arrive"
    },
    {
      label: "Student next steps",
      state: insights.withSavedNextSteps > 0 ? "ready" : insights.totalQuestions > 0 ? "watch" : "setup",
      detail:
        insights.withSavedNextSteps > 0
          ? `${insights.withSavedNextSteps} question${insights.withSavedNextSteps === 1 ? "" : "s"} connected to saved next steps`
          : "Save reading and dig questions as students ask"
    }
  ];
}

function labelForReadinessState(state: LaunchReadinessItem["state"]) {
  if (state === "ready") return "Ready";
  if (state === "watch") return "Needs action";
  return "Not started";
}

function labelForStatus(status: string) {
  return status.replace(/_/g, " ");
}

function labelForSafety(label: string) {
  if (label === "needs_leader_care") return "leader care";
  if (label === "pastoral_escalation") return "pastoral care";
  return label;
}
