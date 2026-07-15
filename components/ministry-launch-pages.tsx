"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Mail,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, PageIntro } from "@/components/platform-ui";
import { PlanningCenterIntegrationControl } from "@/components/planning-center-integration-control";
import type { MinistryEmmaPage } from "@/lib/emma/ministry-page-assistant";
import type { ActiveTask, ActivityLog, EventExpense, MinistryEvent, User } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

type MinistryOverview = {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  activity: ActivityLog[];
};

type SettingsUser = {
  fullName?: string;
  email?: string;
  role?: string;
} | null;

type EmmaReadinessState =
  | { status: "loading" }
  | { status: "ready"; readiness: {
      liveProviderConfigured: boolean;
      provider: string;
      model: string;
      audit: string;
      status: "live" | "fallback";
      message: string;
    } }
  | { status: "error"; message: string };

const emptyOverview: MinistryOverview = {
  events: [],
  tasks: [],
  users: [],
  expenses: [],
  activity: []
};

const expenseCategories = [
  ["general", "General"],
  ["food", "Food"],
  ["supplies", "Supplies"],
  ["transportation", "Transportation"],
  ["curriculum", "Curriculum"],
  ["lodging", "Lodging"]
] as const;

export function MinistryCommunicationsPage() {
  return (
    <LaunchDataPage
      eyebrow="Communications"
      title="Communication Drafts"
      description="Preview what needs to be said, who owns it, and what is still missing before anything gets shared."
      emmaPage="communications"
    >
      {(overview) => <CommunicationsWorkspace overview={overview} />}
    </LaunchDataPage>
  );
}

export function MinistryPeoplePage() {
  return (
    <LaunchDataPage
      eyebrow="People"
      title="Ministry Roster"
      description="See who is carrying the work, where assignments are uncovered, and what belongs in student or parent spaces."
      emmaPage="people"
    >
      {(overview) => <PeopleWorkspace overview={overview} />}
    </LaunchDataPage>
  );
}

export function MinistryBudgetPage() {
  return (
    <LaunchDataPage
      eyebrow="Budget"
      title="Budget Workspace"
      description="Track event targets, recorded spend, and the next planning cost without connecting accounting yet."
      emmaPage="budget"
      showHero={false}
    >
      {(overview, refresh) => <BudgetWorkspace overview={overview} refresh={refresh} />}
    </LaunchDataPage>
  );
}

export function MinistrySettingsPage({ user }: { user: SettingsUser }) {
  return (
    <LaunchDataPage
      eyebrow="Settings"
      title="Platform Settings"
      description="Keep access, workflow boundaries, and integration readiness visible without exposing secrets."
      emmaPage="settings"
    >
      {(overview) => <SettingsWorkspace overview={overview} user={user} />}
    </LaunchDataPage>
  );
}

function LaunchDataPage({
  eyebrow,
  title,
  description,
  emmaPage,
  showHero = true,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  emmaPage: MinistryEmmaPage;
  showHero?: boolean;
  children: (overview: MinistryOverview, refresh: () => Promise<void>) => ReactNode;
}) {
  const [overview, setOverview] = useState<MinistryOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setError("");
    const response = await fetch("/api/events", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok) {
      throw new Error("Ministry overview could not be loaded.");
    }
    setOverview((await response.json()) as MinistryOverview);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadOverview()
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Ministry overview could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadOverview]);

  return (
    <section className="ministry-launch-page" aria-labelledby={`${eyebrow.toLowerCase()}-launch-title`}>
      {error ? (
        <div className="ministry-launch-alert" role="alert">
          {error}
          <button className="button compact" type="button" onClick={() => void loadOverview()}>
            Try again
          </button>
        </div>
      ) : null}

      {loading ? (
        <LaunchSkeleton />
      ) : (
        <>
          {!showHero ? (
            <h2 className="sr-only" id={`${eyebrow.toLowerCase()}-launch-title`}>
              {title}
            </h2>
          ) : null}
          {showHero ? (
            <PageIntro
              eyebrow={eyebrow}
              title={title}
              description={description}
              actions={<div className="ministry-launch-hero-actions" aria-label="Workspace status">
                <span className="pill blue">Live workspace</span>
                <span className="pill amber">Preview-only sending</span>
              </div>}
            />
          ) : null}
          {showHero ? (
            <EditorialSection eyebrow="Interpret" title="EMMA brief" description="A concise read of the current production workspace; expand only when you want to ask a follow-up.">
              <MinistryEmmaPanel page={emmaPage} overview={overview} />
            </EditorialSection>
          ) : (
            <MinistryEmmaPanel page={emmaPage} overview={overview} />
          )}
          {children(overview, loadOverview)}
        </>
      )}
    </section>
  );
}

