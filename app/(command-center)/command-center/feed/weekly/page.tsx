import { getServerSession } from "@/lib/auth/server";
import { getLatestWeeklyFeedWithItems } from "@/lib/command-center/repository";
import { isIntegrationConfigured } from "@/lib/command-center/integrations-meta";
import { GenerateFeedButton } from "@/components/command-center/generate-feed-button";
import { KnowledgeSourceStatusActions } from "@/components/command-center/knowledge-source-status-actions";
import type { WeeklyFeedItemWithDetail } from "@/lib/command-center/types";

const SECTION_LABELS: Record<string, string> = {
  top5: "Top 5 Things to Pay Attention To",
  articles: "Most Relevant Articles",
  podcasts: "Most Relevant Podcasts",
  videos: "Most Relevant Videos",
  linkedin: "Most Relevant LinkedIn Posts",
  reports: "Most Relevant Weekly Reports"
};

const SECTION_ORDER = ["top5", "articles", "podcasts", "videos", "linkedin", "reports"];

function groupBySection(items: WeeklyFeedItemWithDetail[]): Map<string, WeeklyFeedItemWithDetail[]> {
  const groups = new Map<string, WeeklyFeedItemWithDetail[]>();
  for (const item of items) {
    const list = groups.get(item.section) ?? [];
    list.push(item);
    groups.set(item.section, list);
  }
  for (const list of Array.from(groups.values())) list.sort((a, b) => a.rank - b.rank);
  return groups;
}

export default async function CommandCenterWeeklyFeedPage() {
  const session = await getServerSession();
  if (!session) return null;

  const driveConfigured = isIntegrationConfigured("google_drive");
  const result = await getLatestWeeklyFeedWithItems(session);

  if (!result) {
    return (
      <div className="grid workspace-page">
        <section className="panel">
          <p className="eyebrow">Weekly Intelligence</p>
          <h2 className="section-title flush">No weekly feed yet</h2>
          <p className="muted">
            {driveConfigured
              ? "Add research notes to the \"SAGE Feed Sources\" folder in Google Drive, then generate this week's feed."
              : "Connect Google Drive from the Integrations page, then add research notes to a \"SAGE Feed Sources\" folder there."}
          </p>
          <div className="toolbar">
            <GenerateFeedButton />
          </div>
        </section>
      </div>
    );
  }

  const { feed, items } = result;
  const sections = groupBySection(items);

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Weekly Intelligence · {feed.weekStart} – {feed.weekEnd}</p>
        <h2 className="section-title flush">{feed.title}</h2>
        <p className="muted">{feed.executiveSummary}</p>
        {feed.topTopics.length > 0 ? (
          <div className="command-center-integration-row">
            {feed.topTopics.map((topic) => (
              <span className="pill blue" key={topic}>
                {topic}
              </span>
            ))}
          </div>
        ) : null}
        <div className="toolbar">
          <GenerateFeedButton />
        </div>
      </section>

      {SECTION_ORDER.filter((section) => sections.has(section)).map((section) => (
        <section className="panel" key={section}>
          <p className="eyebrow">{SECTION_LABELS[section] ?? section}</p>
          {(sections.get(section) ?? []).map((item) => (
            <div className="command-center-briefing-item" key={item.id}>
              <strong>{item.source.title}</strong>
              <p className="muted">
                {item.source.sourceName ?? item.source.sourceType}
                {item.source.url ? (
                  <>
                    {" · "}
                    <a href={item.source.url} target="_blank" rel="noreferrer">
                      Source link
                    </a>
                  </>
                ) : null}
              </p>
              <p className="muted">{item.knowledgeItem.summary}</p>
              {item.reasonIncluded ? <p className="muted">Why included: {item.reasonIncluded}</p> : null}
              {item.recommendedAction ? <p className="muted">Suggested action: {item.recommendedAction}</p> : null}
              {item.confidenceNote ? <p className="muted">Caveat: {item.confidenceNote}</p> : null}
              <KnowledgeSourceStatusActions sourceId={item.source.id} />
            </div>
          ))}
        </section>
      ))}

      {feed.ministryImplications || feed.appPlatformImplications || feed.suggestedActionItems ? (
        <section className="panel">
          <p className="eyebrow">Implications & Action Items</p>
          {feed.ministryImplications ? (
            <>
              <h3 className="section-title flush">Ministry Applications</h3>
              <p className="muted">{feed.ministryImplications}</p>
            </>
          ) : null}
          {feed.appPlatformImplications ? (
            <>
              <h3 className="section-title flush">App/Platform Implications</h3>
              <p className="muted">{feed.appPlatformImplications}</p>
            </>
          ) : null}
          {feed.suggestedActionItems ? (
            <>
              <h3 className="section-title flush">Suggested Action Items</h3>
              <p className="muted">{feed.suggestedActionItems}</p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
