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

type ReadingPlanDraft = {
  provider: "gloo" | "gemini" | "openai";
  model: string;
  modelReason: string;
  title: string;
  audience: string;
  duration: string;
  primaryScripture: string;
  movement: string;
  summary: string;
  contextFocus: string;
  weeklyRhythm: string[];
  discussionPrompts: string[];
  guardrailNotes: string[];
  prayerPrompt: string;
  safetyNotes: string;
};

type ReadingPlanDraftResponse =
  | { ok: true; draft: ReadingPlanDraft }
  | { ok: false; code?: string; error?: string; attemptedProviders?: string[] };

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

export function ScriptureBuilderForm({ kind }: ScriptureBuilderFormProps) {
  const [values, setValues] = useState<BuilderValues>(initialPlanValues);
  const [message, setMessage] = useState("Planning worksheet only. No draft has been saved.");
  const [draft, setDraft] = useState<ReadingPlanDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const labels = builderLabels(kind);

  const visibleFields = useMemo(
    () => fields.map((field) => ({ ...field, placeholder: kind === "study" ? studyPlaceholders[field.key] ?? field.placeholder : field.placeholder })),
    [kind]
  );

  function updateValue(key: BuilderFieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function generateDraft() {
    if (kind !== "plan") {
      setMessage("Use Ask for live student-led study review.");
      return;
    }

    setIsGenerating(true);
    setMessage("Asking Meridian to draft the reading plan through Gloo-first provider routing...");
    try {
      const response = await fetch("/api/student/scripture/reading-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const payload = (await response.json()) as ReadingPlanDraftResponse;
      if (!response.ok || !payload.ok) {
        setMessage(payload.ok ? "Meridian could not generate a reading-plan draft." : payload.error ?? "Meridian could not generate a reading-plan draft.");
        return;
      }

      setDraft(payload.draft);
      setMessage(`Draft generated by ${providerLabel(payload.draft.provider)} for leader review. Nothing was published.`);
    } catch {
      setMessage("Meridian reading-plan drafting was unreachable. No draft was saved or published.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="scripture-builder-layout">
      <form className="panel scripture-builder-panel" aria-label={labels.formLabel} onSubmit={(event) => event.preventDefault()}>
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
          <h2>{labels.guardrailTitle}</h2>
          <p>{labels.guardrailBody}</p>
        </section>

        <div className="toolbar">
          <button className="button primary" disabled={isGenerating} onClick={generateDraft} type="button">
            {isGenerating ? "Generating..." : kind === "plan" ? "Generate with Meridian" : "Preview"}
          </button>
          <a className="button" href="/student/scripture/questions">
            Open Ask
          </a>
        </div>
        <p className="scripture-builder-status" role="status">
          {message}
        </p>
      </form>

      <PreviewPanel draft={draft} kind={kind} values={values} />
    </div>
  );
}

function PreviewPanel({ draft, kind, values }: { draft: ReadingPlanDraft | null; kind: ScriptureBuilderKind; values: BuilderValues }) {
  const labels = builderLabels(kind);

  return (
    <aside className="panel scripture-builder-panel scripture-builder-preview" aria-label={labels.previewLabel}>
      <div className="grid gap-2">
        <p className="eyebrow">{draft ? `${providerLabel(draft.provider)} Draft` : "Leader Review Draft"}</p>
        <h2 className="section-title flush">{draft?.title ?? previewValue(values.title, labels.fallbackTitle)}</h2>
        <p className="scripture-builder-copy">
          {draft
            ? `${draft.model} prepared this draft for leader review. Nothing has been saved, published, sent, or shared.`
            : "Generate with Meridian when this needs live AI drafting. Use Ask when a real question needs saved leader review, approval, and sharing."}
        </p>
      </div>

      <div className="scripture-builder-preview-card">
        <PreviewRow label="Audience" value={draft?.audience ?? previewValue(values.audience, "Choose who this is for")} />
        <PreviewRow label="Duration" value={draft?.duration ?? previewValue(values.duration, kind === "study" ? "Add study length" : "Add plan length")} />
        <PreviewRow label="Primary Scripture" value={draft?.primaryScripture ?? previewValue(values.primaryScripture, "Add a Scripture reference")} />
        {draft ? <PreviewRow label="Story lens" value={draft.movement} /> : null}
      </div>

      {kind === "study" ? (
        <section className="scripture-builder-preview-card">
          <h3>Student-led study outline</h3>
          <PreviewBlock label="Context before discussion" value={values.contextNotes} />
          <PreviewBlock label="Observation" value={values.observationQuestion} />
          <PreviewBlock label="Interpretation" value={values.interpretationQuestion} />
          <PreviewBlock label="Application" value={values.applicationQuestion} />
          <PreviewBlock label="Community discussion" value={values.discussionQuestion} />
          <PreviewBlock label="Prayer" value={values.prayerPrompt} />
          <PreviewBlock label="Theological guardrails" value={values.guardrailNotes} />
        </section>
      ) : (
        <section className="scripture-builder-preview-card">
          <h3>Reading plan draft</h3>
          {draft ? (
            <>
              <PreviewBlock label="Summary" value={draft.summary} />
              <PreviewBlock label="Context focus" value={draft.contextFocus} />
              <PreviewList label="Daily rhythm" values={draft.weeklyRhythm} />
              <PreviewList label="Discussion prompts" values={draft.discussionPrompts} />
              <PreviewList label="Guardrail notes" values={draft.guardrailNotes} />
              <PreviewBlock label="Prayer prompt" value={draft.prayerPrompt} />
              <PreviewBlock label="Safety notes" value={draft.safetyNotes} />
            </>
          ) : (
            <>
              <PreviewBlock label="Context notes" value={values.contextNotes} />
              <PreviewBlock label="Observation question" value={values.observationQuestion} />
              <PreviewBlock label="Interpretation question" value={values.interpretationQuestion} />
              <PreviewBlock label="Application question" value={values.applicationQuestion} />
              <PreviewBlock label="Discussion question" value={values.discussionQuestion} />
              <PreviewBlock label="Prayer prompt" value={values.prayerPrompt} />
              <PreviewBlock label="Theological guardrail notes" value={values.guardrailNotes} />
            </>
          )}
        </section>
      )}
    </aside>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="scripture-preview-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="scripture-preview-block">
      <span>{label}</span>
      <p>{previewValue(value, "Add draft notes to preview this section.")}</p>
    </div>
  );
}

function PreviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="scripture-preview-block">
      <span>{label}</span>
      <ul>
        {values.length ? values.map((value) => <li key={value}>{value}</li>) : <li>Add draft notes to generate this section.</li>}
      </ul>
    </div>
  );
}

function previewValue(value: string, fallback: string) {
  return value.trim() || fallback;
}

function providerLabel(provider: ReadingPlanDraft["provider"]) {
  if (provider === "gloo") return "Gloo";
  if (provider === "gemini") return "Gemini";
  return "OpenAI";
}

function builderLabels(kind: ScriptureBuilderKind) {
  if (kind === "study") {
    return {
      fallbackTitle: "Untitled student-led study",
      formLabel: "New Student-Led Study builder",
      guardrailBody:
        "Student-led studies should be clear about what Scripture directly teaches, what the group is inferring, and what connections are creative. Use Ask when a real discussion needs saved leader review.",
      guardrailClassName: "scripture-builder-callout",
      guardrailLabel: "Leader review reminder",
      guardrailTitle: "Leader review guardrail",
      previewLabel: "Student-Led Study draft preview"
    };
  }

  return {
    fallbackTitle: "Untitled reading plan",
    formLabel: "New Reading Plan builder",
    guardrailBody:
      "Meridian drafts reading plans for leader review only. Use Ask when a real group discussion needs saved leader review before sharing.",
    guardrailClassName: "scripture-builder-callout warning",
    guardrailLabel: "Draft-only reminder",
    guardrailTitle: "Planning worksheet",
    previewLabel: "Reading Plan draft preview"
  };
}