function CommunicationsWorkspace({ overview }: { overview: MinistryOverview }) {
  const upcoming = useMemo(() => upcomingEvents(overview.events).slice(0, 6), [overview.events]);
  const missingOwner = upcoming.filter((event) => !event.contactOwnerId).length;
  const ready = upcoming.filter((event) => missingCommunicationFields(event).length === 0).length;
  const reviewNeeded = upcoming.length - ready;

  return (
    <div className="ministry-launch-grid">
      <LaunchMetric icon={<Mail aria-hidden="true" />} label="Ready previews" value={String(ready)} detail="Events with core copy fields filled" tone="cyan" />
      <LaunchMetric icon={<Bell aria-hidden="true" />} label="Needs review" value={String(reviewNeeded)} detail="Missing details before drafts are useful" tone="gold" />
      <LaunchMetric icon={<UsersRound aria-hidden="true" />} label="Owner gaps" value={String(missingOwner)} detail="Events without a communication owner" tone="violet" />

      <article className="ministry-launch-panel ministry-launch-span-2">
        <SectionHead eyebrow="Event Copy Queue" title="What needs attention before people hear about it" />
        <div className="ministry-launch-list">
          {upcoming.map((event) => {
            const missing = missingCommunicationFields(event);
            return (
              <LaunchRow
                key={event.id}
                icon={<MessageSquareText aria-hidden="true" />}
                title={event.title}
                meta={`${formatDate(event.startTime)} - ${ownerName(event.contactOwnerId, overview.users)}`}
                badge={missing.length ? `${missing.length} missing` : "Ready"}
                badgeTone={missing.length ? "amber" : "green"}
                href="/events"
              >
                {missing.length ? `Need ${missing.join(", ")} before previews are trustworthy.` : "Core event details are ready for preview generation."}
              </LaunchRow>
            );
          })}
        </div>
      </article>

      <article className="ministry-launch-panel">
        <SectionHead eyebrow="Channels" title="Preview surfaces" />
        <div className="ministry-launch-card-list">
          {["Parent email", "Leader update", "Text summary", "Briefing notes"].map((channel) => (
            <div className="ministry-launch-mini-card" key={channel}>
              <FileText aria-hidden="true" />
              <strong>{channel}</strong>
              <span>Generated from Master Event Card details. Sending stays off.</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function PeopleWorkspace({ overview }: { overview: MinistryOverview }) {
  const assignedTaskCounts = new Map<string, number>();
  overview.tasks.forEach((task) => assignedTaskCounts.set(task.assignedUserId, (assignedTaskCounts.get(task.assignedUserId) ?? 0) + 1));
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const unassignedTasks = openTasks.filter((task) => !overview.users.some((user) => user.id === task.assignedUserId));
  const owners = overview.users.filter((user) => user.role === "admin" || user.role === "leader");

  return (
    <div className="ministry-launch-grid">
      <LaunchMetric icon={<ShieldCheck aria-hidden="true" />} label="Staff accounts" value={String(owners.length)} detail="Admin and leader profiles in this workspace" tone="cyan" />
      <LaunchMetric icon={<Clock3 aria-hidden="true" />} label="Open tasks" value={String(openTasks.length)} detail="Assignments still moving" tone="gold" />
      <LaunchMetric icon={<UsersRound aria-hidden="true" />} label="Coverage gaps" value={String(unassignedTasks.length)} detail="Tasks without a known profile owner" tone="violet" />

      <article className="ministry-launch-panel ministry-launch-span-2">
        <SectionHead eyebrow="Team Load" title="Who is carrying active work" />
        <div className="ministry-launch-list">
          {owners.map((user) => (
            <LaunchRow
              key={user.id}
              icon={<UsersRound aria-hidden="true" />}
              title={displayName(user)}
              meta={`${user.role} - ${user.email}`}
              badge={`${assignedTaskCounts.get(user.id) ?? 0} tasks`}
              badgeTone={(assignedTaskCounts.get(user.id) ?? 0) > 4 ? "amber" : "blue"}
              href="/tasks"
            >
              {ownedEvents(user.id, overview.events).length
                ? `Owns ${ownedEvents(user.id, overview.events).slice(0, 2).join(", ")}.`
                : "No event ownership yet."}
            </LaunchRow>
          ))}
        </div>
      </article>

      <article className="ministry-launch-panel">
        <SectionHead eyebrow="Boundaries" title="Student and parent data" />
        <div className="ministry-launch-card-list">
          <Link className="ministry-launch-mini-card linked" href="/student">
            <BookOpen aria-hidden="true" />
            <strong>Student Portal</strong>
            <span>Students use the portal and journey tools instead of staff roster pages.</span>
          </Link>
          <div className="ministry-launch-mini-card">
            <UsersRound aria-hidden="true" />
            <strong>Planning Center future sync</strong>
            <span>Households and attendance remain outside this app until the provider boundary is approved.</span>
          </div>
        </div>
      </article>
    </div>
  );
}

function BudgetWorkspace({ overview, refresh }: { overview: MinistryOverview; refresh: () => Promise<void> }) {
  const [eventId, setEventId] = useState(overview.events[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<(typeof expenseCategories)[number][0]>("general");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const expenseFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!eventId && overview.events[0]?.id) setEventId(overview.events[0].id);
  }, [eventId, overview.events]);

  const totals = useMemo(() => {
    const target = overview.events.reduce((sum, event) => sum + Number(event.budgetTarget ?? 0), 0);
    const spent = overview.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    return { target, spent, remaining: target - spent };
  }, [overview.events, overview.expenses]);

  const categoryTotals = useMemo(() => {
    return expenseCategories.map(([id, label]) => {
      const spent = overview.expenses
        .filter((expense) => expense.categoryId === id)
        .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
      const planned = Math.max(
        spent,
        overview.events.reduce((sum, event) => sum + Number(event.budgetTarget ?? 0), 0) / expenseCategories.length
      );
      return { id, label, spent, planned };
    });
  }, [overview.events, overview.expenses]);

  const projectedYearEnd = totals.spent + Math.max(0, totals.remaining) * 0.18;

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/budget/expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, categoryId, amount: Number(amount), description })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Budget item could not be saved.");
      setSaving(false);
      return;
    }
    setAmount("");
    setDescription("");
    setMessage("Budget item saved.");
    await refresh();
    setSaving(false);
  }

  return (
    <div className="ministry-launch-grid ministry-budget-dashboard">
      <div className="ministry-budget-actions ministry-launch-span-3">
        <button
          className="button primary"
          type="button"
          onClick={() => setMessage("Receipt capture preview noted. No file was uploaded or stored.")}
        >
          <ReceiptText aria-hidden="true" />
          Capture receipt
        </button>
        <button className="button" type="button" onClick={() => expenseFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          + New expense
        </button>
        <button className="button budget-filter-chip" type="button" disabled aria-label="Budget period filter locked to this quarter">
          This quarter
        </button>
      </div>

      <LaunchMetric icon={<CircleDollarSign aria-hidden="true" />} label="Planned" value={money(totals.target)} detail="Budget targets across events" tone="cyan" />
      <LaunchMetric icon={<ReceiptText aria-hidden="true" />} label="Recorded" value={money(totals.spent)} detail="Actuals visible in this workspace" tone="gold" />
      <LaunchMetric icon={<Sparkles aria-hidden="true" />} label="Remaining" value={money(totals.remaining)} detail="Target minus recorded spend" tone={totals.remaining < 0 ? "violet" : "cyan"} />
      <LaunchMetric icon={<ArrowUpRight aria-hidden="true" />} label="Projected Year-End" value={money(projectedYearEnd)} detail={totals.remaining >= 0 ? "On pace" : "Over target"} tone={totals.remaining >= 0 ? "cyan" : "violet"} />

      <article className="ministry-launch-panel ministry-launch-span-3 ministry-budget-overview-panel">
        <div className="ministry-budget-overview-head">
          <SectionHead eyebrow="Overall" title="Where the money is going" />
          <strong>{money(totals.spent)} <span>of {money(totals.target)}</span></strong>
        </div>
        <div className="ministry-budget-track ministry-budget-overall-track" aria-label="Overall budget progress">
          <span style={{ width: `${totals.target ? Math.min(100, Math.round((totals.spent / totals.target) * 100)) : 0}%` }} />
        </div>
        <div className="ministry-budget-stack">
          {categoryTotals.map((category, index) => {
            const percent = category.planned ? Math.min(100, Math.round((category.spent / category.planned) * 100)) : 0;
            return (
              <div className={`ministry-budget-row budget-color-${index % 5}`} key={category.id}>
                <div>
                  <strong>{category.label}</strong>
                  <span>{money(category.spent)} / {money(category.planned)}</span>
                </div>
                <div className="ministry-budget-track" aria-label={`${category.label} budget progress`}>
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="ministry-launch-panel ministry-launch-span-2">
        <SectionHead eyebrow="Ledger" title="Recent expenses" />
        <div className="ministry-budget-search" aria-label="Expense search preview">
          Search vendor, category...
        </div>
        <div className="ministry-launch-list">
          {overview.expenses.length ? (
            overview.expenses.slice(0, 6).map((expense) => {
              const event = overview.events.find((item) => item.id === expense.eventId);
              const category = expenseCategories.find(([value]) => value === expense.categoryId)?.[1] ?? "General";
              return (
                <div className="ministry-budget-ledger-row" key={expense.id}>
                  <span>{formatDate(expense.timestamp)}</span>
                  <strong>{expense.description}</strong>
                  <span>{event?.title ?? "Event"}</span>
                  <span>{category}</span>
                  <strong>{money(expense.amount)}</strong>
                </div>
              );
            })
          ) : (
            <p className="muted">No expenses recorded yet.</p>
          )}
        </div>
      </article>

      <article className="ministry-launch-panel">
        <SectionHead eyebrow="Add Cost" title="Record a planning expense" />
        <form className="ministry-launch-form" ref={expenseFormRef} onSubmit={(submitEvent) => void submitExpense(submitEvent)}>
          <label className="field">
            <span>Event</span>
            <select className="input" value={eventId} onChange={(changeEvent) => setEventId(changeEvent.target.value)} required>
              {overview.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select className="input" value={categoryId} onChange={(changeEvent) => setCategoryId(changeEvent.target.value as typeof categoryId)}>
              {expenseCategories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount</span>
            <input className="input" type="number" min="1" step="1" value={amount} onChange={(changeEvent) => setAmount(changeEvent.target.value)} required />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea className="input" rows={3} value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} required />
          </label>
          {error ? <p className="ministry-launch-error">{error}</p> : null}
          {message ? <p className="ministry-launch-success">{message}</p> : null}
          <button className="button primary" type="submit" disabled={saving || !eventId}>
            {saving ? "Saving..." : "Save budget item"}
          </button>
        </form>
      </article>
    </div>
  );
}

function SettingsWorkspace({ overview, user }: { overview: MinistryOverview; user: SettingsUser }) {
  return (
    <div className="ministry-launch-grid settings-readiness-grid">
      <LaunchMetric icon={<ShieldCheck aria-hidden="true" />} label="Current role" value={(user?.role ?? "guest").toUpperCase()} detail={user?.fullName ?? "No active session profile"} tone="cyan" />
      <LaunchMetric icon={<CheckCircle2 aria-hidden="true" />} label="Active workflows" value={String(overview.events.length)} detail="Events currently available to operational pages" tone="gold" />
      <LaunchMetric icon={<UsersRound aria-hidden="true" />} label="Signed in as" value={user?.fullName?.split(" ")[0] ?? "Guest"} detail={user?.email ?? "No authenticated email"} tone="violet" />

      <article className="ministry-launch-panel ministry-launch-span-3 settings-readiness-panel">
        <SectionHead eyebrow="Connected services" title="Live readiness with real controls only" />
        <p className="settings-readiness-copy">Connect or review the services the platform can actually verify. Preview-only sends and protected provider boundaries remain descriptive, never disguised as launch buttons.</p>
        <div className="ministry-launch-setting-grid settings-readiness-controls">
          <PlanningCenterIntegrationControl />
          <EmmaReadinessSettingCard />
        </div>
      </article>
    </div>
  );
}
function EmmaReadinessSettingCard() {
  const [state, setState] = useState<EmmaReadinessState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/ai/emma", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          readiness?: Extract<EmmaReadinessState, { status: "ready" }>["readiness"];
          error?: string;
        };
        if (!active) return;
        if (!response.ok || payload.ok !== true || !payload.readiness) {
          setState({ status: "error", message: payload.error ?? "EMMA readiness could not be checked." });
          return;
        }
        setState({ status: "ready", readiness: payload.readiness });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "EMMA readiness could not be checked." });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return <SettingCard title="EMMA ministry chat" detail="Checking server-backed AI readiness..." state="Checking" />;
  }

  if (state.status === "error") {
    return <SettingCard title="EMMA ministry chat" detail={state.message} state="Needs setup" />;
  }

  return (
    <SettingCard
      title="EMMA ministry chat"
      detail={`${state.readiness.message} Audit: ${state.readiness.audit}. Model: ${state.readiness.model}.`}
      state={state.readiness.liveProviderConfigured ? "Live" : "Fallback"}
    />
  );
}

function LaunchMetric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: "cyan" | "gold" | "violet" }) {
  return (
    <article className={`ministry-launch-metric ${tone}`}>
      <span className="ministry-launch-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function LaunchRow({
  icon,
  title,
  meta,
  badge,
  badgeTone,
  href,
  children
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  badge: string;
  badgeTone: "blue" | "green" | "amber";
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="ministry-launch-row" href={href}>
      <span className="ministry-launch-row-icon">{icon}</span>
      <span className="ministry-launch-row-copy">
        <strong>{title}</strong>
        <small>{meta}</small>
        <span>{children}</span>
      </span>
      <span className={`pill ${badgeTone}`}>{badge}</span>
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="ministry-launch-section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
    </div>
  );
}

