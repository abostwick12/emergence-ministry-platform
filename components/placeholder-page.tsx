import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, PageIntro, StatusBadge } from "@/components/platform-ui";
import type { MinistryEmmaPage } from "@/lib/emma/ministry-page-assistant";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: string[];
  stubLabel?: string;
  emmaPage?: MinistryEmmaPage;
  emmaSignals?: string[];
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  sections,
  stubLabel = "Preview Mode",
  emmaPage,
  emmaSignals
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page editorial-placeholder-page">
      <PageIntro eyebrow={eyebrow} title={title} description={description} actions={<StatusBadge>{stubLabel}</StatusBadge>} />
      {emmaPage ? (
        <EditorialSection eyebrow="Interpret" title="EMMA brief" description="Recommendations stay inside the current preview and provider boundaries.">
          <MinistryEmmaPanel page={emmaPage} staticSignals={emmaSignals} />
        </EditorialSection>
      ) : null}
      <EditorialSection eyebrow="Planned areas" title="Workspace map" description="These areas stay explicitly inactive until their workflows and provider boundaries are approved.">
        <div className="placeholder-capability-list">
          {sections.map((section) => (
            <article className="placeholder-capability-row" key={section}>
              <strong>{section}</strong>
              <p>Planned capability. No live file or provider action is available here yet.</p>
              <StatusBadge>Not live yet</StatusBadge>
            </article>
          ))}
        </div>
      </EditorialSection>
    </section>
  );
}
