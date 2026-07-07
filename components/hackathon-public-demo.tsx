"use client";

import { useMemo, useState } from "react";

import { UnifiedDashboardBrandArt } from "@/components/unified-dashboard-brand-art";

type DemoStep = {
  id: "student" | "scripture" | "gloo" | "leader" | "slack";
  label: string;
  eyebrow: string;
  title: string;
  body: string;
};

const demoSteps: DemoStep[] = [
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
    id: "gloo",
    label: "Gloo generation",
    eyebrow: "Gloo AI Studio API",
    title: "Faith-tuned AI shapes a Socratic discussion starter.",
    body:
      "The AI does not hand students a packaged answer. It classifies safety, frames the biblical tension, and drafts questions for leader review."
  },
  {
    id: "leader",
    label: "Leader review",
    eyebrow: "Human approval",
    title: "A leader edits, approves, or escalates before anything posts.",
    body:
      "Every generated discussion stays under ministry oversight, with audit history and clear escalation paths for pastoral-care concerns."
  },
  {
    id: "slack",
    label: "Slack discussion",
    eyebrow: "Community delivery",
    title: "The approved prompt lands where students already talk.",
    body:
      "Slack delivery creates a private, leader-moderated conversation space where Scripture becomes communal wrestling, not broadcast content."
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
  const [activeStepId, setActiveStepId] = useState<DemoStep["id"]>("student");
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
              A public view of Lead Emergence connecting Scripture, student questions, leader review, and community discussion.
            </p>
          </div>
          <div className="app-header-right">
            <span className="pill blue">YouVersion</span>
            <span className="pill green">Gloo AI Studio</span>
          </div>
        </header>

        <div className="app-content app-scroll-region">
          <section className="panel dashboard-orientation hackathon-overview" id="overview" aria-labelledby="hackathon-title">
            <div>
              <p className="eyebrow">Scripture in New Frontiers</p>
              <h2 className="title" id="hackathon-title">
                Scripture-native social discipleship for student ministry.
              </h2>
              <p className="muted">
                Lead Emergence turns hard student questions into leader-reviewed, Scripture-grounded community conversations
                without pulling students away from the digital spaces where they already talk.
              </p>
            </div>
            <div className="hackathon-overview-side">
              <div className="dashboard-actions">
                <a className="button primary" href="#demo-loop">
                  Watch the Loop
                </a>
                <a className="button" href="#technical-proof">
                  Technical Proof
                </a>
              </div>
              <div className="dashboard-list compact" aria-label="Demo promise">
                <div className="dashboard-list-item">
                  <strong>Student question</strong>
                  <span className="muted">Private by default, reviewed before discussion.</span>
                </div>
                <div className="dashboard-list-item">
                  <strong>Leader approval</strong>
                  <span className="muted">AI drafts stay under ministry oversight.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="hackathon-loop" id="demo-loop" aria-labelledby="demo-loop-title">
            <div className="hackathon-section-head">
              <p className="eyebrow">Product loop</p>
              <h2 className="section-title flush" id="demo-loop-title">
                One hard question, one guided conversation
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
                    <p className="eyebrow">Student question</p>
                    <h4>Why does God allow suffering if he is good?</h4>
                    <p>
                      Anonymous to students. Visible to approved leaders only. Pending review before discussion.
                    </p>
                    <span className="pill amber">Pending leader review</span>
                  </div>

                  <div className="hackathon-review-panel">
                    <div className="toolbar split">
                      <div>
                        <p className="eyebrow">Leader review package</p>
                        <h4>Romans 8 and the story of restoration</h4>
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
                    <p className="eyebrow">Private Slack post</p>
                    <strong>#hs-scripture-questions</strong>
                    <p>
                      Approved discussion starter posted with leader context, Scripture reference, and follow-up prompts.
                    </p>
                    <span className="pill blue">Delivery logged</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="hackathon-proof" id="technical-proof" aria-labelledby="technical-proof-title">
            <div className="hackathon-section-head">
              <p className="eyebrow">Technical proof</p>
              <h2 className="section-title flush" id="technical-proof-title">
                Built as a real platform path, not a video mock
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
                <span className="pill green">Gloo AI Studio</span>
                <h3>Faith-tuned generation is review-first</h3>
                <p>
                  The next provider adapter will produce structured safety, metanarrative framing, and Socratic prompts
                  for leader approval before delivery.
                </p>
              </article>
              <article className="card dashboard-card">
                <span className="pill amber">Slack</span>
                <h3>Community delivery is approved, then logged</h3>
                <p>
                  A fixed private demo channel receives only approved content, and each delivery records status for the
                  dashboard and final writeup.
                </p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
