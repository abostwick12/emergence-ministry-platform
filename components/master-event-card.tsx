"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmmaEventIntelligencePanel } from "@/components/emma-event-intelligence-panel";
import { useEventCard } from "@/components/event-card-context";
import { PlanningCenterIntegrationControl } from "@/components/planning-center-integration-control";
import { useRole } from "@/components/role-context";
import { eventTypeLabels, defaultTemplateTasks } from "@/lib/templates";
import { eventTypes } from "@/lib/event-categories";
import {
  loadCustomVolunteerLeaders,
  loadDeletedVolunteerLeaderIds,
  loadEventLeaderAssignments,
  mergeVolunteerLeaders,
  saveEventLeaderAssignments,
  type EventLeaderAssignments,
  type VolunteerLeader
} from "@/lib/volunteer-leaders";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  ActiveTask,
  EventType,
  EventWorkspace,
  MinistryEvent,
  TaskStatus,
  TemplateTask,
  User
} from "@/lib/types";

const taskStatuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Stuck",
  done: "Done"
};

const eventStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "planning", label: "In Progress" },
  { value: "working_on_it", label: "Working on It" },
  { value: "stuck", label: "Stuck" },
  { value: "ready", label: "Completed" }
] as const;

const priorityOptions = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

function usersToVolunteerLeaders(users: User[]): VolunteerLeader[] {
  return users.map((user) => ({
    id: `user-${user.id}`,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    role: user.role === "admin" ? "Admin" : "Leader",
    email: user.email
  }));
}

