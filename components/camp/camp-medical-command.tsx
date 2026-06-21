"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";

type MedicalCommandPayload = {
  timeBlocks: Array<{
    id: string;
    studentName: string;
    timeWindow: string;
    parentHandoffOnFile: boolean;
    stateLabel: "Due" | "Completed" | "Needs Attention" | "Intake Missing";
    tone: "due" | "completed" | "attention" | "missing";
  }>;
};

export function CampMedicalCommand() {
  const { role, capabilities, selectedDay } = useCamp();
  const [data, setData] = useState<MedicalCommandPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    const params = new URLSearchParams({ role });
    if (selectedDay) params.set("day", selectedDay);
    fetch(`/api/camp/medical-command?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 403) {
          setState("forbidden");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }
        setData((await response.json()) as MedicalCommandPayload);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [role, selectedDay]);

  if (!capabilities.medicalCommand || state === "forbidden") {
    return <p className="camp-cc-muted">Medical Command is not available for this access view.</p>;
  }
  if (state === "loading") return <p className="camp-cc-muted">Loading Medical Command…</p>;
  if (state === "error") return <p className="camp-cc-error">Medical Command data could not be loaded.</p>;

  const blocks = data?.timeBlocks ?? [];
  const hasDueMedication = blocks.some((block) => block.tone === "due" || block.tone === "missing" || block.tone === "attention");

  return (
    <section className="camp-cc-medcmd" aria-label="Medical Command">
      <div className="camp-cc-medcmd-head">
        <p className="camp-cc-eyebrow">Medical Command · Andrew only</p>
        <h2>Medication time blocks</h2>
        <p className="camp-cc-muted">Operational logging view for {selectedDay || "camp"}. Restricted details stay in More Camp tools.</p>
      </div>
      {hasDueMedication ? (
        <Link href="/camp/more" className="camp-cc-nextup-cta">
          Administer Medicine
        </Link>
      ) : null}
      {blocks.length === 0 ? (
        <p className="camp-cc-muted">No medication time blocks on file.</p>
      ) : (
        <ul className="camp-cc-medcmd-list">
          {blocks.map((block) => {
            return (
              <li key={block.id} className="camp-cc-medcmd-block">
                <Link href="/camp/more" className="camp-cc-medcmd-row" aria-label={`Open medication detail for ${block.studentName}`}>
                  <span className="camp-cc-medcmd-avatar" aria-hidden="true">
                    {block.studentName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="camp-cc-medcmd-info">
                    <strong>{block.studentName}</strong>
                    <span className="camp-cc-muted">{block.timeWindow}</span>
                    {block.parentHandoffOnFile ? <span className="camp-cc-tag">Parent handoff on file</span> : null}
                  </span>
                  <span className={`camp-cc-medcmd-status ${block.tone}`}>{block.stateLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
