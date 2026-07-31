"use client";

import { useState } from "react";
import { ArrowDown, BookOpenCheck, MessageCircle, Search, ShieldCheck } from "lucide-react";

import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import type {
  GuestMinistryNarrative,
  GuestMinistryNarrativeId
} from "@/lib/guest/ministry-narratives";

export function GuestMinistryNarrativeHub({
  narratives
}: {
  narratives: GuestMinistryNarrative[];
}) {
  const [selectedEmmaNarrativeId, setSelectedEmmaNarrativeId] = useState<GuestMinistryNarrativeId | null>(null);
  const [openEvidenceId, setOpenEvidenceId] = useState<GuestMinistryNarrativeId | null>(null);
  const [primary, ...additional] = narratives;

  if (!primary) return null;

  return (
    <section className="guest-ministry-hub" aria-label="Guest Ministry Hub narrative review">
      <header className="guest-ministry-intro">
        <p className="eyebrow">What leadership may not have noticed</p>
        <h2>Ministry records can return attention to people.</h2>
        <p>
          Four patterns surfaced from the same synthetic ministry history. Each one begins with what changed,
          shows the records behind it, names what remains unknown, and leaves the judgment with ministry leaders.
        </p>
      </header>

      <section className="guest-ministry-method" aria-label="Ministry alignment">
        <div className="guest-ministry-method-body">
          <div><h3>Vision</h3><p>Students becoming rooted in Scripture, formed through meaningful relationships, and equipped to recognize where God is already at work.</p></div>
          <div><h3>Current season: Scripture Engagement</h3><p>Students learn to read Scripture within its larger story, ask thoughtful questions, and live what they discover.</p></div>
          <div><h3>Success looks like</h3><p>Sermons, leader resources, Journey Journals, events, and student questions reinforce one Scripture-engagement pathway.</p></div>
        </div>
      </section>

      <NarrativeStory
        narrative={primary}
        primary
        evidenceOpen={openEvidenceId === primary.id}
        emmaOpen={selectedEmmaNarrativeId === primary.id}
        onEvidenceChange={(open) => setOpenEvidenceId(open ? primary.id : null)}
        onEmmaToggle={() => setSelectedEmmaNarrativeId((current) => current === primary.id ? null : primary.id)}
      />

      <nav className="guest-ministry-pattern-index" aria-label="Three additional ministry patterns">
        <div>
          <span>3 additional patterns</span>
          <p>Continue through the ministry story, not a dashboard grid.</p>
        </div>
        <div className="guest-ministry-pattern-links">
          {additional.map((narrative, index) => (
            <a key={narrative.id} href={`#guest-story-${narrative.id}`}>
              <span>0{index + 2}</span>
              {shortPatternLabel(narrative.id)}
              <ArrowDown aria-hidden="true" />
            </a>
          ))}
        </div>
      </nav>

      <div className="guest-ministry-story-sequence">
        {additional.map((narrative) => (
          <NarrativeStory
            key={narrative.id}
            narrative={narrative}
            evidenceOpen={openEvidenceId === narrative.id}
            emmaOpen={selectedEmmaNarrativeId === narrative.id}
            onEvidenceChange={(open) => setOpenEvidenceId(open ? narrative.id : null)}
            onEmmaToggle={() => setSelectedEmmaNarrativeId((current) => current === narrative.id ? null : narrative.id)}
          />
        ))}
      </div>

      <details className="guest-ministry-method">
        <summary>
          <BookOpenCheck aria-hidden="true" />
          How these patterns were surfaced
        </summary>
        <div className="guest-ministry-method-body">
          <div>
            <h3>Leadership-authored context</h3>
            <p>
              Organizational memory preserves the ministry’s stated direction: Scripture first, formation over
              activity, care for leaders, and a current season focused on Scripture practice and leader readiness.
              Those priorities shape the questions this page asks; they do not turn records into spiritual verdicts.
            </p>
          </div>
          <div>
            <h3>Governed interpretation</h3>
            <p>
              Deterministic selectors compare attendance, task ownership, serving assignments, and small-group
              records. Guest EMMA receives one selected narrative, its approved evidence, its limitations, and its
              discernment question. It cannot send, write, synchronize, retrieve private sources, or make a ministry
              decision.
            </p>
          </div>
          <div className="guest-ministry-method-boundary">
            <ShieldCheck aria-hidden="true" />
            <p>
              Synthetic guest history only. Scripture and organizational memory provide ministry context; software
              does not determine God’s will, spiritual health, calling, or pastoral action.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}

function NarrativeStory({
  narrative,
  primary = false,
  evidenceOpen,
  emmaOpen,
  onEvidenceChange,
  onEmmaToggle
}: {
  narrative: GuestMinistryNarrative;
  primary?: boolean;
  evidenceOpen: boolean;
  emmaOpen: boolean;
  onEvidenceChange: (open: boolean) => void;
  onEmmaToggle: () => void;
}) {
  const visibleEvidence = primary ? narrative.evidence.slice(0, 3) : narrative.evidence;

  return (
    <article
      className={`guest-ministry-story${primary ? " guest-ministry-story-primary" : ""}`}
      id={`guest-story-${narrative.id}`}
      aria-labelledby={`guest-story-title-${narrative.id}`}
    >
      <div className="guest-ministry-story-number" aria-hidden="true">
        {primary ? "01" : `0${storyNumber(narrative.id)}`}
      </div>
      <div className="guest-ministry-story-body">
        <header className="guest-ministry-story-header">
          <p className="eyebrow">{narrative.eyebrow}</p>
          <h2 id={`guest-story-title-${narrative.id}`}>{narrative.headline}</h2>
          <p className="guest-ministry-change">{narrative.whatChanged}</p>
          <dl className="guest-ministry-context">
            <div>
              <dt>Where</dt>
              <dd>{narrative.ministryArea}</dd>
            </div>
            <div>
              <dt>Who</dt>
              <dd>{narrative.people.join(", ")}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{narrative.timeframe}</dd>
            </div>
          </dl>
        </header>

        <section className="guest-ministry-meaning" aria-labelledby={`meaning-${narrative.id}`}>
          <h3 id={`meaning-${narrative.id}`}>Why it may deserve attention</h3>
          {narrative.whyItMayMatter.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>

        <section className="guest-ministry-evidence-summary" aria-labelledby={`evidence-summary-${narrative.id}`}>
          <h3 id={`evidence-summary-${narrative.id}`}>What the records show</h3>
          <div>
            {visibleEvidence.map((evidence) => (
              <div className="guest-ministry-evidence-line" key={evidence.label}>
                <span>{evidence.label}</span>
                <strong>{evidence.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <blockquote className="guest-ministry-question">
          <span>Question for leadership</span>
          <p>{narrative.discernmentQuestion}</p>
        </blockquote>

        <div className="guest-ministry-actions">
          <details
            className="guest-ministry-evidence-drawer"
            open={evidenceOpen}
            onToggle={(event) => onEvidenceChange(event.currentTarget.open)}
          >
            <summary className="button">
              <Search aria-hidden="true" />
              Inspect evidence
            </summary>
            <EvidenceDetail narrative={narrative} />
          </details>
          <button className="button primary" type="button" aria-expanded={emmaOpen} onClick={onEmmaToggle}>
            <MessageCircle aria-hidden="true" />
            {emmaOpen ? "Close EMMA" : "Discuss with EMMA"}
          </button>
        </div>

        {emmaOpen ? (
          <div className="guest-ministry-emma-handoff">
            <p>
              EMMA is receiving only this selected narrative, its approved evidence, its limitations, and the
              leadership question below.
            </p>
            <MinistryEmmaPanel
              allowProposal={false}
              defaultExpanded
              key={narrative.id}
              page="dashboard"
              promptTemplates={[narrative.discernmentQuestion]}
              selectedGuestNarrativeId={narrative.id}
              staticSignals={narrative.evidence.map((item) => `${item.label}: ${item.value}`)}
              title="Discuss this pattern with EMMA"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function EvidenceDetail({ narrative }: { narrative: GuestMinistryNarrative }) {
  return (
    <div className="guest-ministry-evidence-detail">
      <header>
        <p className="eyebrow">Canonical evidence</p>
        <h3>{narrative.headline}</h3>
        <p>Every statement below includes its deterministic calculation, source dates, and canonical record IDs.</p>
      </header>
      <div className="guest-ministry-evidence-detail-list">
        {narrative.evidence.map((evidence) => (
          <section key={evidence.label}>
            <span>{evidence.label}</span>
            <strong>{evidence.value}</strong>
            <p>{evidence.explanation}</p>
            <dl>
              <div>
                <dt>Calculation</dt>
                <dd>{evidence.calculation}</dd>
              </div>
              <div>
                <dt>Source dates</dt>
                <dd>{evidence.sourceDateRange}</dd>
              </div>
            </dl>
            <details className="guest-ministry-source-records">
              <summary>{evidence.sourceRecords.length} canonical source records</summary>
              <ul>
                {evidence.sourceRecords.map((record) => (
                  <li key={`${evidence.label}-${record.type}-${record.id}`}>
                    <code>{record.id}</code>
                    <span>{record.date ? `${record.date} · ` : ""}{record.label}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>
      <section className="guest-ministry-unknowns" aria-labelledby={`unknowns-${narrative.id}`}>
        <h3 id={`unknowns-${narrative.id}`}>What remains unknown</h3>
        <ul>
          {narrative.unknowns.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}

function storyNumber(id: GuestMinistryNarrativeId) {
  return id === "staff-responsibility-concentration" ? 2 : id === "volunteer-serving-pattern" ? 3 : 4;
}

function shortPatternLabel(id: GuestMinistryNarrativeId) {
  if (id === "staff-responsibility-concentration") return "Shared staff responsibility";
  if (id === "volunteer-serving-pattern") return "Volunteer serving rhythm";
  if (id === "small-group-growth") return "Small-group relational scale";
  return "Participation rhythm";
}
