"use client";

import { useMemo, useState } from "react";

type ScriptureBuilderKind = "plan" | "study";

type BuilderFieldKey =
  | "title"
  | "audience"
  | "duration"
  | "primaryScripture"
  | "contextNotes"
  | "observationQuestion"
  | "interpretationQuestion"
  | "applicationQuestion"
  | "discussionQuestion"
  | "prayerPrompt"
  | "guardrailNotes";

type BuilderValues = Record<BuilderFieldKey, string>;

type BuilderField = {
  key: BuilderFieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

type ScriptureBuilderFormProps = {
  kind: ScriptureBuilderKind;
};

const initialPlanValues: BuilderValues = {
  title: "",
  audience: "",
  duration: "",
  primaryScripture: "",
  contextNotes: "",
  observationQuestion: "",
  interpretationQuestion: "",
  applicationQuestion: "",
  discussionQuestion: "",
  prayerPrompt: "",
  guardrailNotes: ""
};

const fields: BuilderField[] = [
  { key: "title", label: "Title", placeholder: "Exodus and Formation" },
  { key: "audience", label: "Audience", placeholder: "High school small group" },
  { key: "duration", label: "Duration", placeholder: "4 weeks" },
  { key: "primaryScripture", label: "Primary Scripture reference", placeholder: "Exodus 1-20 overview" },
  {
    key: "contextNotes",
    label: "Context notes",
    placeholder: "Where does this passage sit in the book and the wider story?",
    multiline: true
  },
  {
    key: "observationQuestion",
    label: "Observation question",
    placeholder: "What should the group notice in the text first?",
    multiline: true
  },
  {
    key: "interpretationQuestion",
    label: "Interpretation question",
    placeholder: "What does the passage mean in context?",
    multiline: true
  },
  {
    key: "applicationQuestion",
    label: "Application question",
    placeholder: "How should we respond faithfully without making the passage mainly about us?",
    multiline: true
  },
  {
    key: "discussionQuestion",
    label: "Discussion question",
    placeholder: "What question will help the group wrestle together with humility?",
    multiline: true
  },
  {
    key: "prayerPrompt",
    label: "Prayer prompt",
    placeholder: "How can prayer respond to what this passage reveals?",
    multiline: true
  },
  {
    key: "guardrailNotes",
    label: "Theological guardrail notes",
    placeholder: "What should the group avoid flattening, forcing, or overstating?",
    multiline: true
  }
];

const studyPlaceholders: Partial<Record<BuilderFieldKey, string>> = {
  title: "What does Jesus mean by kingdom?",
  audience: "Student-led small group",
  duration: "45 minutes",
  primaryScripture: "Mark 1:14-20",
  contextNotes: "What does the group need to know before reading this passage?",
  observationQuestion: "What details, repeated words, or contrasts should students notice?",
  interpretationQuestion: "What is the passage teaching in its original context?",
  applicationQuestion: "What faithful response fits the text and our community?",
  discussionQuestion: "What question invites honest wrestling instead of quick answers?",
  prayerPrompt: "How should this passage shape praise, confession, request, or trust?",
  guardrailNotes: "What direct teaching, inference, or creative connection needs to be named carefully?"
};

const previewMessage = "Preview generated locally. Use Ask for the live saved review workflow.";

export function ScriptureBuilderForm({ kind }: ScriptureBuilderFormProps) {
  const [values, setValues] = useState<BuilderValues>(initialPlanValues);
  const [message, setMessage] = useState("Planning worksheet only. No draft has been saved.");
  const labels = builderLabels(kind);

  const visibleFields = useMemo(
    () => fields.map((field) => ({ ...field, placeholder: kind === "study" ? studyPlaceholders[field.key] ?? field.placeholder : field.placeholder })),
    [kind]
  );

  function updateValue(key: BuilderFieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
      <form className="panel grid gap-5 bg-white" aria-label={labels.formLabel} onSubmit={(event) => event.preventDefault()}>
        <div className="grid gap-4 md:grid-cols-2">
          {visibleFields.slice(0, 4).map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <input
                className="input"
                name={field.key}
                onChange={(event) => updateValue(field.key, event.target.value)}
                placeholder={field.placeholder}
                type="text"
                value={values[field.key]}
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4">
          {visibleFields.slice(4).map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <textarea
                className="input min-h-24 resize-y"
                name={field.key}
                onChange={(event) => updateValue(field.key, event.target.value)}
                placeholder={field.placeholder}
                value={values[field.key]}
              />
            </label>
          ))}
        </div>

        <section className={labels.guardrailClassName} aria-label={labels.guardrailLabel}>
          <h2 className={labels.guardrailHeadingClassName}>{labels.guardrailTitle}</h2>
          <p className={labels.guardrailTextClassName}>{labels.guardrailBody}</p>
        </section>

        <div className="toolbar">
          <button className="button primary" onClick={() => setMessage(previewMessage)} type="button">
            Preview
          </button>
          <a className="button" href="/student/scripture/questions">
            Open Ask
          </a>
        </div>
        <p className="m-0 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-bold leading-6 text-blue-900" role="status">
          {message}
        </p>
      </form>

      <PreviewPanel kind={kind} values={values} />
    </div>
  );
}

