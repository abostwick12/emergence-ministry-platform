"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, BookOpenCheck, ExternalLink, MessageCircle, Search, ShieldCheck } from "lucide-react";

import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import type { MinistryOverview } from "@/lib/data/ministry-repository";
import { buildGuestNarrativeEmmaResponse, type GuestMinistryNarrativeId } from "@/lib/guest/ministry-narratives";
import type { MinistryAlignmentProfile } from "@/lib/ministry/alignment";
import { buildAuthenticatedNarrativeEmmaResponse, type AuthenticatedMinistryNarrativeId } from "@/lib/ministry/authenticated-narratives";
import { defaultNarrativeSignal, rankMinistryNarratives } from "@/lib/ministry/narrative-ranking";
import type { MinistryNarrative } from "@/lib/ministry/narrative-types";

export function MinistryNarrativeSequence({
  alignmentProfile,
  mode,
  narratives,
  overview
}: {
  alignmentProfile?: MinistryAlignmentProfile;
  mode: "authenticated" | "guest";
  narratives: MinistryNarrative[];
  overview?: MinistryOverview;
}) {
  const [selectedEmmaNarrativeId, setSelectedEmmaNarrativeId] = useState<string | null>(null);
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const rankedNarratives = useMemo(() => rankMinistryNarratives(narratives, alignmentProfile), [alignmentProfile, narratives]);
  const [primary, ...additional] = rankedNarratives;

  if (!primary) return null;

  return (
    <>
      <NarrativeStory
        alignmentProfile={alignmentProfile}
        evidenceOpen={openEvidenceId === primary.id}
        emmaOpen={selectedEmmaNarrativeId === primary.id}
        mode={mode}
        narrative={primary}
        number={1}
        onEvidenceChange={(open) => setOpenEvidenceId(open ? primary.id : null)}
        onEmmaToggle={() => setSelectedEmmaNarrativeId((current) => current === primary.id ? null : primary.id)}
        overview={overview}
        primary
      />

      <nav className="guest-ministry-pattern-index" aria-label={`${additional.length} additional ministry patterns`}>
        <div>
          <span>{additional.length} additional patterns</span>
          <p>Continue through the ministry story, not a dashboard grid.</p>
        </div>
        <div className="guest-ministry-pattern-links">
          {additional.map((narrative, index) => (
            <a key={narrative.id} href={`#ministry-story-${narrative.id}`}>
              <span>0{index + 2}</span>
              <span className="guest-ministry-pattern-link-copy">
                <strong>{narrative.navigationLabel}</strong>
                <small>{signalFor(narrative).attention === "high" ? "High attention" : signalFor(narrative).attention === "watch" ? "Watch closely" : "Build context"} · {signalFor(narrative).confidence} confidence</small>
              </span>
              <ArrowDown aria-hidden="true" />
            </a>
          ))}
        </div>
      </nav>

      <div className="guest-ministry-story-sequence">
        {additional.map((narrative, index) => (
          <NarrativeStory
            alignmentProfile={alignmentProfile}
            evidenceOpen={openEvidenceId === narrative.id}
            emmaOpen={selectedEmmaNarrativeId === narrative.id}
            key={narrative.id}
            mode={mode}
            narrative={narrative}
            number={index + 2}
            onEvidenceChange={(open) => setOpenEvidenceId(open ? narrative.id : null)}
            onEmmaToggle={() => setSelectedEmmaNarrativeId((current) => current === narrative.id ? null : narrative.id)}
            overview={overview}
          />
        ))}
      </div>

      <NarrativeMethod mode={mode} />
    </>
  );
}

