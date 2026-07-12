"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { ScriptureResource } from "@/lib/scripture/types";

type StudentStudyToolRailProps = {
  resources: ScriptureResource[];
};

export function StudentStudyToolRail({ resources }: StudentStudyToolRailProps) {
  const [activeResource, setActiveResource] = useState<ScriptureResource | null>(null);

  return (
    <section className="student-study-tool-rail-wrap" aria-label="Reading skill cards">
      <div className="student-study-tool-rail">
        {resources.map((resource) => (
          <button className="student-study-tool-card" key={resource.id} onClick={() => setActiveResource(resource)} type="button">
            <span>{resource.title}</span>
            <strong>{resource.summary}</strong>
            <small>Open examples</small>
          </button>
        ))}
      </div>

      {activeResource ? (
        <div className="student-study-tool-popover" role="dialog" aria-modal="true" aria-label={`${activeResource.title} study tool`}>
          <div className="student-study-tool-popover-card">
            <div className="student-study-tool-popover-heading">
              <div>
                <p className="eyebrow">Study Tool</p>
                <h3>{activeResource.title}</h3>
              </div>
              <button className="button icon" onClick={() => setActiveResource(null)} type="button">
                <X aria-hidden="true" size={18} />
                <span className="sr-only">Close study tool</span>
              </button>
            </div>
            <p>{activeResource.summary}</p>
            <section>
              <strong>Try this while reading</strong>
              <p>{activeResource.studentPractice}</p>
            </section>
            <section>
              <strong>Example exercise</strong>
              <p>{exerciseForResource(activeResource.id)}</p>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function exerciseForResource(id: string) {
  const exercises: Record<string, string> = {
    context: "Write one sentence for what happens immediately before and after the passage. Then ask how that changes the question.",
    observation: "Circle repeated words, commands, contrasts, and promises before writing any interpretation.",
    interpretation: "Make two columns: what the text directly says, and what you are carefully inferring from it.",
    application: "Name one response that fits the passage, then ask whether it should be practiced alone or with your group.",
    discussion: "Bring one observation, one question, and one line you want the group to read out loud.",
    prayer: "Turn one phrase from the passage into praise, confession, request, or trust.",
    "proof-texting": "Read the whole paragraph around the verse and summarize it before quoting the verse.",
    typology: "List the textual links before naming a pattern. If the links are thin, hold the connection loosely.",
    "better-questions": "Move through three questions: What is happening? What does it reveal? How should we respond together?"
  };

  return exercises[id] ?? "Read slowly, write one observation, then bring one honest question to group.";
}