function PreviewPanel({ kind, values }: { kind: ScriptureBuilderKind; values: BuilderValues }) {
  const labels = builderLabels(kind);

  return (
    <aside className="panel grid gap-4 bg-white" aria-label={labels.previewLabel}>
      <div className="grid gap-2">
        <p className="eyebrow">Preview only</p>
        <h2 className="section-title flush">{previewValue(values.title, labels.fallbackTitle)}</h2>
        <p className="m-0 text-sm font-bold leading-6 text-slate-600">
          This planning worksheet does not save. Use Ask when a real question needs leader
          review, AI-assisted drafting, approval, and sharing.
        </p>
      </div>

      <div className="grid gap-2 rounded-md border border-[var(--line)] bg-slate-50 p-3">
        <PreviewRow label="Audience" value={previewValue(values.audience, "Choose who this is for")} />
        <PreviewRow label="Duration" value={previewValue(values.duration, kind === "study" ? "Add study length" : "Add plan length")} />
        <PreviewRow label="Primary Scripture" value={previewValue(values.primaryScripture, "Add a Scripture reference")} />
      </div>

      {kind === "study" ? (
        <section className="grid gap-3 rounded-md border border-[var(--line)] bg-slate-50 p-3">
          <h3 className="m-0 text-base font-black text-slate-950">Student-led study outline</h3>
          <PreviewBlock label="Context before discussion" value={values.contextNotes} />
          <PreviewBlock label="Observation" value={values.observationQuestion} />
          <PreviewBlock label="Interpretation" value={values.interpretationQuestion} />
          <PreviewBlock label="Application" value={values.applicationQuestion} />
          <PreviewBlock label="Community discussion" value={values.discussionQuestion} />
          <PreviewBlock label="Prayer" value={values.prayerPrompt} />
          <PreviewBlock label="Theological guardrails" value={values.guardrailNotes} />
        </section>
      ) : (
        <section className="grid gap-3 rounded-md border border-[var(--line)] bg-slate-50 p-3">
          <h3 className="m-0 text-base font-black text-slate-950">Reading plan preview</h3>
          <PreviewBlock label="Context notes" value={values.contextNotes} />
          <PreviewBlock label="Observation question" value={values.observationQuestion} />
          <PreviewBlock label="Interpretation question" value={values.interpretationQuestion} />
          <PreviewBlock label="Application question" value={values.applicationQuestion} />
          <PreviewBlock label="Discussion question" value={values.discussionQuestion} />
          <PreviewBlock label="Prayer prompt" value={values.prayerPrompt} />
          <PreviewBlock label="Theological guardrail notes" value={values.guardrailNotes} />
        </section>
      )}
    </aside>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-black uppercase tracking-[0.06em] text-slate-500">{label}</span>
      <strong className="text-sm leading-6 text-slate-900">{value}</strong>
    </div>
  );
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0">
      <span className="text-xs font-black uppercase tracking-[0.06em] text-[var(--primary)]">{label}</span>
      <p className="m-0 text-sm font-semibold leading-6 text-slate-700">{previewValue(value, "Add draft notes to preview this section.")}</p>
    </div>
  );
}

function previewValue(value: string, fallback: string) {
  return value.trim() || fallback;
}

function builderLabels(kind: ScriptureBuilderKind) {
  if (kind === "study") {
    return {
      fallbackTitle: "Untitled student-led study",
      formLabel: "New Student-Led Study builder",
      guardrailBody:
        "Student-led studies should be clear about what Scripture directly teaches, what the group is inferring, and what connections are creative. Use Ask when a real discussion needs saved leader review.",
      guardrailClassName: "grid gap-3 rounded-md border border-blue-200 bg-blue-50 p-4",
      guardrailHeadingClassName: "m-0 text-base font-black text-blue-950",
      guardrailLabel: "Leader review reminder",
      guardrailTextClassName: "m-0 text-sm font-bold leading-6 text-blue-900",
      guardrailTitle: "Leader review guardrail",
      previewLabel: "Student-Led Study local preview"
    };
  }

  return {
    fallbackTitle: "Untitled reading plan",
    formLabel: "New Reading Plan builder",
    guardrailBody:
      "Planning worksheet only: reading-plan drafts are not saved here. Use Ask when a real group discussion needs leader review before sharing.",
    guardrailClassName: "grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4",
    guardrailHeadingClassName: "m-0 text-base font-black text-amber-950",
    guardrailLabel: "Draft-only reminder",
    guardrailTextClassName: "m-0 text-sm font-bold leading-6 text-amber-900",
    guardrailTitle: "Planning worksheet",
    previewLabel: "Reading Plan local preview"
  };
}
