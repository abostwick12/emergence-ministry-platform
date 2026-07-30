"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarClock,
  Database,
  Edit3,
  Gauge,
  HeartPulse,
  History,
  Link2,
  MessageSquareQuote,
  Network,
  Radar,
  RotateCcw,
  Save,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  X
} from "lucide-react";

import {
  DecisionMetricGrid,
  DecisionSignalList,
  EvidenceStack,
  JudgedIntegrationFlowList,
  LeadershipAttentionList,
  ResponsibilityVisibilityList
} from "@/components/decision-center";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, QuietState, StatusBadge, type PlatformTone } from "@/components/platform-ui";
import { buildMinistryDecisionCenterState } from "@/lib/decision-center/ministry";
import type { DecisionCenterState } from "@/lib/decision-center/types";
import type { MinistryOverview } from "@/lib/data/ministry-repository";
import {
  buildAlignmentContextSummary,
  defaultMinistryAlignmentProfile,
  MINISTRY_ALIGNMENT_CHAIN,
  MINISTRY_ALIGNMENT_STORAGE_KEY,
  normalizeMinistryAlignmentProfile,
  type MinistryAlignmentProfile
} from "@/lib/ministry/alignment";
import { buildMinistryMemoryDemo, type MinistryMemoryDemo as MinistryMemoryDemoState } from "@/lib/ministry/organizational-memory";

const ministryHubPrompts = [
  "What do our current signals say about this season?",
  "Where does the evidence support our Success Looks Like criteria?",
  "Where is the evidence mixed or incomplete?",
  "Are our events consistent with our mission?",
  "What responsibilities are keeping the ministry moving?",
  "What evidence should leadership review before making a change?",
  "How would adding another event affect our current season focus?",
  "Which signals are not currently visible enough to assess?"
] as const;

type MinistryLoadMapRow = {
  area: string;
  volunteerDemand: string;
  staffDemand: string;
  growthEvidence: string;
  risk: string;
  riskTone: PlatformTone;
};