function NarrativeStory({
  alignmentProfile,
  evidenceOpen,
  emmaOpen,
  mode,
  narrative,
  number,
  onEvidenceChange,
  onEmmaToggle,
  overview,
  primary = false
}: {
  alignmentProfile?: MinistryAlignmentProfile;
  evidenceOpen: boolean;
  emmaOpen: boolean;
  mode: "authenticated" | "guest";
  narrative: MinistryNarrative;
  number: number;
  onEvidenceChange: (open: boolean) => void;
  onEmmaToggle: () => void;
  overview?: MinistryOverview;
  primary?: boolean;
}) {
  const visibleEvidence = primary ? narrative.evidence.slice(0, 3) : narrative.evidence;
  const evidenceGap = narrative.status === "insufficient_evidence";
  const storySignal = signalFor(narrative);

  return (
    <article
      className={`guest-ministry-story${primary ? " guest-ministry-story-primary" : ""}${evidenceGap ? " ministry-narrative-evidence-gap" : ""}`}
      id={`ministry-story-${narrative.id}`}
      aria-labelledby={`ministry-story-title-${narrative.id}`}
    >
      <div className="guest-ministry-story-number" aria-hidden="true">{String(number).padStart(2, "0")}</div>
      <div className="guest-ministry-story-body">
        <header className="guest-ministry-story-header">
          <p className="eyebrow">{narrative.eyebrow}</p>
          <div className="ministry-narrative-signal-strip" aria-label="Signal quality">
            <span className={`ministry-signal-attention ${storySignal.attention}`}>{storySignal.attention === "high" ? "High attention" : storySignal.attention === "watch" ? "Watch closely" : "Build context"}</span>
            <span>{storySignal.confidence} confidence</span>
            <span>{storySignal.freshness}</span>
          </div>
          <h2 id={`ministry-story-title-${narrative.id}`}>{narrative.headline}</h2>
          <div className="guest-ministry-change">
            <span>{evidenceGap ? "Evidence status" : "What changed"}</span>
            <p>{narrative.whatChanged}</p>
          </div>
        </header>

        {visibleEvidence.length ? (
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
        ) : (
          <section className="ministry-narrative-gap-summary" aria-label="Evidence needed">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h3>Evidence needed</h3>
              <p>No sample values or guest records have been substituted for this missing ministry evidence.</p>
            </div>
          </section>
        )}

        <blockquote className="guest-ministry-question">
          <span>Question for leadership</span>
          <p>{narrative.discernmentQuestion}</p>
        </blockquote>

        <div className="guest-ministry-actions">
          {narrative.evidence.length ? (
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
          ) : narrative.action ? (
            <Link className="button" href={narrative.action.href}>
              <Search aria-hidden="true" />
              {narrative.action.label}
            </Link>
          ) : null}
          {narrative.evidence.length && narrative.action ? (
            <Link className="button" href={narrative.action.href}>
              <ExternalLink aria-hidden="true" />
              {narrative.action.label}
            </Link>
          ) : null}
          <button className="button primary" type="button" aria-expanded={emmaOpen} onClick={onEmmaToggle}>
            <MessageCircle aria-hidden="true" />
            {emmaOpen ? "Close EMMA" : "Discuss with EMMA"}
          </button>
        </div>

        <section className="guest-ministry-meaning" aria-labelledby={`meaning-${narrative.id}`}>
          <h3 id={`meaning-${narrative.id}`}>Why it deserves attention</h3>
          <p className="ministry-narrative-surfaced"><strong>Why this surfaced:</strong> {storySignal.whySurfaced}</p>
          {narrative.whyItMayMatter.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>

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
          <div>
            <dt>Evidence coverage</dt>
            <dd>{storySignal.coverage}</dd>
          </div>
        </dl>

        <aside className="guest-ministry-boundary" aria-labelledby={`boundary-${narrative.id}`}>
          <ShieldCheck aria-hidden="true" />
          <div>
            <h3 id={`boundary-${narrative.id}`}>What the records cannot conclude</h3>
            <p>{narrative.unknowns[0]}</p>
          </div>
        </aside>

        {emmaOpen ? (
          <div className="guest-ministry-emma-handoff">
            <p>
              EMMA is receiving only this selected narrative, its approved evidence, its limitations, and the leadership question below.
            </p>
            <MinistryEmmaPanel
              alignmentProfile={alignmentProfile}
              allowProposal={false}
              defaultExpanded
              initialResponse={mode === "authenticated"
                ? buildAuthenticatedNarrativeEmmaResponse(narrative as Parameters<typeof buildAuthenticatedNarrativeEmmaResponse>[0])
                : buildGuestNarrativeEmmaResponse(narrative as Parameters<typeof buildGuestNarrativeEmmaResponse>[0], narrative.discernmentQuestion)}
              key={narrative.id}
              overview={overview}
              page="ministry"
              promptTemplates={[narrative.discernmentQuestion]}
              selectedGuestNarrativeId={mode === "guest" ? narrative.id as GuestMinistryNarrativeId : undefined}
              selectedMinistryNarrativeId={mode === "authenticated" ? narrative.id as AuthenticatedMinistryNarrativeId : undefined}
              staticSignals={narrative.evidence.length
                ? narrative.evidence.map((item) => `${item.label}: ${item.value}`)
                : [`Evidence gap: ${narrative.whatChanged}`, `Unknown: ${narrative.unknowns[0]}`]}
              title={evidenceGap ? "Discuss this evidence gap with EMMA" : "Discuss this pattern with EMMA"}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function signalFor(narrative: MinistryNarrative) {
  return narrative.signal ?? defaultNarrativeSignal(narrative);
}

function EvidenceDetail({ narrative }: { narrative: MinistryNarrative }) {
  return (
    <div className="guest-ministry-evidence-detail">
      <header>
        <p className="eyebrow">Canonical evidence</p>
        <h3>{narrative.headline}</h3>
        <p>Every statement below includes its deterministic calculation, source dates, and canonical record references.</p>
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

function NarrativeMethod({ mode }: { mode: "authenticated" | "guest" }) {
  const authenticated = mode === "authenticated";
  return (
    <details className="guest-ministry-method">
      <summary>
        <BookOpenCheck aria-hidden="true" />
        How these patterns were surfaced
      </summary>
      <div className="guest-ministry-method-body">
        <div>
          <h3>Leadership-authored context</h3>
          <p>
            Leadership defines the ministry&apos;s direction. These patterns provide operational context for prayerful discussion; they do not turn records into spiritual verdicts.
          </p>
        </div>
        <div>
          <h3>Governed interpretation</h3>
          <p>
            {authenticated
              ? "Deterministic selectors use only authenticated, ministry-scoped events, tasks, volunteer records, small groups, and previously synced Planning Center attendance. Missing sources remain visible as evidence gaps."
              : "Deterministic selectors compare the isolated guest attendance, task ownership, serving assignments, and small-group records. Guest EMMA cannot send, write, synchronize, or retrieve private sources."}
          </p>
        </div>
        <div className="guest-ministry-method-boundary">
          <ShieldCheck aria-hidden="true" />
          <p>
            {authenticated
              ? "No guest fixtures are used here. Student identities are excluded from narrative and EMMA context; software does not determine God’s will, spiritual health, calling, or pastoral action."
              : "Synthetic guest history only. Scripture and organizational memory provide ministry context; software does not determine God’s will, spiritual health, calling, or pastoral action."}
          </p>
        </div>
      </div>
    </details>
  );
}
