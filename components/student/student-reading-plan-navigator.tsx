"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import type { ScripturePlan } from "@/lib/scripture/types";

type StudentReadingPlanNavigatorProps = {
  plans: ScripturePlan[];
};

type CompletionState = Record<string, string[]>;

export function StudentReadingPlanNavigator({ plans }: StudentReadingPlanNavigatorProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [completed, setCompleted] = useState<CompletionState>({});
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const days = selectedPlan?.weeklyRhythm ?? [];
  const selectedDay = days[selectedDayIndex] ?? days[0] ?? "";
  const storageKey = "lead-emergence:student-reading-plan-progress";

  const progressLabel = useMemo(() => {
    if (!selectedPlan) return "No plan selected";
    const count = completed[selectedPlan.id]?.length ?? 0;
    return `${count} of ${days.length} days complete`;
  }, [completed, days.length, selectedPlan]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setCompleted(JSON.parse(saved) as CompletionState);
    } catch {
      setCompleted({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(completed));
  }, [completed, storageKey]);

  if (!selectedPlan) return null;

  function choosePlan(planId: string) {
    setSelectedPlanId(planId);
    setSelectedDayIndex(0);
  }

  function toggleDayComplete() {
    if (!selectedPlan) return;
    setCompleted((current) => {
      const currentPlanDays = current[selectedPlan.id] ?? [];
      const dayId = dayKey(selectedDayIndex);
      const nextDays = currentPlanDays.includes(dayId)
        ? currentPlanDays.filter((item) => item !== dayId)
        : [...currentPlanDays, dayId];
      return { ...current, [selectedPlan.id]: nextDays };
    });
  }

  const isDayComplete = completed[selectedPlan.id]?.includes(dayKey(selectedDayIndex)) ?? false;

  return (
    <section className="student-plan-navigator" aria-label="Example reading plans">
      <div className="student-plan-picker" role="list" aria-label="Reading plan choices">
        {plans.map((plan) => (
          <button
            className={`student-plan-choice ${plan.id === selectedPlan.id ? "active" : ""}`}
            key={plan.id}
            onClick={() => choosePlan(plan.id)}
            type="button"
          >
            <span>{plan.duration}</span>
            <strong>{plan.title}</strong>
            <small>{plan.primaryScripture}</small>
          </button>
        ))}
      </div>

      <article className="student-plan-stage">
        <div className="student-plan-cover">
          <p className="eyebrow">Reading Plan</p>
          <h2>{selectedPlan.title}</h2>
          <p>{selectedPlan.summary}</p>
          <div>
            <span>{selectedPlan.audience}</span>
            <span>{selectedPlan.primaryScripture}</span>
          </div>
        </div>

        <div className="student-plan-day-rail" role="tablist" aria-label={`${selectedPlan.title} days`}>
          {days.map((day, index) => {
            const isComplete = completed[selectedPlan.id]?.includes(dayKey(index)) ?? false;
            return (
              <button
                aria-selected={index === selectedDayIndex}
                className={`student-plan-day ${index === selectedDayIndex ? "active" : ""} ${isComplete ? "complete" : ""}`}
                key={day}
                onClick={() => setSelectedDayIndex(index)}
                role="tab"
                type="button"
              >
                <strong>{index + 1}</strong>
                <span>{shortDayLabel(day)}</span>
              </button>
            );
          })}
        </div>

        <section className="student-plan-day-panel" aria-label={`Day ${selectedDayIndex + 1} plan`}>
          <div className="student-plan-day-heading">
            <div>
              <p className="eyebrow">Day {selectedDayIndex + 1}</p>
              <h3>{selectedDay}</h3>
            </div>
            <span className="pill green">{progressLabel}</span>
          </div>

          <div className="student-plan-actions">
            <article>
              <span>Questions</span>
              <h4>Consider while reading</h4>
              <ul>
                {questionsForDay(selectedPlan, selectedDay).map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </article>
            <article>
              <span>Study tip</span>
              <h4>{studyTipTitle(selectedDay)}</h4>
              <p>{studyTipForDay(selectedDay)}</p>
            </article>
            <article>
              <span>Context</span>
              <h4>Ground the reading</h4>
              <p>{selectedPlan.contextFocus}</p>
            </article>
          </div>

          <button className="student-plan-complete-button" onClick={toggleDayComplete} type="button">
            {isDayComplete ? <CheckCircle2 aria-hidden="true" size={22} /> : <Circle aria-hidden="true" size={22} />}
            {isDayComplete ? "Day complete" : "Mark this day complete"}
          </button>
        </section>
      </article>
    </section>
  );
}

function dayKey(index: number) {
  return `day-${index + 1}`;
}

function shortDayLabel(value: string) {
  return value.split(" and ")[0].slice(0, 18);
}

function questionsForDay(plan: ScripturePlan, day: string) {
  const first = plan.discussionPrompts[0] ?? "What is happening in the passage?";
  const second = plan.discussionPrompts[1] ?? "What does this reveal about God, people, brokenness, or hope?";
  return [first, second, `How does "${day}" fit the plan's larger storyline?`];
}

function studyTipTitle(day: string) {
  if (/lament|suffering|slavery|exile/i.test(day)) return "Make room for honest pain";
  if (/law|covenant|obedience|formation/i.test(day)) return "Read command inside rescue";
  if (/king|kingdom|david/i.test(day)) return "Ask what faithful rule looks like";
  return "Notice before applying";
}

function studyTipForDay(day: string) {
  if (/lament|suffering|slavery|exile/i.test(day)) {
    return "Write what the passage names honestly before reaching for a lesson or explanation.";
  }

  if (/law|covenant|obedience|formation/i.test(day)) {
    return "Ask what God has already done before asking what people are called to do.";
  }

  if (/king|kingdom|david/i.test(day)) {
    return "Look for the kind of leadership the text celebrates, exposes, or waits for.";
  }

  return "List repeated words, people, places, commands, promises, and contrasts before writing an application.";
}
