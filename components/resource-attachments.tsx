"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Music,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Video,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  parentResourceTitle,
  resourceNotificationLabels,
  resourceVisibilityLabels
} from "@/lib/resources/registry";
import {
  resourceNotificationIntents,
  resourceVisibilities,
  type ResourceAttachment,
  type ResourceAttachmentListPayload,
  type ResourceNotificationIntent,
  type ResourceParentType,
  type ResourceVisibility
} from "@/lib/resources/types";

type ResourceAttachmentsProps = {
  compact?: boolean;
  inlineMedia?: boolean;
  parentId: string;
  parentType: ResourceParentType;
  title?: string;
};

type AddMode = "file" | "youtube" | "link";
type SaveStatus = "idle" | "loading" | "saving" | "success" | "error";

type EditState = {
  description: string;
  isDownloadable: boolean;
  isFeatured: boolean;
  opensInNewTab: boolean;
  title: string;
  visibility: ResourceVisibility;
};

type PreparedResourceUpload = {
  attachmentId: string;
  maxFileSizeBytes: number;
  path: string;
  signedUrl: string;
  storageBucket: string;
};

const directUploadThresholdBytes = 4 * 1024 * 1024;

export function ResourceAttachments({ compact = false, inlineMedia = false, parentId, parentType, title }: ResourceAttachmentsProps) {
  const [resources, setResources] = useState<ResourceAttachment[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("Loading resources...");
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [externalUrl, setExternalUrl] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("inherit_parent");
  const [notificationIntent, setNotificationIntent] = useState<ResourceNotificationIntent>("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [busyResourceId, setBusyResourceId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionTitle = title ?? parentResourceTitle(parentType);

  const loadResources = useCallback(async () => {
    setStatus((current) => (current === "idle" || current === "success" ? "loading" : current));
    setMessage("Loading resources...");
    try {
      const response = await fetch(`/api/resource-attachments/parents/${parentType}/${encodeURIComponent(parentId)}?includeArchived=true`, {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ResourceAttachmentListPayload> & { error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Resources could not be loaded.");
        return;
      }
      setResources(payload.resources ?? []);
      setCanManage(Boolean(payload.canManage));
      setStorageReady(Boolean(payload.storageReady));
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Resources could not be loaded.");
    }
  }, [parentId, parentType]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const activeResources = useMemo(() => resources.filter((resource) => !resource.archivedAt), [resources]);
  const archivedResources = useMemo(() => resources.filter((resource) => resource.archivedAt), [resources]);

  function resetForm() {
    setFiles([]);
    setExternalUrl("");
    setTitleInput("");
    setDescription("");
    setVisibility("inherit_parent");
    setNotificationIntent("none");
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!canManage) return;
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length) setFiles((current) => mergeFiles(current, dropped));
  }

  function onFileSelect(nextFiles: FileList | null) {
    const selected = Array.from(nextFiles ?? []);
    if (selected.length) setFiles((current) => mergeFiles(current, selected));
  }

  async function submitResource() {
    if (!canManage || status === "saving") return;
    setStatus("saving");
    setMessage(mode === "file" ? "Uploading resource..." : mode === "youtube" ? "Embedding YouTube video..." : "Adding link...");

    try {
      if (mode === "file") {
        if (!files.length) {
          setStatus("error");
          setMessage("Choose at least one file.");
          return;
        }
        for (const file of files) {
          await createFileResource(file);
        }
      } else {
        if (mode === "youtube" && !youtubeEmbedUrl(externalUrl)) {
          setStatus("error");
          setMessage("Add a valid YouTube watch, short, or embed URL.");
          return;
        }
        await createResourceRequest({
          description,
          externalUrl,
          notificationIntent,
          resourceType: mode === "youtube" ? "youtube" : undefined,
          title: titleInput,
          visibility
        });
      }

      resetForm();
      setFormOpen(false);
      setStatus("success");
      setMessage("Resource saved.");
      await loadResources();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource could not be saved.");
    }
  }

  async function createResourceRequest(body: FormData | Record<string, unknown>) {
    const response = await fetch(`/api/resource-attachments/parents/${parentType}/${encodeURIComponent(parentId)}`, {
      method: "POST",
      ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    });
    if (!response.ok) throw new Error(await readErrorMessage(response, "Resource could not be saved."));
  }

  async function createFileResource(file: File) {
    if (storageReady && file.size > directUploadThresholdBytes) {
      setMessage(`Uploading ${file.name} directly to storage...`);
      await createDirectUploadResource(file);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", titleInput);
    formData.set("description", description);
    formData.set("visibility", visibility);
    formData.set("notificationIntent", notificationIntent);
    await createResourceRequest(formData);
  }

  async function createDirectUploadResource(file: File) {
    const prepare = await fetch(`/api/resource-attachments/parents/${parentType}/${encodeURIComponent(parentId)}/uploads/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileSizeBytes: file.size,
        filename: file.name
      })
    });
    const preparePayload = (await prepare.json().catch(() => ({}))) as { upload?: PreparedResourceUpload; error?: string };
    if (!prepare.ok || !preparePayload.upload) {
      throw new Error(preparePayload.error ?? "Upload could not be prepared.");
    }

    if (file.size > preparePayload.upload.maxFileSizeBytes) {
      throw new Error(`Files must be ${Math.round(preparePayload.upload.maxFileSizeBytes / 1024 / 1024)} MB or smaller.`);
    }

    const uploadBody = new FormData();
    uploadBody.set("cacheControl", "3600");
    uploadBody.set("", file);
    const upload = await fetch(preparePayload.upload.signedUrl, {
      method: "PUT",
      body: uploadBody
    });
    if (!upload.ok) {
      throw new Error(await readUploadErrorMessage(upload));
    }

    const complete = await fetch(`/api/resource-attachments/parents/${parentType}/${encodeURIComponent(parentId)}/uploads/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachmentId: preparePayload.upload.attachmentId,
        description,
        filename: file.name,
        notificationIntent,
        title: titleInput,
        visibility
      })
    });
    if (!complete.ok) throw new Error(await readErrorMessage(complete, "Resource could not be saved."));
  }

  function startEditing(resource: ResourceAttachment) {
    setEditingId(resource.id);
    setEditState({
      description: resource.description,
      isDownloadable: resource.isDownloadable,
      isFeatured: resource.isFeatured,
      opensInNewTab: resource.opensInNewTab,
      title: resource.title,
      visibility: resource.visibility
    });
  }

  async function saveEdit(resource: ResourceAttachment) {
    if (!editState) return;
    setBusyResourceId(resource.id);
    try {
      const updated = await patchResource(resource.id, editState);
      setResources((current) => current.map((item) => (item.id === resource.id ? updated : item)));
      setEditingId(null);
      setEditState(null);
      setMessage("Resource details saved.");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource could not be saved.");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function archiveOrRestore(resource: ResourceAttachment, action: "archive" | "restore") {
    setBusyResourceId(resource.id);
    try {
      const updated = await patchResource(resource.id, { action });
      setResources((current) => current.map((item) => (item.id === resource.id ? updated : item)));
      setMessage(action === "archive" ? "Resource archived." : "Resource restored.");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource could not be updated.");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function deleteResource(resource: ResourceAttachment) {
    if (!window.confirm(`Permanently delete "${resource.title}"? This also removes the stored file.`)) return;
    setBusyResourceId(resource.id);
    try {
      const response = await fetch(`/api/resource-attachments/items/${resource.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Resource could not be deleted."));
      setResources((current) => current.filter((item) => item.id !== resource.id));
      setMessage("Resource permanently deleted.");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource could not be deleted.");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function moveResource(index: number, direction: -1 | 1) {
    const target = activeResources[index];
    const neighbor = activeResources[index + direction];
    if (!target || !neighbor) return;
    setBusyResourceId(target.id);
    try {
      const [updatedTarget, updatedNeighbor] = await Promise.all([
        patchResource(target.id, { displayOrder: neighbor.displayOrder }),
        patchResource(neighbor.id, { displayOrder: target.displayOrder })
      ]);
      setResources((current) =>
        current
          .map((item) => (item.id === target.id ? updatedTarget : item.id === neighbor.id ? updatedNeighbor : item))
          .sort((first, second) => first.displayOrder - second.displayOrder || first.createdAt.localeCompare(second.createdAt))
      );
      setMessage("Resource order saved.");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource order could not be saved.");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function replaceFile(resource: ResourceAttachment, file: File | null) {
    if (!file) return;
    setBusyResourceId(resource.id);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/resource-attachments/items/${resource.id}/replace`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as { resource?: ResourceAttachment; error?: string };
      if (!response.ok || !payload.resource) throw new Error(payload.error ?? "Replacement file could not be saved.");
      setResources((current) => current.map((item) => (item.id === resource.id ? payload.resource! : item)));
      setMessage("File replaced.");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "File could not be replaced.");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function openResource(resource: ResourceAttachment, download = false) {
    setBusyResourceId(resource.id);
    try {
      const response = await fetch(`/api/resource-attachments/items/${resource.id}/open${download ? "?download=true" : ""}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Resource could not be opened.");
      window.open(payload.url, resource.opensInNewTab ? "_blank" : "_self", "noopener,noreferrer");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Resource could not be opened.");
    } finally {
      setBusyResourceId(null);
    }
  }

  return (
    <section className={compact ? "resource-attachments compact" : "resource-attachments"} aria-label={sectionTitle}>
      <div className="resource-attachments-header">
        <div>
          <p className="eyebrow">Resources</p>
          <h3 className="section-title flush">{sectionTitle}</h3>
        </div>
        <div className="resource-attachments-actions">
          <span className="pill">{activeResources.length} active</span>
          {canManage ? (
            <button className="button compact-button" type="button" onClick={() => setFormOpen((current) => !current)}>
              {formOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {formOpen ? "Close" : "Add Resource"}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p
          className={status === "error" ? "resource-attachments-message error" : "resource-attachments-message"}
          role={status === "error" ? "alert" : undefined}
          aria-live={status === "error" ? undefined : "polite"}
        >
          {message}
        </p>
      ) : null}

      {canManage && !storageReady ? (
        <p className="resource-attachments-message" aria-live="polite">
          Storage is in local preview mode for this session.
        </p>
      ) : null}

      {canManage && formOpen ? (
        <div className="resource-attachment-form">
          <div className="segmented-control" role="group" aria-label="Resource source">
            <button className={mode === "file" ? "button compact-button active" : "button compact-button"} type="button" onClick={() => setMode("file")}>
              <Upload aria-hidden="true" />
              Upload
            </button>
            <button className={mode === "link" ? "button compact-button active" : "button compact-button"} type="button" onClick={() => setMode("link")}>
              <LinkIcon aria-hidden="true" />
              Link
            </button>
            <button className={mode === "youtube" ? "button compact-button active" : "button compact-button"} type="button" onClick={() => setMode("youtube")}>
              <Video aria-hidden="true" />
              YouTube Video
            </button>
          </div>

          {mode === "file" ? (
            <div
              className="resource-drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
            >
              <Upload aria-hidden="true" />
              <strong>Drop files here or choose files</strong>
              <span>{files.length ? `${files.length} selected` : "PDF, image, audio, video, Office, text, or CSV"}</span>
              <input ref={inputRef} className="sr-only" type="file" multiple onChange={(event) => onFileSelect(event.target.files)} />
            </div>
          ) : mode === "youtube" ? (
            <label className="field">
              <span>YouTube video URL</span>
              <input className="input" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            </label>
          ) : (
            <label className="field">
              <span>External URL</span>
              <input className="input" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://..." />
            </label>
          )}

          {files.length ? (
            <div className="resource-selected-files" aria-label="Selected files">
              {files.map((file) => (
                <span key={`${file.name}-${file.size}`}>
                  {file.name}
                  <button className="button icon" type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
                    <X aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="resource-form-grid">
            <label className="field">
              <span>Title</span>
              <input className="input" value={titleInput} onChange={(event) => setTitleInput(event.target.value)} placeholder="Optional title" />
            </label>
            <label className="field">
              <span>Visibility</span>
              <select className="input" value={visibility} onChange={(event) => setVisibility(event.target.value as ResourceVisibility)}>
                {resourceVisibilities.map((option) => (
                  <option key={option} value={option}>
                    {resourceVisibilityLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Notification</span>
              <select className="input" value={notificationIntent} onChange={(event) => setNotificationIntent(event.target.value as ResourceNotificationIntent)}>
                {resourceNotificationIntents.map((option) => (
                  <option key={option} value={option}>
                    {resourceNotificationLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea className="input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <div className="toolbar split">
            <button className="button primary" type="button" disabled={status === "saving"} onClick={() => void submitResource()}>
              <Save aria-hidden="true" />
              {status === "saving" ? "Saving..." : "Save Resource"}
            </button>
            <button className="button compact-button" type="button" disabled={status === "saving"} onClick={resetForm}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="resource-list">
        {activeResources.length ? (
          activeResources.map((resource, index) => (
            <ResourceCard
              busy={busyResourceId === resource.id}
              canManage={canManage}
              editing={editingId === resource.id}
              editState={editingId === resource.id ? editState : null}
              index={index}
              inlineMedia={inlineMedia}
              key={resource.id}
              resource={resource}
              total={activeResources.length}
              onArchive={() => void archiveOrRestore(resource, "archive")}
              onDelete={() => void deleteResource(resource)}
              onEdit={() => startEditing(resource)}
              onEditStateChange={setEditState}
              onMove={moveResource}
              onOpen={openResource}
              onReplace={replaceFile}
              onSaveEdit={saveEdit}
              onStopEditing={() => {
                setEditingId(null);
                setEditState(null);
              }}
            />
          ))
        ) : (
          <p className="resource-empty-state">No resources attached yet.</p>
        )}
      </div>

      {canManage && archivedResources.length ? (
        <details className="resource-archive-list">
          <summary>{archivedResources.length} archived</summary>
          <div className="resource-list">
            {archivedResources.map((resource) => (
              <ResourceCard
                busy={busyResourceId === resource.id}
                canManage={canManage}
                editing={false}
                editState={null}
                index={0}
                inlineMedia={false}
                key={resource.id}
                resource={resource}
                total={archivedResources.length}
                onArchive={() => void archiveOrRestore(resource, "restore")}
                onDelete={() => void deleteResource(resource)}
                onEdit={() => startEditing(resource)}
                onEditStateChange={setEditState}
                onMove={moveResource}
                onOpen={openResource}
                onReplace={replaceFile}
                onSaveEdit={saveEdit}
                onStopEditing={() => {
                  setEditingId(null);
                  setEditState(null);
                }}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function ResourceCard({
  busy,
  canManage,
  editing,
  editState,
  index,
  inlineMedia,
  resource,
  total,
  onArchive,
  onDelete,
  onEdit,
  onEditStateChange,
  onMove,
  onOpen,
  onReplace,
  onSaveEdit,
  onStopEditing
}: {
  busy: boolean;
  canManage: boolean;
  editing: boolean;
  editState: EditState | null;
  index: number;
  inlineMedia: boolean;
  resource: ResourceAttachment;
  total: number;
  onArchive: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditStateChange: (state: EditState | null) => void;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onOpen: (resource: ResourceAttachment, download?: boolean) => Promise<void>;
  onReplace: (resource: ResourceAttachment, file: File | null) => Promise<void>;
  onSaveEdit: (resource: ResourceAttachment) => Promise<void>;
  onStopEditing: () => void;
}) {
  const Icon = iconForResource(resource);
  const archived = Boolean(resource.archivedAt);

  return (
    <article className={archived ? "resource-card archived" : "resource-card"}>
      <div className="resource-card-icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="resource-card-main">
        {editing && editState ? (
          <div className="resource-edit-panel">
            <label className="field">
              <span>Title</span>
              <input className="input" value={editState.title} onChange={(event) => onEditStateChange({ ...editState, title: event.target.value })} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea className="input" rows={2} value={editState.description} onChange={(event) => onEditStateChange({ ...editState, description: event.target.value })} />
            </label>
            <div className="resource-form-grid">
              <label className="field">
                <span>Visibility</span>
                <select className="input" value={editState.visibility} onChange={(event) => onEditStateChange({ ...editState, visibility: event.target.value as ResourceVisibility })}>
                  {resourceVisibilities.map((option) => (
                    <option key={option} value={option}>
                      {resourceVisibilityLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="resource-checkbox">
                <input type="checkbox" checked={editState.isFeatured} onChange={(event) => onEditStateChange({ ...editState, isFeatured: event.target.checked })} />
                Featured
              </label>
              <label className="resource-checkbox">
                <input type="checkbox" checked={editState.isDownloadable} onChange={(event) => onEditStateChange({ ...editState, isDownloadable: event.target.checked })} />
                Downloadable
              </label>
            </div>
            <div className="toolbar">
              <button className="button compact-button primary" type="button" disabled={busy} onClick={() => void onSaveEdit(resource)}>
                <Save aria-hidden="true" />
                Save
              </button>
              <button className="button compact-button" type="button" disabled={busy} onClick={onStopEditing}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="resource-card-title-row">
              <span className="resource-type-badge">{resource.resourceType === "youtube" ? "YouTube" : resource.resourceType.replace(/_/g, " ")}</span>
              <strong>{resource.title}</strong>
              {resource.isFeatured ? <span className="pill amber">Featured</span> : null}
              {archived ? <span className="pill">Archived</span> : null}
            </div>
            {resource.description ? <p>{resource.description}</p> : null}
            <div className="resource-card-meta">
              {resource.fileSizeBytes ? <span>{formatBytes(resource.fileSizeBytes)}</span> : null}
              <span>{resourceVisibilityLabels[resource.visibility]}</span>
              {resource.originalFilename ? <span>{resource.originalFilename}</span> : null}
            </div>
            {resource.resourceType === "youtube" && resource.externalUrl ? <YouTubeResourceEmbed resource={resource} /> : null}
            {inlineMedia && resource.resourceType === "video" && !archived ? <VideoResourceEmbed resource={resource} /> : null}
          </>
        )}
      </div>

      <div className="resource-card-actions">
        {!archived ? (
          <>
            <button className="button compact-button" type="button" disabled={busy} onClick={() => void onOpen(resource, false)}>
              {resource.externalUrl ? <ExternalLink aria-hidden="true" /> : <FileText aria-hidden="true" />}
              {previewLabel(resource)}
            </button>
            {!resource.externalUrl && resource.isDownloadable ? (
              <button className="button compact-button" type="button" disabled={busy} onClick={() => void onOpen(resource, true)}>
                <Download aria-hidden="true" />
                Download
              </button>
            ) : null}
          </>
        ) : null}

        {canManage ? (
          <>
            {!archived ? (
              <>
                <button className="button icon" type="button" aria-label={`Move ${resource.title} up`} disabled={busy || index === 0} onClick={() => void onMove(index, -1)}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button className="button icon" type="button" aria-label={`Move ${resource.title} down`} disabled={busy || index >= total - 1} onClick={() => void onMove(index, 1)}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button className="button icon" type="button" aria-label={`Edit ${resource.title}`} disabled={busy} onClick={onEdit}>
                  <Pencil aria-hidden="true" />
                </button>
                <label className="button icon" aria-label={`Replace file for ${resource.title}`}>
                  <Upload aria-hidden="true" />
                  <input className="sr-only" type="file" disabled={busy} onChange={(event) => void onReplace(resource, event.target.files?.[0] ?? null)} />
                </label>
              </>
            ) : null}
            <button className="button icon" type="button" aria-label={archived ? `Restore ${resource.title}` : `Archive ${resource.title}`} disabled={busy} onClick={onArchive}>
              {archived ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
            </button>
            {archived ? (
              <button className="button icon danger" type="button" aria-label={`Permanently delete ${resource.title}`} disabled={busy} onClick={onDelete}>
                <Trash2 aria-hidden="true" />
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function VideoResourceEmbed({ resource }: { resource: ResourceAttachment }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadVideo() {
      try {
        const response = await fetch(`/api/resource-attachments/items/${resource.id}/open`, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!response.ok || !payload.url) throw new Error(payload.error ?? "Video preview could not be loaded.");
        if (active) setUrl(payload.url);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Video preview could not be loaded.");
      }
    }
    void loadVideo();
    return () => { active = false; };
  }, [resource.id]);

  if (error) return <p className="resource-inline-video-message">{error}</p>;
  if (!url) return <p className="resource-inline-video-message">Loading video preview...</p>;
  return (
    <div className="resource-inline-video">
      <video controls playsInline preload="metadata" src={url}>
        Your browser does not support this video preview.
      </video>
    </div>
  );
}

function YouTubeResourceEmbed({ resource }: { resource: ResourceAttachment }) {
  const videoId = youtubeVideoId(resource.externalUrl);
  if (!videoId) return null;
  const embedUrl = youtubeEmbedUrlFromId(videoId);
  return (
    <div className="resource-youtube-embed">
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={embedUrl}
        srcDoc={youtubeEmbedSrcDoc(resource.title, videoId, embedUrl)}
        title={`${resource.title} video`}
      />
    </div>
  );
}

function youtubeEmbedUrl(rawUrl?: string) {
  const videoId = youtubeVideoId(rawUrl);
  return videoId ? youtubeEmbedUrlFromId(videoId) : "";
}

function youtubeVideoId(rawUrl?: string) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (hostname.endsWith("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      else if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      else videoId = url.searchParams.get("v") ?? "";
    }
    if (!/^[\w-]{6,}$/.test(videoId)) return "";
    return videoId;
  } catch {
    return "";
  }
}

function youtubeEmbedUrlFromId(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}`;
}

function youtubeEmbedSrcDoc(title: string, videoId: string, embedUrl: string) {
  const escapedTitle = escapeHtml(title);
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:#030914;color:#f8fafc;font-family:Arial,sans-serif}a{position:absolute;inset:0;display:grid;place-items:center;gap:10px;text-decoration:none;color:#f8fafc;background:linear-gradient(180deg,rgba(3,9,20,.35),rgba(3,9,20,.82)),url('${thumbnailUrl}') center/cover no-repeat}.play{display:grid;place-items:center;width:76px;height:54px;border-radius:16px;background:rgba(2,132,199,.9);box-shadow:0 18px 40px rgba(0,0,0,.35)}.play:before{content:"";border-style:solid;border-width:12px 0 12px 20px;border-color:transparent transparent transparent #fff;margin-left:4px}.title{max-width:80%;padding:8px 10px;border-radius:999px;background:rgba(3,9,20,.72);font-size:13px;font-weight:800;text-align:center}</style></head><body><a href="${embedUrl}?autoplay=1" aria-label="Play ${escapedTitle}"><span class="play"></span><span class="title">${escapedTitle}</span></a></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function patchResource(attachmentId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/resource-attachments/items/${attachmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { resource?: ResourceAttachment; error?: string };
  if (!response.ok || !payload.resource) throw new Error(payload.error ?? "Resource could not be updated.");
  return payload.resource;
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
}

async function readUploadErrorMessage(response: Response) {
  const fallback = response.clone();
  const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;
  const text = await fallback.text().catch(() => "");
  return text || "File could not be uploaded.";
}

function mergeFiles(current: File[], next: File[]) {
  const keyed = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
  next.forEach((file) => keyed.set(`${file.name}:${file.size}:${file.lastModified}`, file));
  return Array.from(keyed.values());
}

function iconForResource(resource: ResourceAttachment) {
  if (resource.resourceType === "image") return ImageIcon;
  if (resource.resourceType === "audio") return Music;
  if (resource.resourceType === "video" || resource.resourceType === "youtube") return Video;
  if (resource.externalUrl) return LinkIcon;
  if (resource.resourceType === "pdf" || resource.resourceType === "document") return FileText;
  return File;
}

function previewLabel(resource: ResourceAttachment) {
  if (resource.resourceType === "youtube") return "Open on YouTube";
  if (resource.externalUrl) return "Open";
  if (resource.resourceType === "image" || resource.resourceType === "pdf" || resource.resourceType === "video" || resource.resourceType === "audio") return "Preview";
  return "Open";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
