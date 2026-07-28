"use client";

import { useMemo, useState } from "react";

import { UnifiedDashboardBrandArt } from "@/components/unified-dashboard-brand-art";
import {
  competitionBoundaryGroups,
  competitionEcosystemProof,
  competitionVerificationRoutes
} from "@/lib/competition/ecosystem-proof";

type DemoStep = {
  id: "operations" | "ministry" | "student" | "scripture" | "journey" | "leader" | "community";
  label: string;
  eyebrow: string;
  title: string;
  body: string;
};

const demoSteps: DemoStep[] = [
  {
    id: "operations",
    label: "Operations",
    eyebrow: "Ministry operating rhythm",
    title: "The week starts with one shared view of events, tasks, people, and communications.",
    body:
      "Lead Emergence brings the operational work into a single rhythm so leaders can spend less energy hunting for context and more energy preparing for people."
  },
  {
    id: "ministry",
    label: "Meridian",
    eyebrow: "Ministry Hub",
    title: "Meridian keeps decisions grounded in the ministry's own culture.",
    body:
      "Leaders author vision, mission, values, season focus, and Success Looks Like criteria. EMMA can compare observable evidence against that context without replacing discernment."
  },
  {
    id: "student",
    label: "Student question",
    eyebrow: "Student social frontier",
    title: "A student asks the question they were afraid to say out loud.",
    body:
      "The portal turns a hard faith question into a reviewable discipleship moment instead of letting it disappear into a group chat."
  },
  {
    id: "scripture",
    label: "YouVersion grounding",
    eyebrow: "YouVersion Platform API",
    title: "Scripture appears in the flow, not as a detour.",
    body:
      "The server looks up the selected passage and keeps Bible text transient, so leaders can ground the conversation without storing licensed Scripture content."
  },
  {
    id: "journey",
    label: "Journey Journal",
    eyebrow: "Formation engine",
    title: "The student receives a Bible-study rhythm while leaders prepare.",
    body:
      "The Journey Journal deepens the question through Receive, Explore, Practice, Walk, and See, so students build lifelong Scripture habits instead of waiting for a packaged answer."
  },
  {
    id: "leader",
    label: "Leader review",
    eyebrow: "Gloo AI Studio plus human approval",
    title: "A leader edits, approves, or escalates before anything posts.",
    body:
      "Gloo-backed drafts stay inside a leader-review workflow with safety labels, diagnostics, audit history, and clear escalation paths for pastoral-care concerns."
  },
  {
    id: "community",
    label: "Follow-through",
    eyebrow: "Relational ministry",
    title: "The approved next step moves back into real ministry relationships.",
    body:
      "The platform prepares the conversation, flags care needs, and preserves the decision trail so leaders can notice students, follow up, and make room for relational ministry."
  }
];

const scriptureGrounding = [
  "Creation: the world was made good.",
  "Fall: suffering enters through fracture.",
  "Messiah: Jesus enters suffering instead of avoiding it.",
  "New Creation: restoration is where the story is going."
];

const discussionPrompts = [
  "Where does this question show up in the biblical story?",
  "What does Romans 8 help us say with confidence, and what should we hold humbly?",
  "How could our group respond to someone who is suffering without giving them a shallow answer?"
];

