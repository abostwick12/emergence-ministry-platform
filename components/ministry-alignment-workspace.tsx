"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit3, RotateCcw, Save, X } from "lucide-react";

import {
  DecisionMetricGrid,
  DecisionSignalList,
  EvidenceStack,
  JudgedIntegrationFlowList,
  LeadershipAttentionList,
  ResponsibilityVisibilityList
} from "@/components/decision-center";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, QuietState, StatusBadge } from "@/components/platform-ui";
import { buildMinistryDecisionCenterState } from "@/lib/decision-center/ministry";
import type { MinistryOverview } from "@/lib/data/ministry-repository";
import {
  buildAlignmentContextSummary,
  defaultMinistryAlignmentProfile,
  MINISTRY_ALIGNMENT_CHAIN,
  MINISTRY_ALIGNMENT_STORAGE_KEY,
  normalizeMinistryAlignmentProfile,
  type MinistryAlignmentProfile
} from "@/lib/ministry/alignment";

const ministryHubPrompts = [
  "What do our current signals say about this season?",
  "Where does the evidence support our Success Looks Like criteria?",
  "Where is the evidence mixed or incomplete?",
  "Are our events consistent with our mission?",
  "What responsibilities are keeping the ministry moving?",
  "What evidence should leadership review before making a change?",
  "How would adding another event affect our current season focus?",
  "Which signals are not currently visible enough to assess?"
] as const;

