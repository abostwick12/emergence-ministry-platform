import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck2, CheckCircle2, HeartHandshake, MessageSquareText, UsersRound } from "lucide-react";
import { landingRoleEntries } from "@/lib/landing-video";

export const metadata: Metadata = {
  title: "Lead Emergence - Automated Platform",
  description: "A ministry operations platform that creates margin for ministry and helps leaders connect people to Jesus."
};

const proofPoints = [
  { icon: CalendarCheck2, label: "Plan with clarity", value: "events, budgets, owners, and timelines in one place" },
  { icon: CheckCircle2, label: "Follow through", value: "visible tasks instead of invisible mental load" },
  { icon: MessageSquareText, label: "Communicate carefully", value: "drafts and reviews before anything goes out" },
  { icon: UsersRound, label: "Care for people", value: "volunteers and students connected to next steps" }
];

const visionLanes = [
  "A home base for the weekly work that usually hides in texts, memory, and scattered spreadsheets.",
  "A ministry rhythm where leaders know what matters next before the week becomes urgent.",
  "A path from operational clarity to discipleship, so systems serve people instead of replacing them."
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
            Login
          </Link>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="eyebrow landing-eyebrow">Ministry operating system</p>
            <h1 id="landing-title">Creating space for ministry to flourish.</h1>
            <p>
              Lead Emergence is being built for the real pressure of ministry: the events, people, decisions, follow-up,
              communication, and preparation that all need care before Sunday ever arrives.
            </p>
            <div className="landing-hero-actions" aria-label="Primary role paths">
              <Link className="button primary landing-primary-action" href="/login?next=/dashboard">
                Login <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button landing-secondary-action" href="/api/auth/guest">
                Guest Access
              </Link>
            </div>
          </div>

          <section className="landing-vision-card" aria-label="Lead Emergence vision">
            <Image
              className="landing-announcement-art"
              src="/lead-emergence-announcement-transparent.png"
              alt="Lead Emergence Automated Platform: Creating space for ministry to flourish."
              width={1408}
              height={1115}
              priority
            />
            <div className="landing-vision-panel">
              <span><HeartHandshake size={18} aria-hidden="true" /> Built for ministry teams</span>
              <p>
                This is not another place to perform busyness. It is a shared operating space for the people who plan,
                lead, prepare, shepherd, and follow through together.
              </p>
            </div>
            <div className="landing-vision-lanes">
              {visionLanes.map((lane) => (
                <p key={lane}>{lane}</p>
              ))}
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
          <p className="eyebrow">Step into the right workspace</p>
          <h2 id="role-entry-title">One platform for the whole ministry rhythm.</h2>
          <p>Directors, volunteers, and students should not need the same screen. Each path keeps the work focused while access stays protected.</p>
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
