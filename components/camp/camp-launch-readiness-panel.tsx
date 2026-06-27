"use client";

import { useEffect, useState } from "react";
import type { CampLaunchReadiness } from "@/lib/camp/readiness";
import { CampStatusChip } from "@/components/camp/camp-ui";

type State =
  | { status: "idle" | "loading" | "forbidden" }
  | { status: "ready"; readiness: CampLaunchReadiness }
  | { status: "error"; message: string };

export function CampLaunchReadinessPanel() {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    fetch("/api/camp/readiness", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 403) {
          setState({ status: "forbidden" });
          return;
        }
        const body = await response.json().catch(() => ({})) as { readiness?: CampLaunchReadiness; error?: string };
        if (!response.ok || !body.readiness) {
          setState({ status: "error", message: body.error ?? "Camp launch readiness could not be loaded." });
          return;
        }
        setState({ status: "ready", readiness: body.readiness });
      })
      .catch(() => active && setState({ status: "error", message: "Camp launch readiness could not be loaded." }));
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "forbidden") return null;
  if (state.status === "loading" || state.status === "idle") {
    return <p className="camp-cc-muted">Checking launch readiness...</p>;
  }
  if (state.status === "error") {
    return (
      <section className="camp-list-row align-start">
        <div>
          <strong>Launch Readiness</strong>
          <p className="camp-cc-error">{state.message}</p>
        </div>
        <CampStatusChip tone="warn">Needs attention</CampStatusChip>
      </section>
    );
  }
  if (state.status !== "ready") return null;

  const { readiness } = state;
  const rows = [
    ["Runtime mode", readiness.runtimeMode],
    ["Supabase connected", yesNo(readiness.supabaseConnected.ok, readiness.supabaseConnected.message)],
    ["camp_access_members available", yesNo(readiness.campAccessMembersAvailable.ok, readiness.campAccessMembersAvailable.message)],
    ["EMMA provider configured", yesNo(readiness.emmaProviderConfigured.ok, readiness.emmaProviderConfigured.message)],
    ["EMMA actions/audit available", yesNo(readiness.emmaActionsAuditAvailable.ok, readiness.emmaActionsAuditAvailable.message)],
    ["Import commit enabled", yesNo(readiness.importCommitEnabled.ok, readiness.importCommitEnabled.message)],
    ["Current authenticated user", readiness.currentUserEmail],
    ["Server-resolved Camp access", readiness.serverResolvedCampAccess.role ?? readiness.serverResolvedCampAccess.message ?? "not available"]
  ];

  return (
    <section className="camp-list-row align-start" aria-label="Camp launch readiness">
      <div className="camp-access-panel">
        <div className="camp-access-panel-head">
          <div>
            <strong>Launch Readiness</strong>
            <p className="camp-cc-muted">Server checks for real Camp launch testing.</p>
          </div>
          <CampStatusChip tone={readiness.errors.length ? "warn" : "ready"}>
            {readiness.errors.length ? "Needs attention" : "Ready"}
          </CampStatusChip>
        </div>
        <div className="camp-readiness-grid">
          {rows.map(([label, value]) => (
            <div key={label} className="camp-readiness-row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {readiness.errors.length ? (
          <ul className="camp-readiness-errors">
            {readiness.errors.map((error: string) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function yesNo(ok: boolean, message?: string) {
  if (ok) return "yes";
  return message ? `no - ${message}` : "no";
}
