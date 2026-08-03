"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit3, RotateCcw, Save, X } from "lucide-react";

import { MinistryNarrativeSequence } from "@/components/ministry-narrative-sequence";
import { StatusBadge } from "@/components/platform-ui";
import type { MinistryOverview } from "@/lib/data/ministry-repository";
import {
  defaultMinistryAlignmentProfile,
  MINISTRY_ALIGNMENT_STORAGE_KEY,
  normalizeMinistryAlignmentProfile,
  type MinistryAlignmentProfile
} from "@/lib/ministry/alignment";
import type { AuthenticatedMinistryNarrative } from "@/lib/ministry/authenticated-narratives";

export function MinistryAlignmentWorkspace({
  initialProfile,
  narratives,
  overview
}: {
  initialProfile: MinistryAlignmentProfile;
  narratives: AuthenticatedMinistryNarrative[];
  overview: MinistryOverview;
}) {
  const [profile, setProfile] = useState(() => normalizeMinistryAlignmentProfile(initialProfile));
  const [editOpen, setEditOpen] = useState(false);

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
      // Local persistence remains a convenience boundary until alignment storage is approved.
    }
  }

  function resetProfile() {
    setProfile(defaultMinistryAlignmentProfile);
    try {
      window.localStorage.removeItem(MINISTRY_ALIGNMENT_STORAGE_KEY);
    } catch {
      // The in-memory reset still succeeds when browser storage is unavailable.
    }
  }

  return (
    <section className="guest-ministry-hub authenticated-ministry-hub" aria-label="Authenticated Ministry Hub narrative review">
      <header className="guest-ministry-intro authenticated-ministry-intro">
        <p className="eyebrow">Leadership context</p>
        <h2>Ministry Alignment</h2>
        <p>
          Leadership-authored direction gives every operational pattern its context. The records below support prayerful discussion without setting ministry priorities for the team.
        </p>
      </header>

      <MinistryAlignmentPanel profile={profile} onEdit={() => setEditOpen(true)} onReset={resetProfile} />

      <header className="authenticated-ministry-pattern-intro">
        <p className="eyebrow">Current ministry patterns</p>
        <h2>What deserves leadership attention?</h2>
        <p>
          These narratives use only authenticated ministry records. Missing sources remain visible as evidence gaps instead of being replaced with demo data.
        </p>
      </header>

      <MinistryNarrativeSequence
        alignmentProfile={profile}
        mode="authenticated"
        narratives={narratives}
        overview={overview}
      />

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
    </section>
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

      <div className="ministry-alignment-statement-row" aria-label="Vision and mission">
        <AlignmentBlock label="Vision" text={profile.vision} variant="quote" />
        <AlignmentBlock label="Mission" text={profile.mission} variant="quote" />
      </div>

      <div className="ministry-alignment-grid">
        <div className="ministry-alignment-block ministry-alignment-list-card">
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
        <div className="ministry-alignment-block ministry-alignment-list-card ministry-alignment-success-card">
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

function AlignmentBlock({ label, text, variant = "default" }: { label: string; text: string; variant?: "default" | "quote" }) {
  return (
    <div className={variant === "quote" ? "ministry-alignment-block ministry-alignment-quote-block" : "ministry-alignment-block"}>
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
