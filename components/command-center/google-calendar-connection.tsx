"use client";

import { useEffect, useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

type CalendarEvent = {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  isAllDay: boolean;
};

type EventForm = {
  summary: string;
  start: string;
  end: string;
  description: string;
  isAllDay: boolean;
};

const EMPTY_FORM: EventForm = { summary: "", start: "", end: "", description: "", isAllDay: false };

function toFormEvent(event: CalendarEvent): EventForm {
  return {
    summary: event.summary,
    start: event.start ?? "",
    end: event.end ?? "",
    description: "",
    isAllDay: event.isAllDay
  };
}

export function GoogleCalendarConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [mode, setMode] = useState<"closed" | "create" | string>("closed");
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (displayStatus !== "connected") return;
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayStatus]);

  async function loadEvents() {
    try {
      const response = await fetch("/api/command-center/integrations/google-calendar/events");
      const data = (await response.json().catch(() => ({}))) as { events?: CalendarEvent[] };
      if (response.ok) setEvents(data.events ?? []);
    } catch {
      // Leave events as-is; the toolbar action buttons still work independently.
    }
  }

  async function handleDisconnect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/google-calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Failed to disconnect.");
      window.location.reload();
    } catch {
      setError("Could not disconnect. Try again.");
      setPending(false);
    }
  }

  function startCreate() {
    setMode("create");
    setForm(EMPTY_FORM);
    setError(null);
  }

  function startEdit(event: CalendarEvent) {
    setMode(event.id);
    setForm(toFormEvent(event));
    setError(null);
  }

  async function handleSave() {
    if (!form.summary.trim() || !form.start.trim() || !form.end.trim()) {
      setError("Title, start, and end are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isCreate = mode === "create";
      const url = isCreate
        ? "/api/command-center/integrations/google-calendar/events"
        : `/api/command-center/integrations/google-calendar/events/${mode}`;
      const response = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, timeZone })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Save failed.");
      setMode("closed");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (displayStatus === "not_configured") {
    return (
      <button className="button" type="button" disabled>
        Not active yet
      </button>
    );
  }

  if (displayStatus !== "connected") {
    return (
      <a className="button primary" href="/api/command-center/integrations/google-calendar/connect">
        Connect Google Calendar
      </a>
    );
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <button className="button primary" type="button" onClick={startCreate} disabled={mode !== "closed"}>
          New event
        </button>
        <button className="button" type="button" onClick={handleDisconnect} disabled={pending}>
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {mode !== "closed" ? (
        <div className="grid">
          <input
            aria-label="Event title"
            placeholder="Event title"
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={form.isAllDay}
              onChange={(event) => setForm({ ...form, isAllDay: event.target.checked })}
            />
            {" "}All day
          </label>
          <input
            aria-label="Start"
            type={form.isAllDay ? "date" : "datetime-local"}
            value={form.start}
            onChange={(event) => setForm({ ...form, start: event.target.value })}
          />
          <input
            aria-label="End"
            type={form.isAllDay ? "date" : "datetime-local"}
            value={form.end}
            onChange={(event) => setForm({ ...form, end: event.target.value })}
          />
          <textarea
            aria-label="Description"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="toolbar">
            <button className="button primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create event" : "Save changes"}
            </button>
            <button className="button" type="button" onClick={() => setMode("closed")} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {events ? (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.summary}</strong> — {event.start ?? "unscheduled"}
              {"  "}
              <button className="button" type="button" onClick={() => startEdit(event)} disabled={mode !== "closed"}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
