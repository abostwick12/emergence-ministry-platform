"use client";

import { useEffect, useState } from "react";

import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type ReflectionResponse = {
  ok?: boolean;
  error?: string;
  reflection?: StudentQuestionReflection;
};

type StudentReflectionPanelProps = {
  onSaved: (reflection: StudentQuestionReflection) => void;
  prompt: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
};

export function StudentReflectionPanel({ onSaved, prompt, reflection }: StudentReflectionPanelProps) {
  const [privateNote, setPrivateNote] = useState(reflection?.privateNote ?? "");
  const [isReflected, setIsReflected] = useState(Boolean(reflection?.reflectedAt));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(reflection?.reflectedAt ? "Reflection saved. Bring this with you to group." : "Private to you.");

  useEffect(() => {
    setPrivateNote(reflection?.privateNote ?? "");
    setIsReflected(Boolean(reflection?.reflectedAt));
    setStatus(reflection?.reflectedAt ? "Reflection saved. Bring this with you to group." : reflection?.privateNote ? "Private note saved." : "Private to you.");
  }, [prompt.id, reflection?.privateNote, reflection?.reflectedAt]);

  async function saveReflection(reflected: boolean) {
    const previousIsReflected = isReflected;
    setIsSaving(true);
    setIsReflected(reflected || previousIsReflected);
    setStatus(reflected ? "Reflection saved. Syncing..." : "Private note saved. Syncing...");
    try {
      const response = await fetch("/api/student/scripture/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: prompt.id, reflected, privateNote })
      });
      const payload = (await response.json()) as ReflectionResponse;
      if (!response.ok || !payload.ok || !payload.reflection) {
        setIsReflected(previousIsReflected);
        setStatus(payload.error ?? "Reflection could not be saved.");
        return;
      }

      onSaved(payload.reflection);
      setIsReflected(Boolean(payload.reflection.reflectedAt));
      setPrivateNote(payload.reflection.privateNote);
      setStatus(payload.reflection.reflectedAt ? "Reflection saved. Bring this with you to group." : "Private note saved.");
    } catch {
      setIsReflected(previousIsReflected);
      setStatus("Reflection could not be saved. Your text is still here.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="student-question-reflection" aria-label="Private reflection">
      <div>
        <p className="eyebrow">Reflect</p>
        <h3>What are you noticing?</h3>
        <p>Save a private note for yourself before this becomes a group conversation.</p>
      </div>
      <label>
        <span>Private note</span>
        <textarea
          maxLength={1200}
          onChange={(event) => setPrivateNote(event.target.value)}
          placeholder="What are you starting to see, wonder, or pray?"
          value={privateNote}
        />
      </label>
      <div className="student-question-reflection-actions">
        <button className="button" disabled={isSaving} onClick={() => void saveReflection(isReflected)} type="button">
          {isSaving ? "Saving..." : "Save note"}
        </button>
        <button className="button primary" disabled={isSaving} onClick={() => void saveReflection(true)} type="button">
          {isReflected ? "Reflected" : "I reflected on this"}
        </button>
      </div>
      <p className="student-question-reflection-status" role="status">
        {status}
      </p>
    </section>
  );
}
