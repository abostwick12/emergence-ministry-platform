"use client";

import { useState } from "react";

export function QuickCaptureButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const rawText = text.trim();
    if (!rawText) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText })
      });
      if (!response.ok) throw new Error("Failed to save capture");
      setText("");
      setSavedMessage("Captured. Review it from the dashboard inbox.");
      setTimeout(() => setSavedMessage(null), 2500);
      setOpen(false);
    } catch {
      setError("Capture could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="command-center-capture">
      {open ? (
        <div className="panel command-center-capture-panel">
          <p className="eyebrow">Quick Capture</p>
          <textarea
            autoFocus
            className="command-center-capture-textarea"
            placeholder="Capture a raw note, task, lead, or reminder."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {error ? (
            <p className="muted" role="alert">
              {error}
            </p>
          ) : null}
          <div className="toolbar">
            <button className="button primary" type="button" disabled={saving || !text.trim()} onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="button ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {savedMessage ? <div className="command-center-capture-toast pill green">{savedMessage}</div> : null}
      <button
        className="button primary command-center-capture-fab"
        type="button"
        aria-label="Quick capture"
        onClick={() => setOpen((value) => !value)}
      >
        + Capture
      </button>
    </div>
  );
}