export function MinistryAlignmentWorkspace({
  generatedAt,
  initialProfile,
  overview
}: {
  generatedAt: string;
  initialProfile: MinistryAlignmentProfile;
  overview: MinistryOverview;
}) {
  const [profile, setProfile] = useState(() => normalizeMinistryAlignmentProfile(initialProfile));
  const [editOpen, setEditOpen] = useState(false);
  const center = useMemo(
    () => buildMinistryDecisionCenterState(overview, new Date(generatedAt), profile),
    [generatedAt, overview, profile]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MINISTRY_ALIGNMENT_STORAGE_KEY);
      if (raw) setProfile(normalizeMinistryAlignmentProfile(JSON.parse(raw)));
    } catch {
      setProfile(normalizeMinistryAlignmentProfile(initialProfile));
    }
  }, [initialProfile]);

  function saveProfile(nextProfile: MinistryAlignmentProfile) {
    const normalized = normalizeMinistryAlignmentProfile({
      ...nextProfile,
      lastUpdated: new Date().toISOString().slice(0, 10)
    });
    setProfile(normalized);
    try {
      window.localStorage.setItem(MINISTRY_ALIGNMENT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Local persistence is a convenience boundary for the competition demo.
    }
  }

  function resetProfile() {
    setProfile(defaultMinistryAlignmentProfile);
    try {
      window.localStorage.removeItem(MINISTRY_ALIGNMENT_STORAGE_KEY);
    } catch {
      // Nothing else needs to happen if local storage is unavailable.
    }
  }

  return (
    <>
      <EditorialSection
        eyebrow="Leadership-authored context"
        title="Alignment profile"
        description="Compare observable ministry life with the Vision, Mission, Values, Current Season, and Success Looks Like statements leaders have named."
      >
        <MinistryAlignmentPanel profile={profile} onEdit={() => setEditOpen(true)} onReset={resetProfile} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Decision conversation"
        title="Ask EMMA"
        description="EMMA can compare current evidence with leadership-authored criteria, but it does not set priorities or issue ministry verdicts."
      >
        <MinistryEmmaPanel
          defaultExpanded
          alignmentProfile={profile}
          overview={overview}
          page="dashboard"
          title="Ask EMMA"
          promptTemplates={ministryHubPrompts}
          staticSignals={[
            ...buildAlignmentContextSummary(profile),
            ...center.signals.map((signal) => `${signal.title}: ${signal.summary}`)
          ]}
        />
      </EditorialSection>

      <EditorialSection
        eyebrow="Decision evidence"
        title={`Current signals for ${center.direction.emphasis}`}
        description="Signals are factual observations with definitions, evidence boundaries, and no verdict labels."
      >
        <DecisionSignalList signals={center.signals} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Evidence"
        title="What EMMA is allowed to consider"
        description="Evidence stays visible by default so leadership can inspect sources before acting."
      >
        <EvidenceStack signals={center.signals} />
        <details className="provider-path-disclosure">
          <summary>Provider path and judged Scripture flow</summary>
          <JudgedIntegrationFlowList flows={center.judgedIntegrationFlows} />
        </details>
      </EditorialSection>

      <EditorialSection
        eyebrow="Leadership Attention"
        title="Questions for discernment"
        description="These are advisory prompts for discussion, not autonomous priorities."
      >
        <LeadershipAttentionList items={center.attention} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Responsibility Visibility"
        title="Existing ownership signals"
        description="This view reuses event owners and task assignees only. It does not infer burnout, capacity, performance, or staffing need."
      >
        <ResponsibilityVisibilityList items={center.responsibility} />
      </EditorialSection>

      <details className="alignment-model-disclosure">
        <summary>Canonical alignment chain</summary>
        <ol>
          {MINISTRY_ALIGNMENT_CHAIN.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <QuietState title="Scoring intentionally deferred">
          No mission score, weighted alignment status, or autonomous ministry priority engine has been approved for this phase.
        </QuietState>
      </details>

      {editOpen ? (
        <AlignmentEditorDialog
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSave={(nextProfile) => {
            saveProfile(nextProfile);
            setEditOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function MinistryAlignmentPanel({
  onEdit,
  onReset,
  profile
}: {
  onEdit: () => void;
  onReset: () => void;
  profile: MinistryAlignmentProfile;
}) {
  return (
    <article className="ministry-alignment-panel" aria-label="Ministry Alignment">
      <header className="ministry-alignment-header">
        <div>
          <p className="eyebrow">Current Season</p>
          <h3>{profile.currentSeason.title}</h3>
          <p>{profile.currentSeason.description}</p>
        </div>
        <div className="ministry-alignment-actions">
          <StatusBadge tone="success">{profile.currentSeason.status}</StatusBadge>
          <button className="button compact-button" type="button" onClick={onEdit}>
            <Edit3 aria-hidden="true" />
            Edit
          </button>
          <button className="button ghost compact-button" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="ministry-alignment-grid">
        <AlignmentBlock label="Vision" text={profile.vision} />
        <AlignmentBlock label="Mission" text={profile.mission} />
        <div className="ministry-alignment-block">
          <span>Values</span>
          <ul>
            {profile.values.map((value) => (
              <li key={value.id}>
                <strong>{value.title}</strong>
                <p>{value.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="ministry-alignment-block">
          <span>Success Looks Like</span>
          <ul>
            {profile.successLooksLike.map((criterion) => <li key={criterion}>{criterion}</li>)}
          </ul>
        </div>
      </div>

      <dl className="ministry-alignment-meta">
        <div>
          <dt>Owner</dt>
          <dd>{profile.owner}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{profile.lastUpdated}</dd>
        </div>
        <div>
          <dt>Review date</dt>
          <dd>{profile.reviewDate ?? profile.currentSeason.reviewDate ?? "Not set"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AlignmentBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="ministry-alignment-block">
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}

function AlignmentEditorDialog({
  onClose,
  onSave,
  profile
}: {
  onClose: () => void;
  onSave: (profile: MinistryAlignmentProfile) => void;
  profile: MinistryAlignmentProfile;
}) {
  const [draft, setDraft] = useState(() => normalizeMinistryAlignmentProfile(profile));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div className="alignment-editor-backdrop">
      <form className="alignment-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="alignment-editor-title" onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">Leadership-authored</p>
            <h3 id="alignment-editor-title">Edit Ministry Alignment</h3>
          </div>
          <button className="icon-button" type="button" aria-label="Close alignment editor" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="alignment-editor-grid">
          <label className="field">
            <span>Vision</span>
            <textarea className="input" rows={3} value={draft.vision} onChange={(event) => setDraft({ ...draft, vision: event.target.value })} />
          </label>
          <label className="field">
            <span>Mission</span>
            <textarea className="input" rows={3} value={draft.mission} onChange={(event) => setDraft({ ...draft, mission: event.target.value })} />
          </label>
          <label className="field">
            <span>Current Season</span>
            <input className="input" value={draft.currentSeason.title} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, title: event.target.value } })} />
          </label>
          <label className="field">
            <span>Season owner</span>
            <input className="input" value={draft.currentSeason.owner} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, owner: event.target.value }, owner: event.target.value })} />
          </label>
          <label className="field wide">
            <span>Season description</span>
            <textarea className="input" rows={3} value={draft.currentSeason.description} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, description: event.target.value } })} />
          </label>
          <label className="field">
            <span>Start date</span>
            <input className="input" type="date" value={draft.currentSeason.startDate} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, startDate: event.target.value } })} />
          </label>
          <label className="field">
            <span>Review date</span>
            <input className="input" type="date" value={draft.currentSeason.reviewDate ?? ""} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, reviewDate: event.target.value || null }, reviewDate: event.target.value || null })} />
          </label>
        </div>

        <EditableList
          label="Values"
          addLabel="Add value"
          items={draft.values.map((value) => ({ id: value.id, title: value.title, body: value.description }))}
          onChange={(items) => setDraft({
            ...draft,
            values: items.map((item, index) => ({ id: item.id, title: item.title, description: item.body, displayOrder: index + 1 }))
          })}
        />

        <EditableList
          label="Success Looks Like"
          addLabel="Add success criterion"
          bodyOnly
          items={draft.successLooksLike.map((criterion, index) => ({ id: `success-${index}`, title: "", body: criterion }))}
          onChange={(items) => setDraft({ ...draft, successLooksLike: items.map((item) => item.body).filter(Boolean).slice(0, 5) })}
        />

        <p className="alignment-editor-guardrail">
          EMMA may compare evidence against this context, but leadership remains responsible for priorities, discernment, theology, and decisions.
        </p>

        <div className="toolbar split">
          <button className="button ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="button primary" type="submit">
            <Save aria-hidden="true" />
            Save alignment
          </button>
        </div>
      </form>
    </div>
  );
}

