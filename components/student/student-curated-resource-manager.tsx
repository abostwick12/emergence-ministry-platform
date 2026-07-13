"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Archive, Edit3, Library, Plus, Save, Search } from "lucide-react";

import type {
  StudentCuratedResource,
  StudentCuratedResourceKind,
  StudentCuratedResourceStage,
  StudentCuratedResourceState
} from "@/lib/scripture/curated-resource-shared";
import { matchCuratedResourcesToPrompt, studentCuratedResourceStageLabels } from "@/lib/scripture/curated-resource-shared";
import { getEmbeddableVideoUrl } from "@/lib/scripture/video-embed";

type StudentCuratedResourceManagerProps = {
  initialState: StudentCuratedResourceState;
  canManageVideoEmbeds: boolean;
};

type ResourceResponse = {
  ok?: boolean;
  error?: string;
  resource?: StudentCuratedResource;
};

const kindLabels: Record<StudentCuratedResourceKind, string> = {
  guide: "Short guide",
  video: "Video",
  prayer: "Guided prayer",
  reading_tool: "Reading tool",
  practice: "Practice",
  discussion_prompt: "Discussion prompt"
};

const stageDescriptions: Record<StudentCuratedResourceStage, string> = {
  ask: "Question",
  read: "Reading",
  reflect: "Reflection",
  practice: "Practice",
  discuss: "Group"
};