function toDateInputValue(value: string) {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toDateTimeLocalValue(value: string) {
  try {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function toTimeValue(value: string) {
  return toDateTimeLocalValue(value).slice(11, 16);
}

function alignEndToStartDate(startValue: string, currentEndValue: string) {
  if (!startValue) return currentEndValue;
  if (!currentEndValue) return startValue;
  const startDate = startValue.slice(0, 10);
  const endTime = currentEndValue.slice(11, 16) || startValue.slice(11, 16);
  return `${startDate}T${endTime}`;
}

interface Step1State {
  title: string;
  type: EventType;
  targetGroup: string;
  description: string;
  startTime: string;
  endTime: string;
  endTouched: boolean;
  location: string;
  contactOwnerId: string;
  status: string;
  priority: string;
  budgetTarget: string;
  budgetActual: string;
  volunteersNeeded: string;
  notes: string;
  generateTasks: boolean;
  generateComms: boolean;
  createDrive: boolean;
  createProPresenter: boolean;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

function buildInitialStep1(event?: MinistryEvent, firstUserId?: string): Step1State {
  if (event) {
    return {
      title: event.title,
      type: event.type,
      targetGroup: event.targetGroup ?? "",
      description: event.description,
      startTime: toDateTimeLocalValue(event.startTime),
      endTime: toDateTimeLocalValue(event.endTime),
      endTouched: true,
      location: event.location ?? "",
      contactOwnerId: event.contactOwnerId ?? firstUserId ?? "",
      status: event.status ?? "planning",
      priority: event.priority ?? "normal",
      budgetTarget: event.budgetTarget?.toString() ?? "",
      budgetActual: event.budgetActual?.toString() ?? "",
      volunteersNeeded: event.volunteersNeeded?.toString() ?? "",
      notes: event.notes ?? "",
      generateTasks: false,
      generateComms: false,
      createDrive: false,
      createProPresenter: false
    };
  }
  return {
    title: "",
    type: "small_group_gathering",
    targetGroup: "",
    description: "",
    startTime: "",
    endTime: "",
    endTouched: false,
    location: "",
    contactOwnerId: firstUserId ?? "",
    status: "planning",
    priority: "normal",
    budgetTarget: "",
    budgetActual: "",
    volunteersNeeded: "",
    notes: "",
    generateTasks: true,
    generateComms: false,
    createDrive: false,
    createProPresenter: false
  };
}

interface MasterEventCardProps {
  onRefresh?: () => void;
}

export function MasterEventCard({ onRefresh }: MasterEventCardProps) {
  const { state, canSaveChanges, close, notifySaved } = useEventCard();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = useCallback(() => {
    notifySaved();
    onRefresh?.();
  }, [notifySaved, onRefresh]);

  if (!mounted || !state.isOpen) return null;

  const portal = createPortal(
    <MasterEventCardInner mode={state.mode} eventId={state.eventId} canSaveChanges={canSaveChanges} onClose={close} onRefresh={handleRefresh} />,
    document.body
  );
  return portal;
}

function MasterEventCardInner({
  mode,
  eventId,
  canSaveChanges,
  onClose,
  onRefresh
}: {
  mode: "create" | "edit";
  eventId?: string;
  canSaveChanges: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [workspace, setWorkspace] = useState<EventWorkspace | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [volunteerLeaders, setVolunteerLeaders] = useState<VolunteerLeader[]>([]);
  const [eventLeaderAssignments, setEventLeaderAssignments] = useState<EventLeaderAssignments>({});
  const [step1, setStep1] = useState<Step1State | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const { activeRole } = useRole();
  const [stubStatus, setStubStatus] = useState<Record<string, "idle" | "running" | "done">>({
    drive: "idle",
    calendar: "idle",
    propresenter: "idle",
    comms: "idle"
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<Step1State | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSaveError("");

    const overviewRes = await fetch("/api/events", { cache: "no-store" });
    if (!overviewRes.ok) { setIsLoading(false); return; }
    const overview = (await overviewRes.json()) as { users: User[] };
    const staffUsers = overview.users.filter((u) => u.role === "admin" || u.role === "leader");
    setUsers(staffUsers);
    setVolunteerLeaders(mergeVolunteerLeaders(usersToVolunteerLeaders(staffUsers), loadCustomVolunteerLeaders(), loadDeletedVolunteerLeaderIds()));
    setEventLeaderAssignments(loadEventLeaderAssignments());

    if (mode === "edit" && eventId) {
      const wsRes = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
      if (wsRes.ok) {
        const ws = (await wsRes.json()) as EventWorkspace;
        const nextStep1 = buildInitialStep1(ws.event, overview.users[0]?.id);
        setWorkspace(ws);
        step1Ref.current = nextStep1;
        setStep1(nextStep1);
      }
    } else {
      const nextStep1 = buildInitialStep1(undefined, overview.users[0]?.id);
      step1Ref.current = nextStep1;
      setStep1(nextStep1);
    }
    setIsLoading(false);
  }, [mode, eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Focus trap
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { prev?.focus(); };
  }, []);

  // Escape key
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isDirty) {
          if (confirm("You have unsaved changes. Close without saving?")) onClose();
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDirty, onClose]);

  function updateStep1<K extends keyof Step1State>(key: K, value: Step1State[K]) {
    if (!canSaveChanges) return;
    setStep1((current) => {
      const next = current ? { ...current, [key]: value } : current;
      step1Ref.current = next;
      return next;
    });
    setIsDirty(true);
    setSaveError("");
    setSaveSuccess("");
  }

  function handleStartChange(value: string) {
    if (!canSaveChanges) return;
    setStep1((current) => {
      if (!current) return current;
      const newEnd = current.endTouched ? current.endTime : alignEndToStartDate(value, current.endTime);
      const next = { ...current, startTime: value, endTime: newEnd };
      step1Ref.current = next;
      return next;
    });
    setIsDirty(true);
  }

  function handleEndChange(value: string) {
    if (!canSaveChanges) return;
    setStep1((current) => {
      const next = current ? { ...current, endTime: value, endTouched: true } : current;
      step1Ref.current = next;
      return next;
    });
    setIsDirty(true);
  }

  function validateStep1(snapshot = step1Ref.current ?? step1): string {
    if (!snapshot?.title.trim()) return "Event name is required.";
    if (!snapshot.startTime) return "Start date and time are required.";
    return "";
  }

  async function handleNext() {
    const err = validateStep1();
    if (err) { setSaveError(err); return; }

    if (mode === "create") {
      setStep(2);
      return;
    }

    // Edit mode: save Step 1 changes then advance
    await saveEventInfo();
    if (!saveError) setStep(2);
  }

  async function saveEventInfo() {
    if (!canSaveChanges) {
      setSaveError("Read-only access is active. Event saves are disabled for this account.");
      return;
    }
    const currentStep1 = step1Ref.current ?? step1;
    if (!currentStep1) return;
    setSaveError("");
    setIsSaving(true);
    try {
      const startIso = new Date(currentStep1.startTime).toISOString();
      const endIso = currentStep1.endTime ? new Date(currentStep1.endTime).toISOString() : startIso;
      const body: Record<string, unknown> = {
        title: currentStep1.title,
        description: currentStep1.description,
        type: currentStep1.type,
        startTime: startIso,
        endTime: endIso,
        location: currentStep1.location || undefined,
        targetGroup: currentStep1.targetGroup || undefined,
        budgetTarget: currentStep1.budgetTarget ? Number(currentStep1.budgetTarget) : undefined,
        budgetActual: currentStep1.budgetActual ? Number(currentStep1.budgetActual) : undefined,
        volunteersNeeded: currentStep1.volunteersNeeded ? Number(currentStep1.volunteersNeeded) : undefined,
        priority: currentStep1.priority,
        contactOwnerId: currentStep1.contactOwnerId || undefined,
        status: currentStep1.status,
        notes: currentStep1.notes || undefined
      };

      const url = mode === "edit" && eventId ? `/api/events/${eventId}` : null;
      if (!url) return;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        setSaveError(await readErrorMessage(res, "Could not save the event. Please try again."));
      } else {
        const ws = (await res.json()) as EventWorkspace;
        setWorkspace(ws);
        persistEventLeaderAssignments(ws.event.id);
        setSaveSuccess("Event information saved.");
        setIsDirty(false);
        onRefresh?.();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate() {
    if (!canSaveChanges) {
      setSaveError("Read-only access is active. Event creation is disabled for this account.");
      return;
    }
    const currentStep1 = step1Ref.current ?? step1;
    if (!currentStep1) return;
    const err = validateStep1(currentStep1);
    if (err) { setSaveError(err); return; }

    setSaveError("");
    setIsSaving(true);
    try {
      const startIso = new Date(currentStep1.startTime).toISOString();
      const endIso = currentStep1.endTime ? new Date(currentStep1.endTime).toISOString() : startIso;
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentStep1.title,
          type: currentStep1.type,
          description: currentStep1.description,
          startTime: startIso,
          endTime: endIso,
          location: currentStep1.location || undefined,
          targetGroup: currentStep1.targetGroup || undefined,
          budgetTarget: currentStep1.budgetTarget ? Number(currentStep1.budgetTarget) : undefined,
          budgetActual: currentStep1.budgetActual ? Number(currentStep1.budgetActual) : undefined,
          volunteersNeeded: currentStep1.volunteersNeeded ? Number(currentStep1.volunteersNeeded) : undefined,
          priority: currentStep1.priority,
          contactOwnerId: currentStep1.contactOwnerId || undefined
        })
      });

      if (!res.ok) {
        setSaveError(await readErrorMessage(res, "Could not create the event. Please review the fields and try again."));
        return;
      }

      const ws = (await res.json()) as EventWorkspace;
      setWorkspace(ws);
      persistEventLeaderAssignments(ws.event.id);
      setSaveSuccess(`Created "${ws.event.title}" and generated baseline tasks.`);
      setIsDirty(false);
      onRefresh?.();

      // Run stub actions for checked toggles
      if (currentStep1.createDrive) {
        await fetch(`/api/events/${ws.event.id}/generate-drive-folder`, { method: "POST" });
      }
      if (currentStep1.createProPresenter) {
        await fetch(`/api/events/${ws.event.id}/generate-propresenter`, { method: "POST" });
      }
      if (currentStep1.generateComms) {
        await fetch(`/api/events/${ws.event.id}/generate-communications`, { method: "POST" });
      }

      // Move to step 2 to show generated tasks
      await loadData();
      setStep(2);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateTask(taskId: string, patch: Partial<ActiveTask>) {
    if (!canSaveChanges) {
      setSaveError("Read-only access is active. Task saves are disabled for this account.");
      return;
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      onRefresh?.();
      if (workspace) {
        const ws = await fetch(`/api/events/${workspace.event.id}`, { cache: "no-store" });
        if (ws.ok) setWorkspace((await ws.json()) as EventWorkspace);
      }
    }
  }

  async function handleAddTask() {
    if (!canSaveChanges) {
      setSaveError("Read-only access is active. Task creation is disabled for this account.");
      return;
    }
    if (!newTaskTitle.trim() || !workspace) return;
    const assignee = users[0]?.id ?? "";
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: workspace.event.id,
        taskTitle: newTaskTitle.trim(),
        dueDate: due.toISOString(),
        assignedUserId: assignee
      })
    });
    if (res.ok) {
      setNewTaskTitle("");
      onRefresh?.();
      const wsRes = await fetch(`/api/events/${workspace.event.id}`, { cache: "no-store" });
      if (wsRes.ok) setWorkspace((await wsRes.json()) as EventWorkspace);
    }
  }

  function toggleEventLeader(leaderId: string) {
    if (!canSaveChanges) return;
    const currentEventId = workspace?.event.id ?? eventId;
    if (!currentEventId) return;
    setEventLeaderAssignments((current) => {
      const existing = current[currentEventId] ?? [];
      const nextIds = existing.includes(leaderId) ? existing.filter((id) => id !== leaderId) : [...existing, leaderId];
      const next = { ...current, [currentEventId]: nextIds };
      saveEventLeaderAssignments(next);
      return next;
    });
    setIsDirty(true);
  }

  function persistEventLeaderAssignments(nextEventId?: string) {
    const currentEventId = nextEventId ?? workspace?.event.id ?? eventId;
    if (!currentEventId) return;
    saveEventLeaderAssignments(eventLeaderAssignments);
  }

  async function runStub(type: "drive" | "calendar" | "propresenter" | "comms") {
    if (!canSaveChanges) {
      setSaveError("Read-only access is active. Integration preview actions are disabled for this account.");
      return;
    }
    if (!workspace) return;
    setStubStatus((current) => ({ ...current, [type]: "running" }));

    const pathMap: Record<string, string> = {
      drive: "generate-drive-folder",
      calendar: "sync-calendar",
      propresenter: "generate-propresenter",
      comms: "generate-communications"
    };

    await fetch(`/api/events/${workspace.event.id}/${pathMap[type]}`, { method: "POST" });

    setStubStatus((current) => ({ ...current, [type]: "done" }));
    onRefresh?.();
    const wsRes = await fetch(`/api/events/${workspace.event.id}`, { cache: "no-store" });
    if (wsRes.ok) setWorkspace((await wsRes.json()) as EventWorkspace);
  }

  function handleBackdropClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) {
      if (isDirty) {
        if (confirm("You have unsaved changes. Close without saving?")) onClose();
      } else {
        onClose();
      }
    }
  }

  const title = mode === "create" ? "Create New Event" : workspace ? `Edit: ${workspace.event.title}` : "Edit Event";

  const previewTasks: TemplateTask[] = step1 ? defaultTemplateTasks[step1.type] : [];

  return (
    <div className="event-card-backdrop" aria-modal="true" role="dialog" aria-label={title} onClick={handleBackdropClick}>
      <div className="event-card-modal" ref={dialogRef} tabIndex={-1}>
        {/* Header */}
        <div className="event-card-header">
          <div>
            <p className="eyebrow">{mode === "create" ? "New Event" : "Edit Event"}</p>
            <h2 className="section-title flush">{title}</h2>
          </div>
          <button className="button event-card-close" type="button" aria-label="Close modal" onClick={onClose}>✕</button>
        </div>

        {/* Step tabs */}
        <div className="event-card-steps" role="tablist" aria-label="Event card steps">
          <button
            className={step === 1 ? "event-card-step active" : "event-card-step"}
            type="button"
            role="tab"
            aria-selected={step === 1}
            onClick={() => { setSaveError(""); setStep(1); }}
          >
            <span className="step-num">1</span> Event Details
          </button>
          <button
            className={step === 2 ? "event-card-step active" : "event-card-step"}
            type="button"
            role="tab"
            aria-selected={step === 2}
            onClick={() => {
              const err = validateStep1();
              if (err) { setSaveError(err); return; }
              setSaveError("");
              setStep(2);
            }}
          >
            <span className="step-num">2</span> Tasks &amp; Integrations
          </button>
        </div>

        {/* Body */}
        <div className="event-card-body">
          {isLoading ? (
            <p className="muted event-card-loading">Loading event data...</p>
          ) : step === 1 && step1 ? (
            <Step1Form
              state={step1}
              users={users}
              volunteerLeaders={volunteerLeaders}
              assignedLeaderIds={eventLeaderAssignments[workspace?.event.id ?? eventId ?? ""] ?? []}
              mode={mode}
              readOnly={!canSaveChanges}
              onChange={updateStep1}
              onStartChange={handleStartChange}
              onEndChange={handleEndChange}
              onToggleLeader={toggleEventLeader}
            />
          ) : step === 2 ? (
            <Step2Panel
              mode={mode}
              workspace={workspace}
              users={users}
              previewTasks={previewTasks}
              step1Type={step1?.type ?? "small_group_gathering"}
              newTaskTitle={newTaskTitle}
              stubStatus={stubStatus}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              onNewTaskTitleChange={setNewTaskTitle}
              onRunStub={runStub}
              readOnly={!canSaveChanges}
              showEmmaEventIntelligence={activeRole === "admin"}
            />
          ) : null}
        </div>

        {/* Status messages */}
        {(saveError || saveSuccess) && (
          <div className={`event-card-status ${saveError ? "error" : "success"}`} role="status">
            {saveError || saveSuccess}
          </div>
        )}

        {/* Footer */}
        <div className="event-card-footer">
          <button className="button" type="button" onClick={onClose} disabled={isSaving}>
            {saveSuccess && mode === "create" ? "Close" : "Cancel"}
          </button>

          {step === 2 && (
            <button className="button" type="button" onClick={() => { setSaveError(""); setStep(1); }} disabled={isSaving}>
              ← Back
            </button>
          )}

          {step === 1 && mode === "edit" && (
            <button className="button" type="button" onClick={() => void saveEventInfo()} disabled={!canSaveChanges || isSaving || !isDirty}>
              {isSaving ? "Saving..." : "Save event info"}
            </button>
          )}

          {step === 1 && (
            <button className="button primary" type="button" onClick={() => void handleNext()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Next: Tasks & Integrations →"}
            </button>
          )}

          {step === 2 && mode === "create" && !saveSuccess && (
            <button className="button primary" type="button" onClick={() => void handleCreate()} disabled={!canSaveChanges || isSaving}>
              {isSaving ? "Creating..." : "Save & Create Event"}
            </button>
          )}

          {step === 2 && mode === "edit" && (
            <button className="button primary" type="button" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1Form({
  state,
  users,
  volunteerLeaders,
  assignedLeaderIds,
  mode,
  readOnly,
  onChange,
  onStartChange,
  onEndChange,
  onToggleLeader
}: {
  state: Step1State;
  users: User[];
  volunteerLeaders: VolunteerLeader[];
  assignedLeaderIds: string[];
  mode: "create" | "edit";
  readOnly: boolean;
  onChange: <K extends keyof Step1State>(key: K, value: Step1State[K]) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onToggleLeader: (leaderId: string) => void;
}) {
  return (
    <div className="event-card-form">
      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="ec-title">Event Name <span aria-hidden="true">*</span></label>
          <input
            className="input"
            id="ec-title"
            placeholder="Fall Kickoff Night"
            required
            value={state.title}
            onChange={(e) => onChange("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ec-type">Ministry Area</label>
          <select
            className="input"
            id="ec-type"
            value={state.type}
            onChange={(e) => onChange("type", e.target.value as EventType)}
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>{eventTypeLabels[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="ec-targetGroup">Target Group</label>
          <input
            className="input"
            id="ec-targetGroup"
            placeholder="High School, All Students, Leaders…"
            value={state.targetGroup}
            onChange={(e) => onChange("targetGroup", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ec-owner">Owner</label>
          <select
            className="input"
            id="ec-owner"
            value={state.contactOwnerId}
            onChange={(e) => onChange("contactOwnerId", e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="event-card-leader-picker">
        <legend>Assigned Leaders</legend>
        {mode === "create" ? (
          <p className="muted">Save the event, then assign leaders from the Volunteer Hub leader pool.</p>
        ) : volunteerLeaders.length ? (
          <div className="event-card-leader-options">
            {volunteerLeaders.map((leader) => (
              <label className="event-card-leader-option" key={leader.id}>
                <input
                  type="checkbox"
                  checked={assignedLeaderIds.includes(leader.id)}
                  disabled={readOnly}
                  onChange={() => onToggleLeader(leader.id)}
                />
                <span>
                  <strong>{leader.name}</strong>
                  <small>{leader.role}{leader.sourceChurch ? ` - ${leader.sourceChurch}` : ""}</small>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Add leaders in Volunteer Hub to make them available here.</p>
        )}
      </fieldset>

      <div className="field">
        <label htmlFor="ec-description">Vision / Description</label>
        <textarea
          className="input"
          id="ec-description"
          rows={3}
          placeholder="What this event is about and what families and leaders need to know."
          value={state.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="ec-startTime">Start Date &amp; Time <span aria-hidden="true">*</span></label>
          <input
            className="input"
            id="ec-startTime"
            type="datetime-local"
            required
            value={state.startTime}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ec-endTime">End Date &amp; Time</label>
          <input
            className="input"
            id="ec-endTime"
            type="datetime-local"
            value={state.endTime}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="ec-location">Location</label>
          <input
            className="input"
            id="ec-location"
            placeholder="Student Center"
            value={state.location}
            onChange={(e) => onChange("location", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ec-status">Status</label>
          <select
            className="input"
            id="ec-status"
            value={state.status}
            onChange={(e) => onChange("status", e.target.value)}
          >
            {eventStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid-3">
        <div className="field">
          <label htmlFor="ec-priority">Priority</label>
          <select
            className="input"
            id="ec-priority"
            value={state.priority}
            onChange={(e) => onChange("priority", e.target.value)}
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ec-budgetTarget">Budget Proposed</label>
          <input
            className="input"
            id="ec-budgetTarget"
            type="number"
            min="0"
            step="50"
            placeholder="2500"
            value={state.budgetTarget}
            onChange={(e) => onChange("budgetTarget", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ec-budgetActual">Budget Actual</label>
          <input
            className="input"
            id="ec-budgetActual"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={state.budgetActual}
            onChange={(e) => onChange("budgetActual", e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="ec-volunteers">Volunteers Needed</label>
          <input
            className="input"
            id="ec-volunteers"
            type="number"
            min="0"
            placeholder="4"
            value={state.volunteersNeeded}
            onChange={(e) => onChange("volunteersNeeded", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ec-notes">Internal Notes</label>
        <textarea
          className="input"
          id="ec-notes"
          rows={3}
          placeholder="Internal notes visible only to admin and leaders."
          value={state.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </div>

      <fieldset className="event-card-toggles">
        <legend>Build Package</legend>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.generateTasks}
            onChange={(e) => onChange("generateTasks", e.target.checked)}
          />
          <span>Auto-generate event checklist / sub-tasks</span>
          {mode === "edit" && <span className="muted"> (already generated — will add to existing tasks on save)</span>}
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.generateComms}
            onChange={(e) => onChange("generateComms", e.target.checked)}
          />
          <span>Auto-generate communication package <span className="pill stub">Stub Mode</span></span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.createDrive}
            onChange={(e) => onChange("createDrive", e.target.checked)}
          />
          <span>Create Drive Folder <span className="pill stub">Stub Mode</span></span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.createProPresenter}
            onChange={(e) => onChange("createProPresenter", e.target.checked)}
          />
          <span>Create ProPresenter Playlist <span className="pill stub">Stub Mode</span></span>
        </label>
      </fieldset>
    </div>
  );
}

function Step2Panel({
  mode,
  workspace,
  users,
  previewTasks,
  step1Type,
  newTaskTitle,
  stubStatus,
  onUpdateTask,
  onAddTask,
  onNewTaskTitleChange,
  onRunStub,
  readOnly,
  showEmmaEventIntelligence
}: {
  mode: "create" | "edit";
  workspace: EventWorkspace | null;
  users: User[];
  previewTasks: TemplateTask[];
  step1Type: EventType;
  newTaskTitle: string;
  stubStatus: Record<string, "idle" | "running" | "done">;
  onUpdateTask: (taskId: string, patch: Partial<ActiveTask>) => Promise<void>;
  onAddTask: () => Promise<void>;
  onNewTaskTitleChange: (value: string) => void;
  onRunStub: (type: "drive" | "calendar" | "propresenter" | "comms") => Promise<void>;
  readOnly: boolean;
  showEmmaEventIntelligence: boolean;
}) {
  const tasks = workspace?.tasks ?? [];

  return (
    <div className="event-card-step2">
      <section className="event-card-section">
        <div className="toolbar split">
          <h3 className="section-title flush">Event Tasks</h3>
          {mode === "create" && !workspace && (
            <span className="pill">Preview — will generate on save</span>
          )}
        </div>

        {mode === "create" && !workspace ? (
          <div className="grid">
            {previewTasks.length ? (
              previewTasks.map((template) => (
                <div className="card task-preview-row" key={template.id}>
                  <strong>{template.taskTitle}</strong>
                  <span className="muted">
                    {template.timelineOffsetDays < 0
                      ? `${Math.abs(template.timelineOffsetDays)} days before event`
                      : "On event day"} / Assigned to {template.roleAssigned}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No baseline tasks for this event type.</p>
            )}
          </div>
        ) : (
          <>
            <div className="task-edit-list">
              {tasks.length ? (
                tasks.map((task) => (
                  <TaskEditRow key={task.id} task={task} users={users} readOnly={readOnly} onUpdate={onUpdateTask} />
                ))
              ) : (
                <p className="muted">No tasks yet. Add one below.</p>
              )}
            </div>

            {workspace && (
              <div className="add-task-row">
                <input
                  className="input"
                  placeholder="Add a task…"
                  value={newTaskTitle}
                  aria-label="New task title"
                  disabled={readOnly}
                  onChange={(e) => onNewTaskTitleChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void onAddTask(); }}
                />
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void onAddTask()}
                  disabled={readOnly || !newTaskTitle.trim()}
                >
                  + Add task
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="event-card-section">
        <h3 className="section-title">Integration Actions</h3>
        <p className="muted event-card-section-note">
          Google Drive, Google Calendar, ProPresenter, and communications remain Stub Mode. Planning Center is read-only and syncs only when manually triggered.
        </p>
        <div className="integration-stub-grid">
          <StubControl
            label="Google Drive Folder"
            status={stubStatus.drive}
            doneLabel={workspace?.event.googleDriveFolderId ? "Folder ready (stub)" : undefined}
            disabled={readOnly}
            onRun={() => void onRunStub("drive")}
          />
          <StubControl
            label="Google Calendar Sync"
            status={stubStatus.calendar}
            disabled={readOnly}
            onRun={() => void onRunStub("calendar")}
          />
          <StubControl
            label="ProPresenter Playlist"
            status={stubStatus.propresenter}
            doneLabel={workspace?.event.proPresenterPlaylistId ? "Playlist ready (stub)" : undefined}
            disabled={readOnly}
            onRun={() => void onRunStub("propresenter")}
          />
          <PlanningCenterIntegrationControl compact />
          <StubControl
            label="Communication Package"
            status={stubStatus.comms}
            doneLabel={workspace && workspace.communications.length > 0 ? `${workspace.communications.length} preview(s) generated` : undefined}
            disabled={readOnly}
            onRun={() => void onRunStub("comms")}
          />
        </div>

        {workspace && workspace.integrationLogs.length > 0 && (
          <div className="grid event-card-meta-grid">
            {workspace.integrationLogs.slice(0, 3).map((log) => (
              <div className="card" key={log.id}>
                <span className="pill stub">Stub Mode</span>
                <strong className="event-card-log-title">{log.integrationType.replace(/_/g, " ")}</strong>
                <p className="muted event-card-log-copy">{log.details.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {workspace && showEmmaEventIntelligence ? <EmmaEventIntelligencePanel eventId={workspace.event.id} /> : null}

      {workspace && workspace.communications.length > 0 && (
        <section className="event-card-section">
          <div className="toolbar split">
            <h3 className="section-title flush">Communication Previews</h3>
            <span className="pill">Preview only — not sent</span>
          </div>
          <div className="grid event-card-preview-grid">
            {workspace.communications.map((item) => (
              <article className="card" key={item.id}>
                <span className="pill">Preview only — not sent</span>
                <p className="eyebrow">{communicationTypeLabel(item.type)}</p>
                <h4 className="event-card-preview-title">{item.payload.subject}</h4>
                <p className="muted event-card-preview-copy">{item.payload.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {workspace && workspace.activity.length > 0 && (
        <section className="event-card-section" id="modal-activity-log">
          <h3 className="section-title">Activity Log</h3>
          <div className="grid">
            {workspace.activity.map((item) => (
              <article className="card" key={item.id}>
                <strong>{item.message}</strong>
                <div className="muted event-card-log-time">{new Date(item.timestamp).toLocaleString()}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskEditRow({
  task,
  users,
  readOnly,
  onUpdate
}: {
  task: ActiveTask;
  users: User[];
  readOnly: boolean;
  onUpdate: (taskId: string, patch: Partial<ActiveTask>) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [title, setTitle] = useState(task.taskTitle);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setDueDate(toDateInputValue(task.dueDate));
    setTitle(task.taskTitle);
    setSaveState("idle");
  }, [task.dueDate, task.taskTitle]);

  async function save(patch: Partial<ActiveTask>) {
    if (readOnly) return;
    setSaveState("saving");
    await onUpdate(task.id, patch);
    setSaveState("saved");
  }

  const isCritical = task.timelineOffsetDays <= -30 || task.status === "blocked";

  return (
    <div className="task-edit-row">
      <div className="task-edit-title-row">
        <input
          className="input"
          aria-label={`Title for task ${task.taskTitle}`}
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== task.taskTitle) void save({ taskTitle: title }); }}
        />
        {isCritical && <span className="pill blocked">Critical</span>}
      </div>
      <div className="task-edit-meta">
        <div className="field compact-field">
          <label htmlFor={`modal-owner-${task.id}`}>Owner</label>
          <select
            className="input"
            id={`modal-owner-${task.id}`}
            value={task.assignedUserId}
            disabled={readOnly}
            onChange={(e) => void save({ assignedUserId: e.target.value })}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
        <div className="field compact-field">
          <label htmlFor={`modal-due-${task.id}`}>Due Date</label>
          <input
            className="input"
            id={`modal-due-${task.id}`}
            type="date"
            value={dueDate}
            disabled={readOnly}
            onChange={(e) => {
              setDueDate(e.target.value);
              if (e.target.value) void save({ dueDate: new Date(`${e.target.value}T12:00:00`).toISOString() });
            }}
          />
        </div>
        <div className="field compact-field">
          <label htmlFor={`modal-status-${task.id}`}>Status</label>
          <select
            className="input"
            id={`modal-status-${task.id}`}
            value={task.status}
            disabled={readOnly}
            onChange={(e) => void save({ status: e.target.value as TaskStatus })}
          >
            {taskStatuses.map((s) => (
              <option key={s} value={s}>{taskStatusLabels[s]}</option>
            ))}
          </select>
        </div>
        <span className="inline-save-state">
          {readOnly ? "Read only" : saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>
    </div>
  );
}

function communicationTypeLabel(type: string) {
  if (type === "parent_email") return "Parent Email";
  if (type === "leader_brief") return "Leader Announcement";
  return "Blast Text Summary";
}

function StubControl({
  label,
  status,
  doneLabel,
  disabled = false,
  onRun
}: {
  label: string;
  status: "idle" | "running" | "done";
  doneLabel?: string;
  disabled?: boolean;
  onRun: () => void;
}) {
  return (
    <div className="stub-control">
      <span className="stub-control-label">{label}</span>
      <span className={status === "done" ? "pill done" : "pill stub"}>
        {status === "running" ? "Running..." : status === "done" ? (doneLabel ?? "Done (stub)") : "Stub Mode"}
      </span>
      <button
        className="button compact-button"
        type="button"
        onClick={onRun}
        disabled={disabled || status === "running"}
        aria-label={`Run ${label} stub action`}
      >
        {status === "done" ? "Re-run" : "Run stub"}
      </button>
    </div>
  );
}
