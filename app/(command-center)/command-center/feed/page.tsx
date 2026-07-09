import { getServerSession } from "@/lib/auth/server";
import { getDailyBriefing } from "@/lib/command-center/repository";
import { isIntegrationConfigured } from "@/lib/command-center/integrations-meta";
import { FeedRefreshButton } from "@/components/command-center/feed-refresh-button";

export default async function CommandCenterFeedPage() {
  const session = await getServerSession();
  if (!session) return null;
  const items = await getDailyBriefing(session);
  const firecrawlConfigured = isIntegrationConfigured("firecrawl");

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Daily Feed</p>
        <h2 className="section-title flush">{firecrawlConfigured ? "Live Resource Feed" : "Manual Resource Feed"}</h2>
        {firecrawlConfigured ? (
          <>
            <p className="muted">
              Pulled from a small curated list of military transition, job market, and leadership sources. Refreshed only
              when you ask — SAGE never crawls on a schedule.
            </p>
            <FeedRefreshButton />
          </>
        ) : (
          <p className="muted">
            Connect Firecrawl from the Integrations page to replace this with a live, curated resource crawl.
          </p>
        )}
      </section>
      {items.map((item) => (
        <section className="panel" key={item.id}>
          <p className="eyebrow">{item.source}</p>
          <h3 className="section-title flush">{item.title}</h3>
          <p className="muted">{item.summary}</p>
        </section>
      ))}
    </div>
  );
}