function SettingCard({ title, detail, state }: { title: string; detail: string; state: string }) {
  return (
    <div className="ministry-launch-setting-card">
      <strong>{title}</strong>
      <p>{detail}</p>
      <span className="pill">{state}</span>
    </div>
  );
}

function LaunchSkeleton() {
  return (
    <div className="ministry-launch-grid platform-route-loading" aria-busy="true" aria-label="Loading ministry workspace">
      <div className="platform-loading-panel ministry-launch-span-3">
        <div className="platform-loading-line title" />
        <div className="platform-loading-grid">
          <div className="platform-loading-block" />
          <div className="platform-loading-block" />
          <div className="platform-loading-block" />
        </div>
      </div>
    </div>
  );
}

function upcomingEvents(events: MinistryEvent[]) {
  const now = Date.now();
  return [...events].filter((event) => new Date(event.startTime).getTime() >= now).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function missingCommunicationFields(event: MinistryEvent) {
  return [
    !event.description ? "description" : "",
    !event.location ? "location" : "",
    !event.targetGroup ? "audience" : "",
    !event.contactOwnerId ? "owner" : ""
  ].filter(Boolean);
}

function ownerName(ownerId: string | undefined, users: User[]) {
  if (!ownerId) return "No owner";
  const owner = users.find((user) => user.id === ownerId);
  return owner ? displayName(owner) : "Unknown owner";
}

function displayName(user: User) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function ownedEvents(userId: string, events: MinistryEvent[]) {
  return events.filter((event) => event.contactOwnerId === userId).map((event) => event.title);
}