export function StudentCuratedResourceManager({ canManageVideoEmbeds, initialState }: StudentCuratedResourceManagerProps) {
  const [resources, setResources] = useState(initialState.resources);
  const [status, setStatus] = useState(initialState.readiness.message);
  const [editingId, setEditingId] = useState("");
  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewReference, setPreviewReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState("");
  const activeResources = useMemo(() => resources.filter((resource) => resource.isActive), [resources]);
  const previewMatches = useMemo(
    () =>
      previewQuestion.trim() || previewReference.trim()
        ? matchCuratedResourcesToPrompt(
            {
              question: previewQuestion,
              scriptureReference: previewReference
            },
            activeResources
          )
        : [],
    [activeResources, previewQuestion, previewReference]
  );
  const draftResources = resources.length - activeResources.length;
  const editingResource = resources.find((resource) => resource.id === editingId);

  async function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = formPayload(data);
    const currentId = String(data.get("id") || "");
    setSaving(true);
    setStatus(currentId ? "Saving student resource..." : "Creating student resource...");

    try {
      const response = await fetch(currentId ? `/api/student/scripture/curated-resources/${currentId}` : "/api/student/scripture/curated-resources", {
        method: currentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as ResourceResponse;
      if (!response.ok || !result.ok || !result.resource) {
        setStatus(result.error ?? "The student resource could not be saved.");
        return;
      }

      setResources((current) =>
        current.some((resource) => resource.id === result.resource!.id)
          ? current.map((resource) => (resource.id === result.resource!.id ? result.resource! : resource))
          : [result.resource!, ...current]
      );
      setEditingId(result.resource.id);
      setStatus(result.resource.isActive ? "Student resource is active in matching." : "Student resource saved as a draft.");
      if (!currentId) form.reset();
    } catch {
      setStatus("The student resource could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveResource(resourceId: string) {
    setArchivingId(resourceId);
    setStatus("Archiving resource...");
    try {
      const response = await fetch(`/api/student/scripture/curated-resources/${resourceId}`, { method: "DELETE" });
      const result = (await response.json()) as ResourceResponse;
      if (!response.ok || !result.ok || !result.resource) {
        setStatus(result.error ?? "The resource could not be archived.");
        return;
      }

      setResources((current) => current.map((resource) => (resource.id === result.resource!.id ? result.resource! : resource)));
      setStatus("Resource archived. Students will no longer see it.");
    } catch {
      setStatus("The resource could not be archived.");
    } finally {
      setArchivingId("");
    }
  }

  function startNewResource() {
    setEditingId("");
    setStatus("New resource draft ready.");
  }

  return (
    <section className="student-curated-resource-manager" aria-label="Student resource manager">
      <div className="student-curated-resource-hero">
        <div>
          <p className="eyebrow">Student Resources</p>
          <h1>Publish the student-facing helps</h1>
        </div>
        <div className="student-curated-resource-stats" aria-label="Student resource counts">
          <ResourceStat label="Active" value={activeResources.length} />
          <ResourceStat label="Drafts" value={draftResources} />
          <ResourceStat label="Storage" value={initialState.readiness.storage === "live" ? "Live" : "Local"} />
        </div>
      </div>

      <p className="leader-review-status" aria-live="polite">
        {status}
      </p>

      <MatchingPreviewPanel
        matches={previewMatches}
        onQuestionChange={setPreviewQuestion}
        onReferenceChange={setPreviewReference}
        question={previewQuestion}
        reference={previewReference}
      />

      <div className="student-curated-resource-grid">
        <ResourceForm
          canManageVideoEmbeds={canManageVideoEmbeds}
          key={editingResource?.id ?? "new"}
          onSubmit={submitResource}
          resource={editingResource}
          saving={saving}
        />

        <div className="student-curated-resource-list">
          <div className="student-curated-resource-list-head">
            <div>
              <p className="eyebrow">Published Menu</p>
              <h2>Journey resources</h2>
            </div>
            <button className="button compact" onClick={startNewResource} type="button">
              <Plus aria-hidden="true" size={15} />
              New
            </button>
          </div>

          {resources.length ? (
            resources.map((resource) => (
              <article className={resource.isActive ? "student-curated-resource-item" : "student-curated-resource-item is-draft"} key={resource.id}>
                <div>
                  <span>{kindLabels[resource.kind]}</span>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                  <small>
                    {studentCuratedResourceStageLabels[resource.journeyStage]} -{" "}
                    {resource.scriptureReferences.concat(resource.themes).slice(0, 5).join(" / ") || "Matches broad student questions"}
                  </small>
                </div>
                <div className="student-curated-resource-actions">
                  <button className="button compact" onClick={() => setEditingId(resource.id)} type="button">
                    <Edit3 aria-hidden="true" size={15} />
                    Edit
                  </button>
                  <button className="button compact ghost" disabled={!resource.isActive || archivingId === resource.id} onClick={() => archiveResource(resource.id)} type="button">
                    <Archive aria-hidden="true" size={15} />
                    {archivingId === resource.id ? "Archiving" : "Archive"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="leader-review-empty">
              <strong>No student resources yet.</strong>
              <p>Create the first guide, practice, prayer, or reading tool.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MatchingPreviewPanel({
  matches,
  onQuestionChange,
  onReferenceChange,
  question,
  reference
}: {
  matches: StudentCuratedResource[];
  onQuestionChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  question: string;
  reference: string;
}) {
  return (
    <section className="student-curated-resource-preview" aria-label="Student resource matching preview">
      <div className="student-curated-resource-preview-head">
        <div>
          <p className="eyebrow">Match Preview</p>
          <h2>Test the student journey menu</h2>
        </div>
        <Search aria-hidden="true" size={22} />
      </div>

      <div className="student-curated-resource-preview-grid">
        <label className="leader-review-field">
          <span>Student question</span>
          <input
            className="input"
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="Why did God put the tree in the garden?"
            value={question}
          />
        </label>

        <label className="leader-review-field">
          <span>Passage</span>
          <input className="input" onChange={(event) => onReferenceChange(event.target.value)} placeholder="Genesis 3" value={reference} />
        </label>
      </div>

      <div className="student-curated-resource-preview-results" aria-label="Matched student resources">
        {matches.length ? (
          matches.map((resource) => (
            <article key={resource.id}>
              <span>{stageDescriptions[resource.journeyStage]}</span>
              <h3>{resource.title}</h3>
              <p>{resource.summary}</p>
            </article>
          ))
        ) : (
          <p>Type a sample question to preview which student-facing helps will appear.</p>
        )}
      </div>
    </section>
  );
}

function ResourceForm({
  canManageVideoEmbeds,
  onSubmit,
  resource,
  saving
}: {
  canManageVideoEmbeds: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resource?: StudentCuratedResource;
  saving: boolean;
}) {
  const initialKind = resource?.kind === "video" && !canManageVideoEmbeds ? "guide" : resource?.kind ?? "guide";
  const [kind, setKind] = useState<StudentCuratedResourceKind>(initialKind);
  const isVideo = kind === "video";
  const availableKindEntries = Object.entries(kindLabels).filter(([resourceKind]) => canManageVideoEmbeds || resourceKind !== "video");

  return (
    <form className="student-curated-resource-form" onSubmit={onSubmit}>
      <input name="id" type="hidden" value={resource?.id ?? ""} />
      <div className="student-curated-resource-form-head">
        <div>
          <p className="eyebrow">{resource ? "Edit resource" : "Create resource"}</p>
          <h2>{resource ? resource.title : "A student-facing help"}</h2>
        </div>
        <Library aria-hidden="true" size={22} />
      </div>

      <div className="knowledge-source-field-grid">
        <label className="leader-review-field">
          <span>Type</span>
          <select className="input" name="kind" onChange={(event) => setKind(event.target.value as StudentCuratedResourceKind)} value={kind}>
            {availableKindEntries.map(([resourceKind, label]) => (
              <option key={resourceKind} value={resourceKind}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="leader-review-field">
          <span>Journey phase</span>
          <select className="input" defaultValue={resource?.journeyStage ?? "read"} name="journeyStage">
            {Object.entries(studentCuratedResourceStageLabels).map(([stage, label]) => (
              <option key={stage} value={stage}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="knowledge-source-field-grid">
        <label className="leader-review-field">
          <span>Sort order</span>
          <input className="input" defaultValue={resource?.sortOrder ?? 20} min="0" name="sortOrder" type="number" />
        </label>
      </div>

      <label className="leader-review-field">
        <span>Title</span>
        <input className="input" defaultValue={resource?.title ?? ""} name="title" placeholder="Walk the garden slowly" required />
      </label>

      <label className="leader-review-field">
        <span>Short summary</span>
        <textarea defaultValue={resource?.summary ?? ""} name="summary" placeholder="A one or two sentence student-facing summary." required />
      </label>

      <label className="leader-review-field">
        <span>Full details</span>
        <textarea defaultValue={resource?.body ?? ""} name="body" placeholder="What opens in the related-resources menu." required />
      </label>

      <label className="leader-review-field">
        <span>Practice prompt</span>
        <textarea defaultValue={resource?.practicePrompt ?? ""} name="practicePrompt" placeholder="Name three gifts in creation before asking your question." />
      </label>

      <div className="knowledge-source-field-grid">
        <label className="leader-review-field">
          <span>Scripture</span>
          <input className="input" defaultValue={resource?.scriptureReferences.join(", ") ?? ""} name="scriptureReferences" placeholder="Genesis 2, Psalm 13" />
        </label>

        <label className="leader-review-field">
          <span>Themes</span>
          <input className="input" defaultValue={resource?.themes.join(", ") ?? ""} name="themes" placeholder="trust, lament, context" />
        </label>
      </div>

      <label className="leader-review-field">
        <span>Question match words</span>
        <input className="input" defaultValue={resource?.questionPatterns.join(", ") ?? ""} name="questionPatterns" placeholder="tree, suffering, anxiety, what does" />
      </label>

      <div className="knowledge-source-field-grid">
        <label className="leader-review-field">
          <span>{isVideo ? "Embed URL or iframe code" : "Open link"}</span>
          <input
            className="input"
            defaultValue={resource?.href ?? ""}
            name="href"
            placeholder={isVideo ? "Paste a YouTube/Vimeo URL or iframe embed code" : "/student/scripture/resources"}
          />
        </label>

        <label className="student-curated-resource-toggle">
          <input defaultChecked={resource?.isActive ?? true} name="isActive" type="checkbox" value="true" />
          <span>Active for students</span>
        </label>
      </div>

      <button className="button primary" disabled={saving} type="submit">
        <Save aria-hidden="true" size={15} />
        {saving ? "Saving..." : resource ? "Save Resource" : "Create Resource"}
      </button>
    </form>
  );
}

function ResourceStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formPayload(data: FormData) {
  const kind = String(data.get("kind") || "guide");
  const href = String(data.get("href") || "");

  return {
    kind,
    journeyStage: String(data.get("journeyStage") || "read"),
    title: String(data.get("title") || ""),
    summary: String(data.get("summary") || ""),
    body: String(data.get("body") || ""),
    scriptureReferences: String(data.get("scriptureReferences") || ""),
    themes: String(data.get("themes") || ""),
    questionPatterns: String(data.get("questionPatterns") || ""),
    practicePrompt: String(data.get("practicePrompt") || ""),
    href: kind === "video" ? getEmbeddableVideoUrl(href) || href : href,
    sortOrder: String(data.get("sortOrder") || "0"),
    isActive: data.get("isActive") === "true"
  };
}
