import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck2, CheckCircle2, LayoutDashboard, MessageSquareText, UsersRound } from "lucide-react";
import { landingRoleEntries, landingVideoScenes as landingWorkflowSteps } from "@/lib/landing-video";

export const metadata: Metadata = {
  title: "Lead Emergence - Automated Platform",
  description: "A ministry operations platform that creates margin for ministry and helps leaders connect people to Jesus."
};

const proofPoints = [
  { icon: CalendarCheck2, label: "Plan events", value: "from vision to workspace" },
  { icon: CheckCircle2, label: "Generate tasks", value: "with owners and due dates" },
  { icon: MessageSquareText, label: "Prepare communication", value: "reviewed before sending" },
  { icon: UsersRound, label: "Disciple students", value: "through leader-guided next steps" }
];

export default function RootPage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <nav className="landing-nav" aria-label="Public landing navigation">
          <Link className="brand-lead landing-brand" href="/" aria-label="Lead Emergence Automated Platform">
            <span>Lead</span> <em>Emergence</em>
            <small>AUTOMATED PLATFORM</small>
          </Link>
          <Link className="landing-nav-login" href="/login">
            Internal login
          </Link>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="eyebrow landing-eyebrow">Ministry operating system</p>
            <h1 id="landing-title">Create space for ministry. Connect people to Jesus.</h1>
            <p>
              Lead Emergence brings planning, tasks, communication prep, budget visibility, and discipleship workflows
              into one clear platform for ministry teams.
            </p>
            <div className="landing-hero-actions" aria-label="Primary role paths">
              <Link className="button primary landing-primary-action" href="/login?next=/dashboard">
                Ministry Director <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button landing-secondary-action" href="#role-entry">
                Choose your path
              </Link>
            </div>
          </div>

          <section className="landing-preview-card" aria-label="Lead Emergence platform preview">
            <div className="landing-preview-topline">
              <span><LayoutDashboard size={16} aria-hidden="true" /> Platform preview</span>
              <strong>Role-based workspace</strong>
            </div>
            <div className="landing-preview-panel">
              <div className="landing-product-frame" aria-hidden="true">
                <div className="landing-product-bar">
                  <span>Ministry Director View</span>
                  <strong>5 events this week</strong>
                </div>
                <div className="landing-product-grid">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="landing-product-row">
                  <b />
                  <b />
                  <b />
                </div>
              </div>
              <div className="landing-preview-steps">
                {landingWorkflowSteps.slice(0, 4).map((step) => (
                  <div className={`landing-preview-step accent-${step.accent}`} key={step.eyebrow}>
                    <span>{step.eyebrow}</span>
                    <div>
                      <strong>{step.productArea}</strong>
                      <p>{step.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="landing-proof" aria-label="Platform outcomes">
        {proofPoints.map(({ icon: Icon, label, value }) => (
          <article key={label}>
            <Icon size={22} aria-hidden="true" />
            <div>
              <strong>{label}</strong>
              <span>{value}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="landing-roles" id="role-entry" aria-labelledby="role-entry-title">
        <div className="landing-section-heading">
          <p className="eyebrow">Choose the right front door</p>
          <h2 id="role-entry-title">One platform, three clear entry paths.</h2>
          <p>Each path keeps people focused on the work they actually need to do. Existing auth still protects access.</p>
        </div>
        <div className="landing-role-grid">
          {landingRoleEntries.map((entry) => (
            <article className="landing-role-card" key={entry.audience}>
              <span>{entry.audience}</span>
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              <Link className="button landing-role-action" href={entry.href}>
                {entry.label} <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