function EditableList({
  addLabel,
  bodyOnly = false,
  items,
  label,
  onChange
}: {
  addLabel: string;
  bodyOnly?: boolean;
  items: Array<{ id: string; title: string; body: string }>;
  label: string;
  onChange: (items: Array<{ id: string; title: string; body: string }>) => void;
}) {
  const visibleItems = items.length ? items : [{ id: `${label.toLowerCase()}-1`, title: "", body: "" }];
  return (
    <section className="alignment-editor-list" aria-label={label}>
      <header>
        <strong>{label}</strong>
        <button
          className="button compact-button"
          type="button"
          onClick={() => onChange([...visibleItems, { id: `${label.toLowerCase()}-${Date.now()}`, title: "", body: "" }].slice(0, bodyOnly ? 5 : 7))}
        >
          {addLabel}
        </button>
      </header>
      {visibleItems.map((item, index) => (
        <div className={bodyOnly ? "alignment-editor-list-row body-only" : "alignment-editor-list-row"} key={item.id}>
          {bodyOnly ? null : (
            <label className="field">
              <span>Title</span>
              <input className="input" value={item.title} onChange={(event) => onChange(replaceItem(visibleItems, index, { ...item, title: event.target.value }))} />
            </label>
          )}
          <label className="field">
            <span>{bodyOnly ? "Criterion" : "Description"}</span>
            <textarea className="input" rows={bodyOnly ? 2 : 3} value={item.body} onChange={(event) => onChange(replaceItem(visibleItems, index, { ...item, body: event.target.value }))} />
          </label>
          <button className="button ghost compact-button" type="button" onClick={() => onChange(visibleItems.filter((_, itemIndex) => itemIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

function replaceItem<T>(items: T[], index: number, nextItem: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
}