export function HackathonPublicDemo() {
  const [activeStepId, setActiveStepId] = useState<DemoStep["id"]>("operations");
  const activeStep = useMemo(
    () => demoSteps.find((step) => step.id === activeStepId) ?? demoSteps[0],
    [activeStepId]
  );

  return (
    <main className="hackathon-demo app-shell" aria-label="Lead Emergence public hackathon demo">
      <div className="app-shell-parchment" aria-hidden="true" />
      <div className="app-shell-night-sky" aria-hidden="true" />
      <div className="app-top-art-clip" aria-hidden="true">
        <UnifiedDashboardBrandArt />
      </div>

      <aside className="sidebar app-sidebar hackathon-sidebar" aria-label="Public demo navigation">
        <a className="brand-lead" href="/hackathon" aria-label="Lead Emergence Automated Platform">
          <span className="brand-lead-name">
            <span className="brand-lead-light">Lead</span> <span className="brand-lead-bold">Emergence</span>
          </span>
          <span className="brand-lead-sub">Automated Platform</span>
        </a>

        <nav className="app-nav-list" aria-label="Demo sections">
          <a className="app-nav-link active" href="#overview">
            Overview
          </a>
          <a className="app-nav-link" href="#demo-loop">
            Product Loop
          </a>
          <a className="app-nav-link" href="#ecosystem-proof">
            Ecosystem
          </a>
          <a className="app-nav-link" href="#technical-proof">
            Technical Proof
          </a>
        </nav>

        <div className="role-control" role="group" aria-label="Demo roles">
          <span className="role-pill active">Student</span>
          <span className="role-pill">Leader</span>
        </div>

        <div className="sidebar-profile">
          <span className="sidebar-avatar" aria-hidden="true">
            LE
          </span>
          <span className="sidebar-profile-text">
            <strong>Public Demo</strong>
            <span className="muted">Scripture in New Frontiers</span>
          </span>
        </div>

        <div className="sidebar-wash-bottom" aria-hidden="true" />
      </aside>

      <section className="main app-main app-main-shell hackathon-main">
        <header className="app-header app-fixed-header">
          <div className="app-header-text">
            <h1 className="app-header-title app-header-title-compact">Hackathon Demo</h1>
            <p className="app-header-welcome">
              A public view of Lead Emergence connecting ministry operations, Meridian context, Scripture grounding, Gloo-assisted drafts, and leader review.
            </p>
          </div>
          <div className="app-header-right">
            <span className="pill blue">YouVersion</span>
            <span className="pill green">Gloo AI Studio</span>
            <span className="pill amber">Meridian</span>
          </div>
        </header>

        <div className="app-content app-scroll-region">
          <section className="panel dashboard-orientation hackathon-overview" id="overview" aria-labelledby="hackathon-title">
            <div>
              <p className="eyebrow">Scripture in New Frontiers</p>
              <h2 className="title" id="hackathon-title">
                A Scripture-native ministry operating system.
              </h2>
              <p className="muted">
                Lead Emergence connects ministry operations, Meridian memory, YouVersion Scripture grounding, Gloo-assisted
                drafts, and leader approval so digital ministry creates more space for relational ministry.
              </p>
            </div>
            <div className="hackathon-overview-side">
              <div className="dashboard-actions">
                <a className="button primary" href="#demo-loop">
                  Watch the Loop
                </a>
                <a className="button" href="#ecosystem-proof">
                  Ecosystem Proof
                </a>
                <a className="button" href="#technical-proof">
                  Technical Proof
                </a>
              </div>
              <div className="dashboard-list compact" aria-label="Demo promise">
                <div className="dashboard-list-item">
                  <strong>Total ministry tool</strong>
                  <span className="muted">Operations, decisions, Scripture, and people in one reviewable system.</span>
                </div>
                <div className="dashboard-list-item">
                  <strong>Relational payoff</strong>
                  <span className="muted">Less coordination drag, more attention for students, volunteers, and follow-up.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="hackathon-loop" id="demo-loop" aria-labelledby="demo-loop-title">
            <div className="hackathon-section-head">
              <p className="eyebrow">Product loop</p>
              <h2 className="section-title flush" id="demo-loop-title">
                One ministry week, one connected formation loop
              </h2>
            </div>

            <div className="hackathon-loop-grid">
              <div className="hackathon-step-list" role="tablist" aria-label="Demo steps">
                {demoSteps.map((step, index) => (
                  <button
                    aria-controls={`hackathon-step-${step.id}`}
                    aria-selected={step.id === activeStep.id}
                    className={step.id === activeStep.id ? "hackathon-step-button active" : "hackathon-step-button"}
                    key={step.id}
                    onClick={() => setActiveStepId(step.id)}
                    role="tab"
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.label}</strong>
                  </button>
                ))}
              </div>

              <article className="hackathon-stage" id={`hackathon-step-${activeStep.id}`} role="tabpanel">
                <div className="hackathon-stage-copy">
                  <p className="eyebrow">{activeStep.eyebrow}</p>
                  <h3>{activeStep.title}</h3>
                  <p>{activeStep.body}</p>
                </div>

                <div className="hackathon-product-shot" aria-label="Sanitized product preview">
                  <div className="hackathon-phone">
                    <div className="hackathon-phone-bar" />
                    <p className="eyebrow">Ministry week</p>
                    <h4>Fall Launch Night, student questions, and leader follow-up are connected.</h4>
                    <p>
                      Guest mode uses seeded data, but the workflow shape is real: plan the event, prepare leaders, ground
                      Scripture, review care signals, and keep follow-through visible.
                    </p>
                    <span className="pill amber">Human review required</span>
                  </div>

                  <div className="hackathon-review-panel">
                    <div className="toolbar split">
                      <div>
                        <p className="eyebrow">Meridian review package</p>
                        <h4>Scripture Practice season, Romans 8, and leader-approved next steps</h4>
                      </div>
                      <span className="pill green">Safe for discussion</span>
                    </div>
                    <ul className="hackathon-scripture-list">
                      {scriptureGrounding.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="hackathon-prompt-box">
                      {discussionPrompts.map((prompt) => (
                        <p key={prompt}>{prompt}</p>
                      ))}
                    </div>
                  </div>

                  <div className="hackathon-slack-card">
                    <p className="eyebrow">Community follow-through</p>
                    <strong>#hs-scripture-questions</strong>
                    <p>
                      Approved discussion starters can move into the spaces students already use, while the ministry keeps
                      audit history, safety boundaries, and leader ownership intact.
                    </p>
                    <span className="pill blue">Preview and audit boundary</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="hackathon-ecosystem" id="ecosystem-proof" aria-labelledby="ecosystem-proof-title">
            <div className="hackathon-section-head">
              <p className="eyebrow">Ecosystem proof</p>
              <h2 className="section-title flush" id="ecosystem-proof-title">
                Built to be a ministry ecosystem, not another tracker or Bible app
              </h2>
            </div>

            <div className="hackathon-ecosystem-grid">
              {competitionEcosystemProof.map((item) => (
                <article className="hackathon-ecosystem-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>

            <div className="hackathon-boundary-grid" aria-label="Live versus demo boundaries">
              {competitionBoundaryGroups.map((group) => (
                <article className="hackathon-boundary-card" key={group.label}>
                  <h3>{group.label}</h3>
                  <ul>
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="hackathon-proof" id="technical-proof" aria-labelledby="technical-proof-title">
            <div className="hackathon-section-head">
              <p className="eyebrow">Technical proof</p>
              <h2 className="section-title flush" id="technical-proof-title">
                Follow the real app surfaces judges can verify
              </h2>
            </div>

            <div className="hackathon-proof-grid">
              <article className="card dashboard-card">
                <span className="pill blue">YouVersion</span>
                <h3>Scripture lookup stays server-side</h3>
                <p>
                  Existing code already routes passage lookup through the server using a server-only app key, controlled
                  reference parsing, provider errors, and no stored Bible text.
                </p>
              </article>
              <article className="card dashboard-card">
                <span className="pill green">Journey Journal</span>
                <h3>Formation keeps moving without a live provider</h3>
                <p>
                  The local Scripture journey already gives students passage-aware study steps, embodied practice, and
                  leader-visible readiness while external AI credentials are added later.
                </p>
              </article>
              <article className="card dashboard-card">
                <span className="pill amber">Gloo plus Meridian</span>
                <h3>AI drafts stay reviewable and culture-aware</h3>
                <p>
                  Gloo AI Studio is the primary draft path for discussions and reading plans; Meridian context shapes the
                  request, and leaders approve before any student-facing step.
                </p>
              </article>
            </div>

            <nav className="hackathon-demo-routes" aria-label="Judge verification routes">
              {competitionVerificationRoutes.map((route) => (
                <a href={route.href} key={route.href}>{route.label}</a>
              ))}
            </nav>
          </section>
        </div>
      </section>
    </main>
  );
}
