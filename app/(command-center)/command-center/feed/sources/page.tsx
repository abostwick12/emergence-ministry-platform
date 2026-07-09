import { getServerSession } from "@/lib/auth/server";
import { listKnowledgeSources } from "@/lib/command-center/repository";
import { KnowledgeSourceStatusActions } from "@/components/command-center/knowledge-source-status-actions";
import { formatDate } from "@/lib/utils";
import type { KnowledgeSourceStatus, KnowledgeSourceType } from "@/lib/command-center/types";

const SOURCE_TYPES: KnowledgeSourceType[] = ["article", "podcast", "video", "linkedin", "report"];
const STATUSES: KnowledgeSourceStatus[] = ["new", "included", "skipped", "archived"];

export default async function CommandCenterFeedSourcesPage({
  searchParams
}: {
  searchParams: { sourceType?: string; status?: string };
}) {
  const session = await getServerSession();
  if (!session) return null;

  const sourceType = SOURCE_TYPES.includes(searchParams.sourceType as KnowledgeSourceType)
    ? (searchParams.sourceType as KnowledgeSourceType)
    : undefined;
  const status = STATUSES.includes(searchParams.status as KnowledgeSourceStatus) ? (searchParams.status as KnowledgeSourceStatus) : undefined;

  const sources = await listKnowledgeSources(session, { sourceType, status });

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Weekly Intelligence</p>
        <h2 className="section-title flush">Feed Sources</h2>
        <p className="muted">Every note SAGE has imported from the approved &quot;SAGE Feed Sources&quot; Google Drive folder.</p>

        <form method="get" className="toolbar">
          <select name="sourceType" defaultValue={sourceType ?? ""}>
            <option value="">All types</option>
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="button" type="submit">
            Filter
          </button>
        </form>
      </section>

      {sources.length === 0 ? (
        <section className="panel">
          <p className="muted">No sources match this filter yet.</p>
        </section>
      ) : (
        sources.map((source) => (
          <section className="panel" key={source.id}>
            <p className="eyebrow">
              {source.sourceType} · <span className={`pill${source.status === "archived" ? " done" : ""}`}>{source.status}</span>
            </p>
            <h3 className="section-title flush">{source.title}</h3>
            <p className="muted">
              {source.sourceName ?? "Unknown source"}
              {source.authorOrHost ? ` · ${source.authorOrHost}` : ""}
              {source.dateFound ? ` · ${formatDate(source.dateFound)}` : ""}
            </p>
            {source.url ? (
              <p className="muted">
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
              </p>
            ) : null}
            {source.errorMessage ? <p className="muted">Note: {source.errorMessage}</p> : null}
            <KnowledgeSourceStatusActions sourceId={source.id} />
          </section>
        ))
      )}
    </div>
  );
}
