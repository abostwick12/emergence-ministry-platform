"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { studentHowToReadLocalProgressKey } from "@/lib/scripture/how-to-read";

type HowToReadGuideActionsProps = {
  initialComplete: boolean;
  initialProgressStorage: "server" | "local" | "unavailable";
  moduleId: string;
  nextGuideHref?: string;
  previousGuideHref?: string;
};

type ProgressResponse = {
  ok?: boolean;
  error?: string;
  progress?: {
    completedModuleIds?: string[];
  };
};

export function HowToReadGuideActions({
  initialComplete,
  initialProgressStorage,
  moduleId,
  nextGuideHref,
  previousGuideHref
}: HowToReadGuideActionsProps) {
  const [isComplete, setIsComplete] = useState(initialComplete);
  const [message, setMessage] = useState(initialComplete ? "This guide is signed off." : "Sign this guide off when you are ready.");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialProgressStorage === "server" || initialComplete) return;
    const localIds = readLocalProgress();
    if (localIds.has(moduleId)) {
      setIsComplete(true);
      setMessage(initialProgressStorage === "local" ? "Progress saved in this portal session." : "Loaded saved progress from this browser.");
    }
  }, [initialComplete, initialProgressStorage, moduleId]);

  async function toggleComplete() {
    const nextComplete = !isComplete;
    const rollbackComplete = isComplete;
    setIsComplete(nextComplete);
    persistLocalProgress(moduleId, nextComplete);
    setIsSaving(true);
    setMessage("Saving progress...");

    try {
      const response = await fetch("/api/student/scripture/how-to-read-progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, completed: nextComplete })
      });
      const payload = (await response.json()) as ProgressResponse;

      if (response.ok && payload.ok && payload.progress?.completedModuleIds) {
        const serverComplete = payload.progress.completedModuleIds.includes(moduleId);
        setIsComplete(serverComplete);
        persistLocalProgress(moduleId, serverComplete);
        setMessage(serverComplete ? "Progress saved. This guide is signed off." : "Progress saved. This guide is open again.");
        return;
      }

      if (response.status === 503) {
        setMessage("Saved in this browser for now. Server progress is not connected yet.");
        return;
      }

      setIsComplete(rollbackComplete);
      persistLocalProgress(moduleId, rollbackComplete);
      setMessage(payload.error ?? "Progress could not be saved.");
    } catch {
      setMessage("Saved in this browser for now. Server progress is not connected yet.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="how-to-read-guide-signoff" aria-label="Guide sign off">
      <p className="how-to-read-guide-signoff-status" role="status">
        {message}
      </p>
      <div className="how-to-read-guide-actions">
        <Link className="button secondary" href="/student/scripture/how-to-read" prefetch={false}>
          Back to path
        </Link>
        {previousGuideHref ? (
          <Link className="button secondary" href={previousGuideHref}>
            Previous guide
          </Link>
        ) : null}
        <button className="button primary" type="button" aria-pressed={isComplete} onClick={toggleComplete} disabled={isSaving}>
          {isSaving ? "Saving..." : isComplete ? "Signed off" : "Mark complete"}
        </button>
        {nextGuideHref ? (
          <Link className="button secondary" href={nextGuideHref}>
            Next guide
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function readLocalProgress() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(studentHowToReadLocalProgressKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function persistLocalProgress(moduleId: string, completed: boolean) {
  if (typeof window === "undefined") return;
  try {
    const moduleIds = readLocalProgress();
    if (completed) {
      moduleIds.add(moduleId);
    } else {
      moduleIds.delete(moduleId);
    }
    window.localStorage.setItem(studentHowToReadLocalProgressKey, JSON.stringify(Array.from(moduleIds)));
  } catch {
    // Local progress is a fallback; blocked storage should not break the guide.
  }
}