export function MinistryAlignmentWorkspace({
  generatedAt,
  initialProfile,
  overview
}: {
  generatedAt: string;
  initialProfile: MinistryAlignmentProfile;
  overview: MinistryOverview;
}) {
  const [profile, setProfile] = useState(() => normalizeMinistryAlignmentProfile(initialProfile));
  const [editOpen, setEditOpen] = useState(false);
  const center = useMemo(
    () => buildMinistryDecisionCenterState(overview, new Date(generatedAt), profile),
    [generatedAt, overview, profile]
  );
  const memory = useMemo(
    () => buildMinistryMemoryDemo(overview, new Date(generatedAt)),
    [generatedAt, overview]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MINISTRY_ALIGNMENT_STORAGE_KEY);
      if (raw) setProfile(normalizeMinistryAlignmentProfile(JSON.parse(raw)));
    } catch {
      setProfile(normalizeMinistryAlignmentProfile(initialProfile));
    }
  }, [initialProfile]);

  function saveProfile(nextProfile: MinistryAlignmentProfile) {
    const normalized = normalizeMinistryAlignmentProfile({
      ...nextProfile,
      lastUpdated: new Date().toISOString().slice(0, 10)
    });
    setProfile(normalized);
    try {
      window.localStorage.setItem(MINISTRY_ALIGNMENT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Local persistence is a convenience boundary for the competition demo.
    }
  }

  function resetProfile() {
    setProfile(defaultMinistryAlignmentProfile);
    try {
      window.localStorage.removeItem(MINISTRY_ALIGNMENT_STORAGE_KEY);
    } catch {
      // Nothing else needs to happen if local storage is unavailable.
    }
  }

  return (
    <>
      <section className="ministry-model-primer" aria-label="Ministry Hub operating model">
        <p>This page runs on four things working together:</p>
        <p><strong>Alignment</strong> is what leadership has said matters. <strong>Memory</strong> is what this ministry has learned over time. <strong>Signals</strong> are what is observable right now. <strong>EMMA</strong> compares them and names where the evidence is clear, mixed, or not enough to say.</p>
      </section>

      <EditorialSection
        eyebrow="Leadership-authored context"
        title="Ministry Alignment"
        description="Compare observable ministry life with the Vision, Mission, Values, Current Season, and Success Looks Like statements leaders have named."
      >
        <MinistryAlignmentPanel profile={profile} onEdit={() => setEditOpen(true)} onReset={resetProfile} />
      </EditorialSection>

      <MinistryEmmaPanel
        alignmentProfile={profile}
        overview={overview}
        page="dashboard"
        presentation="floating"
        title="Ask EMMA"
        promptTemplates={ministryHubPrompts}
        staticSignals={[
          ...buildAlignmentContextSummary(profile),
          ...center.signals.map((signal) => `${signal.title}: ${signal.summary}`)
        ]}
      />

      <EditorialSection
        eyebrow="Current Ministry Signals"
        title="What is changing that leadership may not have noticed?"
        description={`Signals are factual observations for ${center.direction.emphasis}. They surface evidence, boundaries, and patterns without telling leaders what decision to make.`}
      >
        <MinistrySignalsOverview center={center} overview={overview} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Organizational health"
        title="Signal categories"
        description="The engine groups visible ministry life into health, staff capacity, volunteer capacity, alignment, and sustainability signals."
      >
        <MinistrySignalCategoryGrid center={center} overview={overview} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Organizational pattern detection"
        title="Patterns worth noticing"
        description="Patterns are observations about ministry shape over time. They are not verdicts about people, faithfulness, or calling."
      >
        <MinistryPatternDetection center={center} overview={overview} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Capacity forecasting"
        title="Likely future pressure"
        description="Forecasts describe where the current visible trajectory could create pressure if nothing changes."
      >
        <MinistryCapacityForecasts center={center} overview={overview} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Evidence"
        title="What EMMA is allowed to consider"
        description="Evidence stays visible by default so leadership can inspect sources before acting."
      >
        <DecisionSignalList signals={center.signals} />
        <EvidenceStack signals={center.signals} />
        <details className="provider-path-disclosure">
          <summary>Provider path and judged Scripture flow</summary>
          <JudgedIntegrationFlowList flows={center.judgedIntegrationFlows} />
        </details>
      </EditorialSection>

      <EditorialSection
        eyebrow="Leadership Attention"
        title="Questions for discernment"
        description="These are advisory prompts for discussion, not autonomous priorities."
      >
        <LeadershipAttentionList items={center.attention} />
      </EditorialSection>

      <EditorialSection
        eyebrow="Responsibility Visibility"
        title="Existing ownership signals"
        description="This view reuses event owners and task assignees only. It does not infer burnout, capacity, performance, or staffing need."
      >
        <ResponsibilityVisibilityList items={center.responsibility} />
      </EditorialSection>

      <details className="alignment-model-disclosure">
        <summary>Canonical alignment chain</summary>
        <ol>
          {MINISTRY_ALIGNMENT_CHAIN.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <QuietState title="Scoring intentionally deferred">
          No weighted rubric, percentage status, or autonomous ministry priority engine has been approved for this phase.
        </QuietState>
      </details>

      <EditorialSection
        eyebrow="Public demo memory"
        title="Organizational memory at your fingertips"
        description="Guest mode uses seeded public demo history to model what Planning Center, calendars, files, decks, budgets, and debriefs could surface after real integrations are connected."
        accent="gold"
      >
        <MinistryMemoryDemo memory={memory} />
      </EditorialSection>

      {editOpen ? (
        <AlignmentEditorDialog
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSave={(nextProfile) => {
            saveProfile(nextProfile);
            setEditOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function MinistrySignalsOverview({ center, overview }: { center: DecisionCenterState; overview: MinistryOverview }) {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const guestAnalytics = overview.guestAnalytics;

  return (
    <div className="ministry-signals-overview">
      <article className="ministry-signals-hero-card">
        <div>
          <p className="eyebrow">Signal engine</p>
          <h3>Helping leaders notice drift before it becomes crisis.</h3>
          <p>
            Ministry Signals are observations, not recommendations. They connect visible ministry records to leadership-authored context so leaders can ask better questions before pressure becomes obvious.
          </p>
        </div>
        <div className="ministry-signals-hero-facts" aria-label="Ministry signal posture">
          <span><Radar aria-hidden="true" /> Observable evidence</span>
          <span><ShieldCheck aria-hidden="true" /> No spiritual verdicts</span>
          <span><Brain aria-hidden="true" /> Discernment support</span>
        </div>
      </article>

      <DecisionMetricGrid metrics={center.metrics} />

      <div className="ministry-signals-now-grid" aria-label="Current signal snapshot">
        <SignalNowCard
          icon={<Activity aria-hidden="true" />}
          label="Visible ministry life"
          value={guestAnalytics ? `${guestAnalytics.studentCount} students` : `${activeEvents.length} active plan${activeEvents.length === 1 ? "" : "s"}`}
          detail={guestAnalytics
            ? `${guestAnalytics.staffCount} staff, ${guestAnalytics.volunteerCount} adult volunteers (${guestAnalytics.volunteerGenderDistribution.male} men / ${guestAnalytics.volunteerGenderDistribution.female} women), ${guestAnalytics.smallGroupCount} small groups.`
            : `${center.signals.length} current signal${center.signals.length === 1 ? "" : "s"} can be inspected with source evidence.`}
        />
        <SignalNowCard
          icon={<AlertTriangle aria-hidden="true" />}
          label="Pressure markers"
          value={blockedTasks.length ? `${blockedTasks.length} blocked` : "No blocked tasks"}
          detail={blockedTasks.length ? "Blocked work is treated as an observable constraint, not a judgment on a person." : "Open work exists, but no task is currently marked blocked."}
        />
        <SignalNowCard
          icon={<CalendarClock aria-hidden="true" />}
          label="Decision horizon"
          value={center.direction.horizon}
          detail={`${center.direction.owner} owns the current season review posture.`}
        />
        {guestAnalytics ? (
          <SignalNowCard
            icon={<TrendingUp aria-hidden="true" />}
            label="Guest trend window"
            value={`${guestAnalytics.historyMonths} months`}
            detail={`Friday events are planned through ${formatDateOnly(guestAnalytics.plannedThroughDate)}; 2025 attendance records show event growth and Sunday decline.`}
          />
        ) : null}
      </div>
    </div>
  );
}

function MinistrySignalCategoryGrid({ center, overview }: { center: DecisionCenterState; overview: MinistryOverview }) {
  const categories = buildSignalCategories(center, overview);

  return (
    <div className="ministry-signal-category-grid">
      {categories.map((category) => (
        <article className={`ministry-signal-category-card tone-${category.tone}`} key={category.title}>
          <div className="ministry-signal-category-icon" aria-hidden="true">{category.icon}</div>
          <div>
            <p className="eyebrow">{category.question}</p>
            <h3>{category.title}</h3>
            <p>{category.observation}</p>
          </div>
          <dl>
            <div>
              <dt>Visible evidence</dt>
              <dd>{category.evidence}</dd>
            </div>
            <div>
              <dt>Boundary</dt>
              <dd>{category.boundary}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function MinistryPatternDetection({ center, overview }: { center: DecisionCenterState; overview: MinistryOverview }) {
  const patterns = buildPatternDetections(center, overview);
  const loadRows = buildLoadMapRows(overview, center);

  return (
    <div className="ministry-pattern-layout">
      <div className="ministry-pattern-grid">
        {patterns.map((pattern) => (
          <article className={`ministry-pattern-card status-${pattern.status}`} key={pattern.title}>
            <span>{pattern.statusLabel}</span>
            <h3>{pattern.title}</h3>
            <p>{pattern.detail}</p>
            <small>{pattern.evidence}</small>
          </article>
        ))}
      </div>

      <article className="ministry-load-map" aria-label="Ministry load mapping">
        <header>
          <p className="eyebrow">Ministry load mapping</p>
          <h3>Where effort is concentrating</h3>
        </header>
        <div className="ministry-load-map-table">
          <div className="ministry-load-map-head">
            <span>Area</span>
            <span>Volunteer demand</span>
            <span>Staff demand</span>
            <span>Growth evidence</span>
            <span>Risk</span>
          </div>
          {loadRows.map((row) => (
            <div className="ministry-load-map-row" key={row.area}>
              <strong>{row.area}</strong>
              <span>{row.volunteerDemand}</span>
              <span>{row.staffDemand}</span>
              <span>{row.growthEvidence}</span>
              <StatusBadge tone={row.riskTone}>{row.risk}</StatusBadge>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function MinistryCapacityForecasts({ center, overview }: { center: DecisionCenterState; overview: MinistryOverview }) {
  const forecasts = buildCapacityForecasts(center, overview);

  return (
    <div className="ministry-forecast-grid">
      {forecasts.map((forecast) => (
        <article className={`ministry-forecast-card tone-${forecast.tone}`} key={forecast.title}>
          <div className="ministry-forecast-top">
            <span>{forecast.horizon}</span>
            {forecast.icon}
          </div>
          <h3>{forecast.title}</h3>
          <p>{forecast.detail}</p>
          <dl>
            <div>
              <dt>Evidence</dt>
              <dd>{forecast.evidence}</dd>
            </div>
            <div>
              <dt>Interpretation limit</dt>
              <dd>{forecast.boundary}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function SignalNowCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: string }) {
  return (
    <article className="ministry-signal-now-card">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p className="eyebrow">{label}</p>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function buildSignalCategories(center: DecisionCenterState, overview: MinistryOverview) {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const ownerGaps = activeEvents.filter((event) => !event.contactOwnerId).length;
  const volunteersNeeded = activeEvents.reduce((total, event) => total + Number(event.volunteersNeeded ?? 0), 0);
  const concentratedAreas = center.responsibility.filter((item) => item.status === "concentrated ownership").length;
  const sharedAreas = center.responsibility.filter((item) => item.status === "shared ownership").length;

  return [
    {
      title: "Ministry Health Signals",
      question: "Is our ministry becoming healthier?",
      observation: center.signals.length
        ? "Momentum can be reviewed through the current event, task, budget, and Scripture-path signals."
        : "The engine is waiting for enough current ministry records to make health observations visible.",
      evidence: `${activeEvents.length} active event records and ${center.signals.length} inspected signal definitions.`,
      boundary: "Does not declare spiritual health or faithfulness.",
      icon: <HeartPulse aria-hidden="true" />,
      tone: "cyan"
    },
    {
      title: "Staff Capacity Signals",
      question: "Are we building a sustainable ministry staff?",
      observation: concentratedAreas || ownerGaps
        ? "Responsibility concentration and ownership gaps are visible enough to review."
        : "Visible responsibility is currently distributed or assigned in the available records.",
      evidence: `${concentratedAreas} concentrated area${concentratedAreas === 1 ? "" : "s"}; ${ownerGaps} active ownership gap${ownerGaps === 1 ? "" : "s"}.`,
      boundary: "Does not diagnose burnout, effort, motivation, or performance.",
      icon: <Gauge aria-hidden="true" />,
      tone: concentratedAreas || ownerGaps ? "gold" : "green"
    },
    {
      title: "Volunteer Capacity Signals",
      question: "Are we caring for the people caring for students?",
      observation: overview.guestAnalytics
        ? "Guest mode separates the 3 staff members from the 20 adult volunteers so serving load can be inspected clearly."
        : volunteersNeeded
        ? "Volunteer demand is visible on event records and can be compared against ownership and readiness."
        : "Volunteer demand fields are not yet strong enough for a serving-frequency signal.",
      evidence: overview.guestAnalytics
        ? `${overview.guestAnalytics.volunteerCount} adult volunteers: ${overview.guestAnalytics.volunteerGenderDistribution.male} men and ${overview.guestAnalytics.volunteerGenderDistribution.female} women.`
        : `${volunteersNeeded} visible volunteer slot${volunteersNeeded === 1 ? "" : "s"} across active plans.`,
      boundary: "Measures stewardship signals, not volunteer productivity.",
      icon: <UsersRound aria-hidden="true" />,
      tone: volunteersNeeded ? "cyan" : "neutral"
    },
    {
      title: "Alignment Signals",
      question: "Are daily practices reflecting stated priorities?",
      observation: `Current observations are compared against "${center.direction.emphasis}" before EMMA answers.`,
      evidence: `${center.alignmentProfile.successLooksLike.length} Success Looks Like criteria and ${center.signals.length} current signal${center.signals.length === 1 ? "" : "s"}.`,
      boundary: "No weighted verdict, percentage status, or automatic priority ranking is produced.",
      icon: <Network aria-hidden="true" />,
      tone: "cyan"
    },
    {
      title: "Sustainability Signals",
      question: "Can this ministry continue operating this way?",
      observation: blockedTasks.length || sharedAreas === 0
        ? "The current snapshot has sustainability markers worth reviewing before adding more activity."
        : "Shared ownership and task flow currently provide a healthier operating signal.",
      evidence: `${blockedTasks.length} blocked task${blockedTasks.length === 1 ? "" : "s"}; ${sharedAreas} shared ownership area${sharedAreas === 1 ? "" : "s"}.`,
      boundary: "Surfaces resilience evidence without recommending hiring, firing, or discipline.",
      icon: <BarChart3 aria-hidden="true" />,
      tone: blockedTasks.length ? "gold" : "green"
    }
  ] as const;
}

function buildPatternDetections(center: DecisionCenterState, overview: MinistryOverview) {
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const ownerGaps = activeEvents.filter((event) => !event.contactOwnerId).length;
  const readinessSignals = center.signals.filter((signal) => /readiness|communication|owner/i.test(signal.id));
  const concentratedAreas = center.responsibility.filter((item) => item.status === "concentrated ownership");
  const sharedAreas = center.responsibility.filter((item) => item.status === "shared ownership");

  return [
    {
      title: "Decision bottlenecks",
      detail: blockedTasks.length || ownerGaps
        ? "Some work cannot move cleanly until an owner or blocker is resolved."
        : "No explicit blocker is visible in current task and event records.",
      evidence: `${blockedTasks.length} blocked task${blockedTasks.length === 1 ? "" : "s"}; ${ownerGaps} communication ownership gap${ownerGaps === 1 ? "" : "s"}.`,
      status: blockedTasks.length || ownerGaps ? "watch" : "monitor",
      statusLabel: blockedTasks.length || ownerGaps ? "Watch" : "Monitor"
    },
    {
      title: "Increasing centralization",
      detail: concentratedAreas.length
        ? "Responsibility appears concentrated in at least one visible ministry area."
        : "The available responsibility view does not show a single-person concentration pattern.",
      evidence: concentratedAreas.length ? concentratedAreas.map((item) => item.area).join(", ") : "No concentrated ownership status in the current snapshot.",
      status: concentratedAreas.length ? "review" : "monitor",
      statusLabel: concentratedAreas.length ? "Review" : "Monitor"
    },
    {
      title: "Reactive planning",
      detail: readinessSignals.length
        ? "Readiness and ownership gaps are appearing close enough to current planning that they deserve attention."
        : "No readiness signal is foregrounded right now.",
      evidence: `${readinessSignals.length} readiness-related signal${readinessSignals.length === 1 ? "" : "s"} in the current decision center.`,
      status: readinessSignals.length ? "watch" : "monitor",
      statusLabel: readinessSignals.length ? "Watch" : "Monitor"
    },
    {
      title: "Distributed leadership",
      detail: sharedAreas.length
        ? "Multiple ministry areas show shared ownership in visible records."
        : "Shared ownership is not yet visible enough to treat as a healthy pattern.",
      evidence: sharedAreas.length ? sharedAreas.map((item) => item.area).join(", ") : "No shared ownership area in the current snapshot.",
      status: sharedAreas.length ? "healthy" : "monitor",
      statusLabel: sharedAreas.length ? "Healthy signal" : "Monitor"
    }
  ] as const;
}

function buildLoadMapRows(overview: MinistryOverview, center: DecisionCenterState): MinistryLoadMapRow[] {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const guestAnalytics = overview.guestAnalytics;
  const rows = [
    { area: "High School Ministry", matcher: /high_school_event/ },
    { area: "Middle School Ministry", matcher: /middle_school_event/ },
    { area: "Small Groups", matcher: /small_group_gathering/ },
    { area: "Retreats and Serve Days", matcher: /conference|missions_trip/ }
  ];

  const mappedRows: MinistryLoadMapRow[] = rows.map((row) => {
    const events = activeEvents.filter((event) => row.matcher.test(event.type));
    const eventIds = new Set(events.map((event) => event.id));
    const tasks = openTasks.filter((task) => eventIds.has(task.eventId));
    const volunteerDemand = events.reduce((total, event) => total + Number(event.volunteersNeeded ?? 0), 0);
    const highRisk = tasks.some((task) => task.status === "blocked") || events.some((event) => !event.contactOwnerId);

    return {
      area: row.area,
      volunteerDemand: volunteerDemand ? loadLabel(volunteerDemand, 3, 8) : "Not visible",
      staffDemand: tasks.length ? loadLabel(tasks.length, 4, 10) : "Low",
      growthEvidence: guestAnalytics ? guestGrowthEvidence(row.area, guestAnalytics) : "Attendance trend not connected",
      risk: highRisk ? "Increasing" : events.length ? "Stable" : "Low evidence",
      riskTone: highRisk ? "warning" : events.length ? "success" : "neutral"
    };
  });

  const seasonRow: MinistryLoadMapRow = {
    area: center.direction.emphasis,
    volunteerDemand: "Contextual",
    staffDemand: center.responsibility.some((item) => item.status === "concentrated ownership") ? "Concentrated" : "Distributed",
    growthEvidence: "Compared to current season",
    risk: center.signals.some((signal) => signal.tone === "critical" || signal.tone === "warning") ? "Watch" : "Monitor",
    riskTone: center.signals.some((signal) => signal.tone === "critical" || signal.tone === "warning") ? "gold" : "info"
  };

  return [...mappedRows, seasonRow];
}

function buildCapacityForecasts(center: DecisionCenterState, overview: MinistryOverview) {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const volunteersNeeded = activeEvents.reduce((total, event) => total + Number(event.volunteersNeeded ?? 0), 0);
  const ownershipGaps = activeEvents.filter((event) => !event.contactOwnerId).length;
  const guestAnalytics = overview.guestAnalytics;

  return [
    {
      title: "Leader coverage could become the next constraint",
      horizon: "Next planning window",
      detail: guestAnalytics
        ? `${guestAnalytics.growingGroup.name} is approaching split pressure while ${guestAnalytics.volunteerWorkload.overusedVolunteerNames.join(" and ")} carry the heaviest serving rhythm.`
        : volunteersNeeded
        ? "Visible event plans already name leader or volunteer demand, so coverage should stay part of discernment before additional activity is added."
        : "The forecast cannot assess leader coverage until volunteer demand and attendance signals are connected.",
      evidence: guestAnalytics
        ? `${guestAnalytics.studentCount} students, ${guestAnalytics.smallGroupCount} groups, ${guestAnalytics.volunteerCount} adult volunteers; ${guestAnalytics.volunteerWorkload.underusedVolunteerIds.length} volunteers are underused.`
        : `${volunteersNeeded} visible volunteer slot${volunteersNeeded === 1 ? "" : "s"} across ${activeEvents.length} active plan${activeEvents.length === 1 ? "" : "s"}.`,
      boundary: "Does not decide whether to recruit, split groups, or change programs.",
      icon: <UsersRound aria-hidden="true" />,
      tone: volunteersNeeded ? "cyan" : "neutral"
    },
    {
      title: "Blocked work may compound if the queue keeps growing",
      horizon: center.direction.horizon,
      detail: blockedTasks.length
        ? "Blocked tasks are a near-term operational signal because unfinished work can compress review, communication, and follow-up time."
        : "The task queue has no explicit blocked status, but open work still remains part of sustainability review.",
      evidence: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}; ${blockedTasks.length} blocked.`,
      boundary: "Does not infer effort, capacity, or emotional state from task count.",
      icon: <TrendingUp aria-hidden="true" />,
      tone: blockedTasks.length ? "gold" : "green"
    },
    {
      title: "Ownership gaps can turn plans into single points of failure",
      horizon: "Before public communication",
      detail: ownershipGaps
        ? "Events without communication ownership are early signals of potential dependency or late decision pressure."
        : "Current active plans have communication ownership visible.",
      evidence: `${ownershipGaps} active event${ownershipGaps === 1 ? "" : "s"} without communication ownership.`,
      boundary: "Surfaces field-level gaps only; it does not evaluate a leader.",
      icon: <Network aria-hidden="true" />,
      tone: ownershipGaps ? "gold" : "green"
    }
  ] as const;
}

function loadLabel(value: number, mediumAt: number, highAt: number) {
  if (value >= highAt) return "High";
  if (value >= mediumAt) return "Moderate";
  return "Low";
}

function guestGrowthEvidence(area: string, analytics: NonNullable<MinistryOverview["guestAnalytics"]>) {
  if (area === "Small Groups") {
    return `${analytics.growingGroup.name} grew ${analytics.growingGroup.weeklyCounts[0]} to ${analytics.growingGroup.weeklyCounts.at(-1)} students.`;
  }
  if (area === "Retreats and Serve Days") {
    return `Friday event attendance rose ${Math.round(analytics.specialEventAttendanceFirstQuarter)} to ${Math.round(analytics.specialEventAttendanceLastQuarter)}.`;
  }
  if (area === "Middle School Ministry") {
    return `${analytics.middleSchoolStudentCount} students; Sunday trend is declining.`;
  }
  if (area === "High School Ministry") {
    return `${analytics.highSchoolStudentCount} students; Friday events remain planned through December.`;
  }
  return "Compared to guest attendance records";
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MinistryMemoryDemo({ memory }: { memory: MinistryMemoryDemoState }) {
  return (
    <section className="ministry-memory-demo" aria-label="Public demo organizational memory">
      <div className="ministry-memory-hero">
        <div>
          <p className="eyebrow">Seeded public data</p>
          <h3>{memory.yearSpanLabel} ministry history, modeled for discernment</h3>
          <p>
            The records below are intentionally modeled for public review, but the pattern is real: repeated ministry rhythms can become a searchable memory
            for better timing, stronger ownership, and more sustainable decisions.
          </p>
        </div>
        <StatusBadge tone="warning">Demo data, no live sync</StatusBadge>
      </div>

      <dl className="ministry-memory-stats">
        <div>
          <History aria-hidden="true" />
          <dt>Archived events</dt>
          <dd>{memory.historicalEventCount}</dd>
        </div>
        <div>
          <Database aria-hidden="true" />
          <dt>Total memory records</dt>
          <dd>{memory.recordCount}</dd>
        </div>
        <div>
          <Link2 aria-hidden="true" />
          <dt>Modeled source signals</dt>
          <dd>{memory.stubSourceCount}</dd>
        </div>
        <div>
          <MessageSquareQuote aria-hidden="true" />
          <dt>Active plans</dt>
          <dd>{memory.currentEventCount}</dd>
        </div>
      </dl>

      <div className="ministry-memory-layout">
        <div className="ministry-memory-column">
          <header className="ministry-memory-subhead">
            <span>Decision patterns</span>
            <strong>{memory.eventFamilyCount} repeated rhythms detected</strong>
          </header>
          <div className="ministry-memory-insights">
            {memory.insights.map((insight) => (
              <article className={`ministry-memory-insight tone-${insight.tone}`} key={insight.title}>
                <span>{insight.evidence}</span>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="ministry-memory-column">
          <header className="ministry-memory-subhead">
            <span>Modeled sources</span>
            <strong>Ready to demo, clearly not live</strong>
          </header>
          <ul className="ministry-memory-sources">
            {memory.sources.map((source) => (
              <li key={source.label}>
                <strong>{source.label}</strong>
                <p>{source.detail}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="ministry-memory-prompt-bank" aria-label="Organizational memory EMMA prompts">
        <span>Try asking EMMA</span>
        <div>
          {memory.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
        </div>
      </div>
    </section>
  );
}

function MinistryAlignmentPanel({
  onEdit,
  onReset,
  profile
}: {
  onEdit: () => void;
  onReset: () => void;
  profile: MinistryAlignmentProfile;
}) {
  return (
    <article className="ministry-alignment-panel" aria-label="Ministry Alignment">
      <header className="ministry-alignment-header">
        <div>
          <p className="eyebrow">Current Season</p>
          <h3>{profile.currentSeason.title}</h3>
          <p>{profile.currentSeason.description}</p>
        </div>
        <div className="ministry-alignment-actions">
          <StatusBadge tone="success">{profile.currentSeason.status}</StatusBadge>
          <button className="button compact-button" type="button" onClick={onEdit}>
            <Edit3 aria-hidden="true" />
            Edit
          </button>
          <button className="button ghost compact-button" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="ministry-alignment-statement-row" aria-label="Vision and mission">
        <AlignmentBlock label="Vision" text={profile.vision} variant="quote" />
        <AlignmentBlock label="Mission" text={profile.mission} variant="quote" />
      </div>

      <div className="ministry-alignment-grid">
        <div className="ministry-alignment-block ministry-alignment-list-card">
          <span>Values</span>
          <ul>
            {profile.values.map((value) => (
              <li key={value.id}>
                <strong>{value.title}</strong>
                <p>{value.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="ministry-alignment-block ministry-alignment-list-card ministry-alignment-success-card">
          <span>Success Looks Like</span>
          <ul>
            {profile.successLooksLike.map((criterion) => <li key={criterion}>{criterion}</li>)}
          </ul>
        </div>
      </div>

      <dl className="ministry-alignment-meta">
        <div>
          <dt>Owner</dt>
          <dd>{profile.owner}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{profile.lastUpdated}</dd>
        </div>
        <div>
          <dt>Review date</dt>
          <dd>{profile.reviewDate ?? profile.currentSeason.reviewDate ?? "Not set"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AlignmentBlock({ label, text, variant = "default" }: { label: string; text: string; variant?: "default" | "quote" }) {
  return (
    <div className={variant === "quote" ? "ministry-alignment-block ministry-alignment-quote-block" : "ministry-alignment-block"}>
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}

function AlignmentEditorDialog({
  onClose,
  onSave,
  profile
}: {
  onClose: () => void;
  onSave: (profile: MinistryAlignmentProfile) => void;
  profile: MinistryAlignmentProfile;
}) {
  const [draft, setDraft] = useState(() => normalizeMinistryAlignmentProfile(profile));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div className="alignment-editor-backdrop">
      <form className="alignment-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="alignment-editor-title" onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">Leadership-authored</p>
            <h3 id="alignment-editor-title">Edit Ministry Alignment</h3>
          </div>
          <button className="icon-button" type="button" aria-label="Close alignment editor" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="alignment-editor-grid">
          <label className="field">
            <span>Vision</span>
            <textarea className="input" rows={3} value={draft.vision} onChange={(event) => setDraft({ ...draft, vision: event.target.value })} />
          </label>
          <label className="field">
            <span>Mission</span>
            <textarea className="input" rows={3} value={draft.mission} onChange={(event) => setDraft({ ...draft, mission: event.target.value })} />
          </label>
          <label className="field">
            <span>Current Season</span>
            <input className="input" value={draft.currentSeason.title} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, title: event.target.value } })} />
          </label>
          <label className="field">
            <span>Season owner</span>
            <input className="input" value={draft.currentSeason.owner} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, owner: event.target.value }, owner: event.target.value })} />
          </label>
          <label className="field wide">
            <span>Season description</span>
            <textarea className="input" rows={3} value={draft.currentSeason.description} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, description: event.target.value } })} />
          </label>
          <label className="field">
            <span>Start date</span>
            <input className="input" type="date" value={draft.currentSeason.startDate} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, startDate: event.target.value } })} />
          </label>
          <label className="field">
            <span>Review date</span>
            <input className="input" type="date" value={draft.currentSeason.reviewDate ?? ""} onChange={(event) => setDraft({ ...draft, currentSeason: { ...draft.currentSeason, reviewDate: event.target.value || null }, reviewDate: event.target.value || null })} />
          </label>
        </div>

        <EditableList
          label="Values"
          addLabel="Add value"
          items={draft.values.map((value) => ({ id: value.id, title: value.title, body: value.description }))}
          onChange={(items) => setDraft({
            ...draft,
            values: items.map((item, index) => ({ id: item.id, title: item.title, description: item.body, displayOrder: index + 1 }))
          })}
        />

        <EditableList
          label="Success Looks Like"
          addLabel="Add success criterion"
          bodyOnly
          items={draft.successLooksLike.map((criterion, index) => ({ id: `success-${index}`, title: "", body: criterion }))}
          onChange={(items) => setDraft({ ...draft, successLooksLike: items.map((item) => item.body).filter(Boolean).slice(0, 5) })}
        />

        <p className="alignment-editor-guardrail">
          EMMA may compare evidence against this context, but leadership remains responsible for priorities, discernment, theology, and decisions.
        </p>

        <div className="toolbar split">
          <button className="button ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="button primary" type="submit">
            <Save aria-hidden="true" />
            Save alignment
          </button>
        </div>
      </form>
    </div>
  );
}

function EditableList({
  addLabel,
  bodyOnly = false,
  items,
  label,
  onChange
}: {
  addLabel: string;
  bodyOnly?: boolean;
  items: Array<{ id: string; title: string; body: string }>;
  label: string;
  onChange: (items: Array<{ id: string; title: string; body: string }>) => void;
}) {
  const visibleItems = items.length ? items : [{ id: `${label.toLowerCase()}-1`, title: "", body: "" }];
  return (
    <section className="alignment-editor-list" aria-label={label}>
      <header>
        <strong>{label}</strong>
        <button
          className="button compact-button"
          type="button"
          onClick={() => onChange([...visibleItems, { id: `${label.toLowerCase()}-${Date.now()}`, title: "", body: "" }].slice(0, bodyOnly ? 5 : 7))}
        >
          {addLabel}
        </button>
      </header>
      {visibleItems.map((item, index) => (
        <div className={bodyOnly ? "alignment-editor-list-row body-only" : "alignment-editor-list-row"} key={item.id}>
          {bodyOnly ? null : (
            <label className="field">
              <span>Title</span>
              <input className="input" value={item.title} onChange={(event) => onChange(replaceItem(visibleItems, index, { ...item, title: event.target.value }))} />
            </label>
          )}
          <label className="field">
            <span>{bodyOnly ? "Criterion" : "Description"}</span>
            <textarea className="input" rows={bodyOnly ? 2 : 3} value={item.body} onChange={(event) => onChange(replaceItem(visibleItems, index, { ...item, body: event.target.value }))} />
          </label>
          <button className="button ghost compact-button" type="button" onClick={() => onChange(visibleItems.filter((_, itemIndex) => itemIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

function replaceItem<T>(items: T[], index: number, nextItem: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
}
