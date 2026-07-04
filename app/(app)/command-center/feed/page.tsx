import { getServerSession } from "@/lib/auth/server";
import { getDailyBriefing } from "@/lib/command-center/repository";

export default async function CommandCenterFeedPage() {
  const session = await getServerSession();
  if (!session) return null;
  const items = await getDailyBriefing(session);

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Daily Feed</p>
        <h2 className="section-title flush">Fresh Intelligence</h2>
        <p className="muted">
          Phase 2 will replace this with a live Firecrawl-powered crawl of military transition, job market, and leadership
          sources, refreshed once per day.
        </p>
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
