import Link from "next/link";
import {
  CalendarDays,
  HeartHandshake,
  ListChecks,
  MessageSquareText,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardAttention } from "@/lib/dashboard-attention";
import type { MinistryOverview } from "@/lib/data/ministry-repository";

type MobileAttentionTone = "cyan" | "gold" | "green" | "red" | "violet";

type MobileAttentionCard = {
  detail: string;
  href: string;
  icon: LucideIcon;
  id: string;
  label: string;
  meta: string;
  tone: MobileAttentionTone;
  value: string;
};

export function MobileFieldDashboard({
  attention,
  overview
}: {
  attention: DashboardAttention | null;
  overview: MinistryOverview;
}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + 7);

  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const upcomingEvents = activeEvents
    .filter((event) => new Date(event.startTime) >= startOfToday)
    .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime());
  const todayEvents = upcomingEvents.filter((event) => {
    const start = new Date(event.startTime);
    return start >= startOfToday && start < startOfTomorrow;
  });
  const eventsThisWeek = upcomingEvents.filter((event) => new Date(event.startTime) < endOfWeek);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => new Date(task.dueDate) < startOfToday);
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const communicationReviewCount = upcomingEvents.filter((event) =>
    [event.contactOwnerId, event.location, event.targetGroup, event.description].some((value) => !value)
  ).length;
  const peopleFollowUps = attention?.people.length ?? 0;
  const nextEvent = upcomingEvents[0];

  const cards: MobileAttentionCard[] = [
    {
      id: "schedule",
      label: "Today's schedule",
      value: todayEvents.length ? `${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}` : "Clear",
      detail: todayEvents.length
        ? todayEvents.slice(0, 2).map((event) => event.title).join(" - ")
        : nextEvent
          ? `Next: ${nextEvent.title}`
          : "No upcoming events are scheduled.",
      meta: todayEvents.length
        ? formatEventTime(todayEvents[0].startTime)
        : nextEvent
          ? formatEventDate(nextEvent.startTime)
          : "Nothing waiting",
      href: "/events",
      icon: CalendarDays,
      tone: "cyan"
    },
    {
      id: "tasks",
      label: "Tasks",
      value: `${openTasks.length} open`,
      detail: overdueTasks.length || blockedTasks.length
        ? `${overdueTasks.length} overdue - ${blockedTasks.length} blocked`
        : "No overdue or blocked work.",
      meta: attention?.decisions.length ? `${attention.decisions.length} need review` : "Plan is moving",
      href: "/tasks",
      icon: ListChecks,
      tone: overdueTasks.length || blockedTasks.length ? "red" : "green"
    },
    {
      id: "people",
      label: "People",
      value: attention?.studentCare.available ? `${peopleFollowUps} follow-up${peopleFollowUps === 1 ? "" : "s"}` : "Care queue",
      detail: attention?.studentCare.available
        ? peopleFollowUps
          ? "Student-care signals are waiting for a leader."
          : "No student-care signals are waiting."
        : "Care signals are unavailable; Volunteer Hub remains available.",
      meta: peopleFollowUps ? "Human review required" : "Relationship first",
      href: peopleFollowUps ? "/discipleship" : "/people",
      icon: HeartHandshake,
      tone: peopleFollowUps ? "gold" : "green"
    },
    {
      id: "communications",
      label: "Communications",
      value: `${communicationReviewCount} to review`,
      detail: communicationReviewCount
        ? "Event previews are missing planning details."
        : "Upcoming event previews have their core details.",
      meta: "Human approval gates",
      href: "/communications",
      icon: MessageSquareText,
      tone: communicationReviewCount ? "gold" : "green"
    },
    {
      id: "readiness",
      label: "Upcoming events",
      value: `${eventsThisWeek.length} this week`,
      detail: attention?.eventReadiness.length
        ? `${attention.eventReadiness.length} upcoming plan${attention.eventReadiness.length === 1 ? "" : "s"} have readiness context.`
        : "No upcoming event readiness items.",
      meta: `${upcomingEvents.length} total upcoming`,
      href: "/events",
      icon: Users,
      tone: "violet"
    }
  ];

  return (
    <section className="mobile-field-dashboard" aria-labelledby="mobile-field-dashboard-title">
      <header className="mobile-field-dashboard-intro">
        <p className="eyebrow">Today</p>
        <h2 id="mobile-field-dashboard-title">What needs your attention?</h2>
        <p>Start with the next decision. Everything else can wait.</p>
      </header>
      <div className="mobile-attention-card-list">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link className={`mobile-attention-card tone-${card.tone}`} href={card.href} key={card.id}>
              <span className="mobile-attention-icon" aria-hidden="true"><Icon /></span>
              <span className="mobile-attention-copy">
                <span className="mobile-attention-label">{card.label}</span>
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
                <small>{card.meta}</small>
              </span>
              <span className="mobile-attention-safe-zone" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <section className="mobile-judge-path-card" aria-label="Competition review path">
        <p className="eyebrow">Competition review path</p>
        <h3>Inspect the platform story in order.</h3>
        <p>EMMA provider status, YouVersion reference handoff, Meridian/Gloo review, and human approval stay visible in the demo path.</p>
        <nav aria-label="Suggested judge stops">
          <Link href="/ministry">Ministry Alignment</Link>
          <Link href="/student/scripture/resources?reference=John%203%3A16">YouVersion Reader</Link>
          <Link href="/discipleship">Discipleship Review</Link>
        </nav>
      </section>
      <section className="mobile-ai-readiness-card" aria-label="Submission AI readiness">
        <span>EMMA</span>
        <strong>Provider badge reflects the signed-in production responder.</strong>
        <p>Public guest mode stays safe with read-only demo responses; AI drafts never send, write, or integrate without a leader approval step.</p>
      </section>
      <nav className="mobile-field-quick-actions" aria-label="Fast ministry actions">
        <Link href="/events">Events</Link>
        <Link href="/tasks">Tasks</Link>
        <Link href="/communications">Communications</Link>
        <Link href="/directors/volunteers">Volunteers</Link>
      </nav>
    </section>
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
