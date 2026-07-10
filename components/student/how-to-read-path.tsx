"use client";

import { BookOpen, CheckCircle2, Circle, Headphones, Image as ImageIcon, PlayCircle, ShieldCheck, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { HowToReadModule } from "@/lib/scripture/how-to-read";

type HowToReadPathProps = {
  initialCompletedModuleIds?: string[];
  modules: HowToReadModule[];
};

type ProgressResponse = {
  ok?: boolean;
  error?: string;
  progress?: {
    completedModuleIds?: string[];
  };
};

const localProgressKey = "lead-emergence:student-how-to-read-progress";

export function HowToReadPath({ initialCompletedModuleIds = [], modules }: HowToReadPathProps) {
  const validModuleIds = useMemo(() => new Set(modules.map((module) => module.id)), [modules]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => sanitizeCompletedIds(initialCompletedModuleIds, validModuleIds));
  const [saveMessage, setSaveMessage] = useState("Progress saves when storage is connected.");
  const [savingModuleId, setSavingModuleId] = useState<string | null>(null);
  const completedCount = completedIds.size;
  const currentModule = modules.find((module) => !completedIds.has(module.id)) ?? modules[modules.length - 1];
  const earnedBadges = useMemo(() => modules.filter((module) => completedIds.has(module.id)).map((module) => module.badge), [completedIds, modules]);

  function toggleComplete(moduleId: string) {
    if (!validModuleIds.has(moduleId)) return;
    const wasComplete = completedIds.has(moduleId);
    const nextCompleted = new Set(completedIds);
    if (wasComplete) {
      nextCompleted.delete(moduleId);
    } else {
      nextCompleted.add(moduleId);
    }

    setCompletedIds(nextCompleted);
    persistLocalProgress(nextCompleted);
    setSavingModuleId(moduleId);
    setSaveMessage("Saving progress...");

    void syncProgress(moduleId, !wasComplete, completedIds);
  }

  async function syncProgress(moduleId: string, completed: boolean, rollbackIds: Set<string>) {
    try {
      const response = await fetch("/api/student/scripture/how-to-read-progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, completed })
      });
      const payload = (await response.json()) as ProgressResponse;

      if (response.ok && payload.ok && payload.progress?.completedModuleIds) {
        const serverCompleted = sanitizeCompletedIds(payload.progress.completedModuleIds, validModuleIds);
        setCompletedIds(serverCompleted);
        persistLocalProgress(serverCompleted);
        setSaveMessage("Progress saved.");
        return;
      }

      if (response.status === 503) {
        setSaveMessage("Saved in this browser for now. Server progress is not connected yet.");
        return;
      }

      setCompletedIds(rollbackIds);
      persistLocalProgress(rollbackIds);
      setSaveMessage(payload.error ?? "Progress could not be saved.");
    } catch {
      setSaveMessage("Saved in this browser for now. Server progress is not connected yet.");
    } finally {
      setSavingModuleId(null);
    }
  }

  useEffect(() => {
    if (initialCompletedModuleIds.length > 0) return;
    const localIds = readLocalProgress(validModuleIds);
    if (localIds.size > 0) {
      setCompletedIds(localIds);
      setSaveMessage("Loaded saved progress from this browser.");
    }
  }, [initialCompletedModuleIds.length, validModuleIds]);

  return (
    <div className="how-to-read-path">
      <section className="how-to-read-hero" aria-labelledby="how-to-read-title">
        <div className="how-to-read-hero-copy">
          <p className="eyebrow">How to Read</p>
          <h1 id="how-to-read-title">Learn to read the Bible with care.</h1>
          <p>
            Short guides, simple practice, and honest questions you can bring back to your group. Built for students who are new,
            curious, growing, or still deciding what they believe.
          </p>
        </div>
        <div className="how-to-read-current" aria-label="Current guide">
          <span className="pill blue">Start here</span>
          <h2>{currentModule.title}</h2>
          <p>{currentModule.summary}</p>
        </div>
      </section>

      <section className="how-to-read-progress-card" aria-label="Reading progress">
        <div className="how-to-read-progress-copy">
          <p className="eyebrow">Your path</p>
          <h2>
            {completedCount} of {modules.length} guides signed off
          </h2>
          <p>This path saves your progress when student storage is connected. Until then, it stays in this browser.</p>
        </div>
        <p className="how-to-read-progress-status" role="status">
          {saveMessage}
        </p>
        <div className="how-to-read-progress-meter" aria-label={`${completedCount} of ${modules.length} guides complete`}>
          {modules.map((module) => (
            <span className={completedIds.has(module.id) ? "complete" : ""} key={module.id} />
          ))}
        </div>
        <div className="how-to-read-badges" aria-label="Earned badges">
          {earnedBadges.length ? (
            earnedBadges.map((badge) => (
              <span className="how-to-read-badge" key={badge}>
                <Trophy size={14} aria-hidden="true" />
                {badge}
              </span>
            ))
          ) : (
            <span className="how-to-read-badge muted">
              <Trophy size={14} aria-hidden="true" />
              Badges appear as guides are signed off
            </span>
          )}
        </div>
      </section>

      <section className="how-to-read-module-list" aria-label="How to read your Bible guides">
        {modules.map((module) => {
          const isComplete = completedIds.has(module.id);
          const isCurrent = module.id === currentModule.id && !isComplete;

          return (
            <article className={`how-to-read-module ${isComplete ? "complete" : ""} ${isCurrent ? "current" : ""}`} key={module.id}>
              <div className="how-to-read-module-head">
                <div className="how-to-read-module-number" aria-hidden="true">
                  {isComplete ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </div>
                <div>
                  <p className="eyebrow">
                    Guide {module.order} - {module.minutes} min
                  </p>
                  <h2>{module.title}</h2>
                  <p>{module.summary}</p>
                </div>
                <span className={`pill ${isComplete ? "green" : isCurrent ? "amber" : "blue"}`}>
                  {isComplete ? "Done" : isCurrent ? "Next" : "Open"}
                </span>
              </div>

              <div className="how-to-read-module-tools" aria-label={`${module.title} tools`}>
                <div>
                  <PlayCircle size={17} aria-hidden="true" />
                  <span>{module.videoLabel}</span>
                </div>
                <div>
                  <ImageIcon size={17} aria-hidden="true" />
                  <span>{module.infographicLabel}</span>
                </div>
                <div>
                  <Headphones size={17} aria-hidden="true" />
                  <span>Audio option later</span>
                </div>
              </div>

              <div className="how-to-read-module-body">
                <section>
                  <h3>
                    <BookOpen size={16} aria-hidden="true" />
                    What to notice
                  </h3>
                  <ul>
                    {module.tools.map((tool) => (
                      <li key={tool}>{tool}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>
                    <ShieldCheck size={16} aria-hidden="true" />
                    Try this
                  </h3>
                  <p>{module.practice}</p>
                </section>
                <section>
                  <h3>
                    <Users size={16} aria-hidden="true" />
                    Bring to group
                  </h3>
                  <p>{module.groupQuestion}</p>
                </section>
              </div>

              <div className="how-to-read-module-actions">
                <button className="button primary" type="button" aria-pressed={isComplete} onClick={() => toggleComplete(module.id)}>
                  {savingModuleId === module.id ? "Saving..." : isComplete ? "Signed off" : "Mark complete"}
                </button>
                <span className="how-to-read-badge">
                  <Trophy size={14} aria-hidden="true" />
                  {module.badge}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="how-to-read-sharing-note" aria-label="Group progress note">
        <div>
          <p className="eyebrow">Progress with friends</p>
          <h2>Make it encouraging, not embarrassing.</h2>
          <p>
            When saved progress is added, group visibility should be small-group only, opt-in, and focused on encouragement.
            No public ranking, no shame streaks, and no pressure for students who are just starting.
          </p>
        </div>
      </section>
    </div>
  );
}

function sanitizeCompletedIds(moduleIds: string[], validModuleIds: Set<string>) {
  return new Set(moduleIds.filter((moduleId) => validModuleIds.has(moduleId)));
}

function readLocalProgress(validModuleIds: Set<string>) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(localProgressKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? sanitizeCompletedIds(parsed.filter((item): item is string => typeof item === "string"), validModuleIds) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function persistLocalProgress(moduleIds: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localProgressKey, JSON.stringify(Array.from(moduleIds)));
  } catch {
    // Local progress is helpful, but the UI should not fail if storage is blocked.
  }
}
