"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Archive,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/platform-ui";
import { ResourceAttachments } from "@/components/resource-attachments";
import { jerichoLeaderGuide } from "@/lib/volunteer-hub/leader-guide";
import type {
  VolunteerHubAction,
  VolunteerHubPayload,
  VolunteerHubResource,
  VolunteerHubSmallGroup,
  VolunteerHubStudent,
  VolunteerHubVolunteer
} from "@/lib/volunteer-hub/types";

type VolunteerHubMode = "volunteer" | "director";
type VolunteerTab = "dashboard" | "group" | "students" | "attendance" | "chat" | "resources" | "training" | "onboarding" | "calendar" | "profile";
type GroupMeChoice = { id: string; name: string; description?: string; memberCount: number };
type LiveGroupMeMessage = { id: string; senderName: string; text: string; avatarUrl?: string; createdAt: string };
type ServiceGroupBucket = { serviceTime: string; groups: VolunteerHubSmallGroup[]; studentCount: number };

const tabs: Array<{ id: VolunteerTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "group", label: "My Small Group" },
  { id: "students", label: "Students" },
  { id: "attendance", label: "Attendance" },
  { id: "chat", label: "Group Chat" },
  { id: "resources", label: "Weekly Resources" },
  { id: "training", label: "Training" },
  { id: "onboarding", label: "Onboarding" },
  { id: "calendar", label: "Calendar" },
  { id: "profile", label: "Profile" }
];

const defaultServiceTimes = ["Sunday - 9:00 AM", "Sunday - 10:30 AM", "Wednesday - 6:30 PM"];

export function VolunteerHubPage({ mode = "volunteer" }: { mode?: VolunteerHubMode }) {
  const [payload, setPayload] = useState<VolunteerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<VolunteerTab>("dashboard");
  const [syncingCheckIns, setSyncingCheckIns] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/volunteer-hub", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) {
      setError("Volunteer Hub could not be loaded.");
      setLoading(false);
      return;
    }
    setPayload((await response.json()) as VolunteerHubPayload);
    setLoading(false);
  }

  async function act(action: VolunteerHubAction, success: string) {
    if (payload?.readOnlyReason) {
      setError(payload.readOnlyReason);
      return;
    }
    setNotice("");
    setError("");
    const response = await fetch("/api/volunteer-hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action)
    });
    const body = (await response.json().catch(() => ({}))) as VolunteerHubPayload | { error?: string };
    if (!response.ok || "error" in body || !("activeVolunteer" in body)) {
      setError("error" in body && body.error ? body.error : "Volunteer Hub action failed.");
      return;
    }
    setPayload(body);
    setNotice(success);
  }

  async function syncPlanningCenterCheckIns() {
    setSyncingCheckIns(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/integrations/planning-center/sync", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string; result?: { peopleCount: number; attendanceCount: number } };
      if (!response.ok) {
        setError(body.error ?? "Planning Center check-ins could not be synced.");
        return;
      }
      await load();
      setNotice(`Planning Center synced ${body.result?.peopleCount ?? 0} people and ${body.result?.attendanceCount ?? 0} check-ins.`);
    } finally {
      setSyncingCheckIns(false);
    }
  }

  async function linkGroupMeConversation(platformGroupId: string, groupMeGroupId: string) {
    setError("");
    const response = await fetch("/api/integrations/groupme/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformGroupId, groupMeGroupId })
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; group?: GroupMeChoice };
    if (!response.ok) {
      setError(body.error ?? "GroupMe conversation could not be linked.");
      return;
    }
    await load();
    setNotice(`${body.group?.name ?? "GroupMe conversation"} linked to the small group.`);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupMeStatus = params.get("groupme");
    if (groupMeStatus === "connected") {
      setNotice("GroupMe connected. Choose Manage Group on a small group, then select the matching GroupMe conversation.");
    } else if (groupMeStatus === "error") {
      setError("GroupMe connected screen returned without saving. Try reconnecting, then choose a small-group conversation.");
    }
    if (groupMeStatus) {
      params.delete("groupme");
      const nextSearch = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`);
    }
  }, []);

  if (loading) return <section className="panel volunteer-hub-loading">Loading ministry workspace...</section>;
  if (error && !payload) return <section className="panel volunteer-hub-loading" role="alert">{error}</section>;
  if (!payload) return null;

  const isDirectorMode = mode === "director";

  return (
    <section className={isDirectorMode ? "volunteer-hub volunteer-hub-director" : "volunteer-hub"} aria-label={isDirectorMode ? "Volunteer director dashboard" : "Volunteer Hub"}>
      <PageIntro
        eyebrow={isDirectorMode ? "Directors Hub" : "Volunteer Hub"}
        title={isDirectorMode ? "Volunteer Dashboard" : `Good Morning ${firstName(payload.activeVolunteer.name)}`}
        description={isDirectorMode
          ? "Monitor readiness, follow-up health, training, resources, and small group consolidation from one place."
          : "Prepare for serving, care for assigned students, and keep every action connected to relationship-first ministry."}
        actions={<HubStatus integrations={payload.integrations} />}
      />
      {payload.readOnlyReason ? <p className="volunteer-hub-notice" role="status">{payload.readOnlyReason}</p> : null}
      {notice ? <p className="volunteer-hub-notice" role="status">{notice}</p> : null}
      {error ? <p className="volunteer-hub-error" role="alert">{error}</p> : null}

      {isDirectorMode ? (
        <DirectorDashboard payload={payload} onAction={act} onLinkGroupMe={linkGroupMeConversation} onReload={load} />
      ) : (
        <>
          <MobileVolunteerPriorities payload={payload} activeTab={activeTab} onTabChange={setActiveTab} />
          <nav className="volunteer-hub-tabs" aria-label="Volunteer Hub sections">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>
          <VolunteerTabContent
            payload={payload}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAction={act}
            onReload={load}
            onSyncCheckIns={syncPlanningCenterCheckIns}
            syncingCheckIns={syncingCheckIns}
          />
          {payload.role === "admin" || payload.role === "director" || payload.role === "leader" ? (
            <div className="volunteer-hub-grid" aria-label="Volunteer Hub operations">
              <SmallGroupDirectorPanel payload={payload} onAction={act} onLinkGroupMe={linkGroupMeConversation} onReload={load} />
              <LeaderPoolPanel payload={payload} onAction={act} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function MobileVolunteerPriorities({
  payload,
  activeTab,
  onTabChange
}: {
  payload: VolunteerHubPayload;
  activeTab: VolunteerTab;
  onTabChange: (tab: VolunteerTab) => void;
}) {
  const openTasks = payload.tasks.filter((task) => !task.completed).length;
  const followUps = payload.students.filter((student) => student.followUpNeeded).length;
  const unreadMessages = payload.notifications.filter((item) => item.unread && item.href.includes("chat")).length;
  const priorityTabs: Array<{ id: VolunteerTab; label: string; title: string; detail: string; icon: ReactNode }> = [
    {
      id: "dashboard",
      label: "Today",
      title: openTasks ? `${openTasks} task${openTasks === 1 ? "" : "s"}` : "Ready",
      detail: payload.activeGroup.serviceTime,
      icon: <ClipboardCheck aria-hidden="true" />
    },
    {
      id: "students",
      label: "Students",
      title: followUps ? `${followUps} follow-up${followUps === 1 ? "" : "s"}` : `${payload.students.length} assigned`,
      detail: payload.activeGroup.name,
      icon: <UsersRound aria-hidden="true" />
    },
    {
      id: "resources",
      label: "Resources",
      title: `${payload.resources.length} prep item${payload.resources.length === 1 ? "" : "s"}`,
      detail: `${payload.resources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0)} min prep`,
      icon: <BookOpen aria-hidden="true" />
    },
    {
      id: "chat",
      label: "Chat",
      title: payload.activeGroup.groupMeConnected ? "GroupMe linked" : unreadMessages ? `${unreadMessages} update${unreadMessages === 1 ? "" : "s"}` : "Message prep",
      detail: payload.integrations.groupMe.displayStatus === "connected" ? "Review before sending" : "Preview only",
      icon: <MessageSquareText aria-hidden="true" />
    }
  ];

  return (
    <section className="mobile-volunteer-priorities" aria-label="Volunteer mobile priorities">
      <div className="mobile-volunteer-priority-grid">
        {priorityTabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "mobile-volunteer-priority active" : "mobile-volunteer-priority"} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.icon}
            <span>{tab.label}</span>
            <strong>{tab.title}</strong>
            <small>{tab.detail}</small>
          </button>
        ))}
      </div>
      <div className="mobile-volunteer-more">
        <label htmlFor="mobile-volunteer-more-select">More volunteer tools</label>
        <select id="mobile-volunteer-more-select" className="input" value={activeTab} onChange={(event) => onTabChange(event.target.value as VolunteerTab)}>
          {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </div>
    </section>
  );
}

function VolunteerTabContent({
  payload,
  activeTab,
  onTabChange,
  onAction,
  onReload,
  onSyncCheckIns,
  syncingCheckIns
}: {
  payload: VolunteerHubPayload;
  activeTab: VolunteerTab;
  onTabChange: (tab: VolunteerTab) => void;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onReload: () => Promise<void>;
  onSyncCheckIns: () => Promise<void>;
  syncingCheckIns: boolean;
}) {
  if (activeTab === "group") return <SmallGroupWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "students") return <StudentsWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "attendance") return <AttendanceWorkspace payload={payload} onAction={onAction} onSync={onSyncCheckIns} syncing={syncingCheckIns} />;
  if (activeTab === "chat") return <ChatWorkspace payload={payload} onAction={onAction} onReload={onReload} />;
  if (activeTab === "resources") return <ResourcesWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "training") return <TrainingWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "onboarding") return <OnboardingWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "calendar") return <CalendarWorkspace payload={payload} />;
  if (activeTab === "profile") return <ProfileWorkspace payload={payload} onAction={onAction} />;

  return (
    <div className="volunteer-hub-grid">
      <ServingCard payload={payload} />
      <MetricCard icon={<UsersRound aria-hidden="true" />} label="Students This Week" value={`${payload.attendance.assigned} Assigned`} detail={`${payload.attendance.present} present last week. ${payload.attendance.needFollowUp} need follow-up.`} />
      <MetricCard icon={<Bell aria-hidden="true" />} label="Notifications" value={String(payload.notifications.filter((item) => item.unread).length)} detail="Training, resources, and student follow-up signals." />
      <TaskPanel tasks={payload.tasks} onAction={onAction} />
      <LatestResources resources={payload.resources} onOpen={() => onTabChange("resources")} />
      <NotificationsPanel payload={payload} onOpen={onTabChange} />
    </div>
  );
}

function ServingCard({ payload }: { payload: VolunteerHubPayload }) {
  const leader = payload.volunteers.find((volunteer) => volunteer.id === payload.activeGroup.leaderId);
  const coLeader = payload.volunteers.find((volunteer) => volunteer.id === payload.activeGroup.coLeaderId);
  const isLive = payload.dataSource === "live";
  return (
    <article className="volunteer-hub-panel volunteer-serving-card">
      <p className="eyebrow">{isLive ? "Live Roster" : "Serving Today"}</p>
      <h3>{payload.activeGroup.serviceTime}</h3>
      <strong>{payload.activeGroup.name}</strong>
      <span>{payload.activeGroup.room}</span>
      {isLive ? null : <div className="volunteer-serving-meta">
        <span>Leader Meeting</span>
        <strong>8:40 AM</strong>
      </div>}
      <p>{isLive ? `${payload.students.length} synced student refs are available for real ministry setup.` : `${leader?.name ?? "Leader"}${coLeader ? ` and ${coLeader.name}` : ""} are assigned.`}</p>
    </article>
  );
}

function TaskPanel({ tasks, onAction }: { tasks: VolunteerHubPayload["tasks"]; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  return (
    <article className="volunteer-hub-panel volunteer-hub-span-2">
      <SectionTitle icon={<ClipboardCheck aria-hidden="true" />} eyebrow="Today's Tasks" title="What needs to happen before group" />
      {!tasks.length ? <EmptyState title="No assigned tasks yet" detail="Tasks will appear here after they are created from real ministry workflows." /> : null}
      <div className="volunteer-task-list">
        {tasks.map((task) => (
          <button key={task.id} type="button" className={task.completed ? "volunteer-task complete" : "volunteer-task"} onClick={() => onAction({ type: "complete_task", taskId: task.id, completed: !task.completed }, task.completed ? "Task reopened." : "Task completed.")}>
            <CheckCircle2 aria-hidden="true" />
            <span>
              <strong>{task.label}</strong>
              <small>{task.detail}</small>
            </span>
            <em>{task.dueLabel}</em>
          </button>
        ))}
      </div>
    </article>
  );
}

function SmallGroupWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const leader = payload.volunteers.find((volunteer) => volunteer.id === payload.activeGroup.leaderId);
  const coLeader = payload.volunteers.find((volunteer) => volunteer.id === payload.activeGroup.coLeaderId);
  const actionsEnabled = !payload.readOnlyReason;
  return (
    <div className="volunteer-hub-grid">
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Permanent Small Group Workspace" title={payload.activeGroup.name} />
        <div className="volunteer-group-summary">
          <span><strong>Leader</strong>{leader?.name ?? "Unassigned"}</span>
          <span><strong>Co-Leader</strong>{coLeader?.name ?? "Open slot"}</span>
          <span><strong>Students</strong>{payload.students.length}</span>
          <span><strong>GroupMe</strong>{payload.activeGroup.groupMeConnected ? payload.activeGroup.groupMeGroupName ?? "Connected" : "Not linked"}</span>
        </div>
      </article>
      {payload.students.length ? payload.students.map((student) => (
        <StudentCard key={student.id} student={student} actionsEnabled={actionsEnabled} onAction={onAction} />
      )) : <EmptyPanel title="No students assigned yet" detail="No student roster rows are available for this workspace yet. Sync Planning Center or assign students to groups to populate this view." />}
    </div>
  );
}

function StudentCard({ student, actionsEnabled, onAction }: { student: VolunteerHubStudent; actionsEnabled: boolean; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  return (
    <article className="volunteer-hub-panel volunteer-student-card">
      <div className="volunteer-avatar" aria-hidden="true">{student.profilePhotoUrl ? <Image src={student.profilePhotoUrl} alt="" width={48} height={48} unoptimized /> : initials(student.preferredName)}</div>
      <h3>{student.preferredName}</h3>
      <p>{student.grade} - {student.school}</p>
      <div className="volunteer-student-tags">
        <StatusBadge tone={student.attendanceStatus === "present" ? "success" : student.attendanceStatus === "absent" ? "warning" : "info"}>{student.attendanceStatus}</StatusBadge>
        {student.followUpNeeded ? <StatusBadge tone="warning">Needs follow-up</StatusBadge> : null}
        {student.prayerRequestIndicator ? <StatusBadge tone="info">Prayer indicator</StatusBadge> : null}
        {student.source === "camp_clc" ? <StatusBadge tone="info">Camp CLC</StatusBadge> : null}
      </div>
      <dl className="volunteer-facts">
        {student.cabin ? <div><dt>Room</dt><dd>{student.cabin}</dd></div> : null}
        <div><dt>Last attended</dt><dd>{formatDate(student.lastAttended)}</dd></div>
        <div><dt>Birthday</dt><dd>{student.birthday}</dd></div>
        <div><dt>Parent contact</dt><dd>{student.parentContactAvailable ? "Permission based" : "Not available"}</dd></div>
      </dl>
      {student.safeIndicators?.length ? <p className="muted">{student.safeIndicators.join(" / ")}</p> : null}
      {actionsEnabled ? <form className="volunteer-inline-form" onSubmit={(event) => {
        event.preventDefault();
        void onAction({ type: "add_follow_up", studentId: student.id, note }, "Follow-up assigned.").then(() => setNote(""));
      }}>
        <label>
          <span>Quick follow-up note</span>
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Note for ${student.preferredName}`} />
        </label>
        <button className="button compact-button" type="submit">Save follow-up</button>
      </form> : null}
    </article>
  );
}

function StudentsWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const filtered = payload.studentRoster.filter((student) => {
    const text = `${student.preferredName} ${student.fullName} ${student.grade} ${student.school} ${student.cabin ?? ""}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase()))
      && (source === "all" || student.source === source);
  });
  const actionsEnabled = !payload.readOnlyReason;

  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<UsersRound aria-hidden="true" />} label="CLC Camp Students" value={String(payload.studentRosterSource.campClcCount)} detail="Filtered through the Camp CLC roster boundary." />
      <MetricCard icon={<ClipboardCheck aria-hidden="true" />} label="Planning Center Refs" value={String(payload.studentRosterSource.planningCenterCount)} detail="Synced ministry student references." />
      <article className="volunteer-hub-panel volunteer-hub-span-3 volunteer-student-roster-tools">
        <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Students" title="Roster view" />
        <div className="volunteer-roster-filters">
          <label className="field"><span>Search</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, grade, school, or room" /></label>
          <label className="field"><span>Source</span><select className="input" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option><option value="camp_clc">Camp CLC</option><option value="planning_center">Planning Center</option><option value="demo">Demo</option></select></label>
        </div>
      </article>
      {filtered.length ? filtered.map((student) => (
        <StudentCard key={student.id} student={student} actionsEnabled={actionsEnabled} onAction={onAction} />
      )) : <EmptyPanel title="No students match these filters" detail="Adjust the search, team, or source filters to widen the roster view." />}
    </div>
  );
}

function AttendanceWorkspace({
  payload,
  onAction,
  onSync,
  syncing
}: {
  payload: VolunteerHubPayload;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
}) {
  const actionsEnabled = !payload.readOnlyReason;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<ClipboardCheck aria-hidden="true" />} label="Assigned" value={String(payload.attendance.assigned)} detail="Students assigned to your active small group." />
      <MetricCard icon={<CheckCircle2 aria-hidden="true" />} label="Present" value={String(payload.attendance.present)} detail={`${payload.attendance.attendancePercent}% attendance from latest imported snapshot.`} />
      <MetricCard icon={<Bell aria-hidden="true" />} label="Need Follow-up" value={String(payload.attendance.needFollowUp)} detail="Suggestions only. No automatic messages are sent." />
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <div className="volunteer-panel-head">
          <SectionTitle icon={<ClipboardCheck aria-hidden="true" />} eyebrow="Attendance Dashboard" title="Planning Center check-in workflow" />
          {payload.integrations.planningCenter.displayStatus === "connected" ? (
            <button className="button primary" type="button" disabled={syncing} onClick={() => void onSync()}>
              {syncing ? <LoaderCircle className="volunteer-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {syncing ? "Syncing..." : "Sync check-ins"}
            </button>
          ) : (
            <a className="button primary" href="/api/integrations/planning-center/connect">Connect Planning Center</a>
          )}
        </div>
        <p className="muted">
          Planning Center remains the student and attendance source of truth. A manual sync imports minimized student and check-in references; Volunteer Hub stores only group assignments and leader review state.
          {payload.integrations.planningCenter.lastSyncAt ? ` Last synced ${formatDateTime(payload.integrations.planningCenter.lastSyncAt)}.` : ""}
        </p>
        <div className="volunteer-attendance-list">
          {payload.students.length ? payload.students.map((student) => (
            <div className="volunteer-attendance-row" key={student.id}>
              <strong>{student.preferredName}</strong>
              <span>{student.attendanceStatus}</span>
              <span>Last attended {formatDate(student.lastAttended)}</span>
              <span>{student.consecutiveAbsences} consecutive absences</span>
              <button className="button compact-button" type="button" disabled={!actionsEnabled || !student.followUpNeeded} onClick={() => onAction({ type: "review_attendance", studentId: student.id }, "Attendance follow-up reviewed.")}>
                {student.followUpNeeded ? "Mark reviewed" : "Reviewed"}
              </button>
            </div>
          )) : <EmptyState title="No attendance rows yet" detail="Planning Center attendance summaries will appear here after a sync has imported check-in references." />}
        </div>
      </article>
    </div>
  );
}

function ChatWorkspace({
  payload,
  onAction,
  onReload
}: {
  payload: VolunteerHubPayload;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [liveMessages, setLiveMessages] = useState<LiveGroupMeMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentStatus, setSentStatus] = useState("");
  const isLiveConversation = payload.dataSource === "live"
    && payload.integrations.groupMe.displayStatus === "connected"
    && payload.activeGroup.groupMeConnected;
  const isDemoConversation = payload.dataSource !== "live" && !payload.readOnlyReason;
  const selectedResource = payload.resources.find((resource) => resource.id === resourceId);
  const outgoingMessage = `${message.trim()}${selectedResource ? `\n\nVolunteer Prep: ${selectedResource.title}` : ""}`;

  useEffect(() => {
    if (!isLiveConversation) {
      setLiveMessages([]);
      return;
    }
    const controller = new AbortController();
    setLoadingMessages(true);
    setChatError("");
    void fetch(`/api/integrations/groupme/messages?groupId=${encodeURIComponent(payload.activeGroup.id)}`, {
      cache: "no-store",
      signal: controller.signal
    }).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as { messages?: LiveGroupMeMessage[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "GroupMe messages could not be loaded.");
      setLiveMessages(body.messages ?? []);
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== "AbortError") setChatError(error.message);
    }).finally(() => setLoadingMessages(false));
    return () => controller.abort();
  }, [isLiveConversation, payload.activeGroup.id]);

  async function sendReviewedMessage() {
    if (!outgoingMessage) return;
    setSending(true);
    setChatError("");
    setSentStatus("");
    try {
      const response = await fetch("/api/integrations/groupme/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: payload.activeGroup.id, message: outgoingMessage, resourceId: resourceId || undefined })
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "GroupMe message could not be sent.");
      setMessage("");
      setResourceId("");
      setReviewing(false);
      setSentStatus("Message sent to GroupMe and added to the activity log.");
      await onReload();
      const refreshed = await fetch(`/api/integrations/groupme/messages?groupId=${encodeURIComponent(payload.activeGroup.id)}`, { cache: "no-store" });
      const refreshedBody = (await refreshed.json().catch(() => ({}))) as { messages?: LiveGroupMeMessage[] };
      if (refreshed.ok) setLiveMessages(refreshedBody.messages ?? []);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "GroupMe message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const displayedMessages = isLiveConversation
    ? liveMessages
    : payload.chatMessages.slice().reverse().map((chat) => ({
        id: chat.id,
        senderName: chat.senderName,
        text: chat.body,
        createdAt: chat.createdAt
      }));

  return (
    <div className="volunteer-chat-layout">
      <article className="volunteer-hub-panel volunteer-chat-conversation">
        <div className="volunteer-panel-head">
          <SectionTitle icon={<MessageSquareText aria-hidden="true" />} eyebrow="Group Chat" title={payload.activeGroup.groupMeGroupName ?? `${payload.activeGroup.name} conversation`} />
          <StatusBadge tone={isLiveConversation ? "success" : isDemoConversation ? "info" : "warning"}>
            {isLiveConversation ? "Live GroupMe" : isDemoConversation ? "Demo workspace" : "Setup needed"}
          </StatusBadge>
        </div>
        <p className="muted">{payload.integrations.groupMe.message}</p>
        {payload.dataSource === "live" && payload.integrations.groupMe.displayStatus !== "connected" ? (
          <div className="volunteer-chat-setup">
            <Link2 aria-hidden="true" />
            <div><strong>Connect GroupMe once for the ministry</strong><p>After OAuth, a director can link each small group to its existing conversation.</p></div>
            <a className="button primary" href="/api/integrations/groupme/connect">Connect GroupMe</a>
          </div>
        ) : null}
        {payload.dataSource === "live" && payload.integrations.groupMe.displayStatus === "connected" && !payload.activeGroup.groupMeConnected ? (
          <div className="volunteer-chat-setup">
            <Link2 aria-hidden="true" />
            <div><strong>Conversation not linked yet</strong><p>A director can use Manage Group to choose the matching GroupMe conversation.</p></div>
          </div>
        ) : null}
        <div className="volunteer-chat-window" aria-live="polite">
          {loadingMessages ? <p className="volunteer-chat-loading"><LoaderCircle className="volunteer-spin" aria-hidden="true" />Loading conversation...</p> : null}
          {displayedMessages.length ? displayedMessages.map((chat) => {
            const mine = chat.senderName.toLowerCase() === payload.activeVolunteer.name.toLowerCase();
            return (
              <div className={mine ? "volunteer-chat-message mine" : "volunteer-chat-message"} key={chat.id}>
                <span className="volunteer-chat-avatar" aria-hidden="true">{initials(chat.senderName)}</span>
                <div>
                  <strong>{chat.senderName}</strong>
                  <p>{chat.text}</p>
                  <small>{formatDateTime(chat.createdAt)}</small>
                </div>
              </div>
            );
          }) : !loadingMessages ? <EmptyState title="Conversation is ready" detail={isLiveConversation ? "No recent GroupMe messages were returned." : "Draft a message below to start the volunteer conversation."} /> : null}
        </div>
      </article>
      <form className="volunteer-hub-panel volunteer-chat-composer" onSubmit={(event) => {
        event.preventDefault();
        if (!outgoingMessage) return;
        if (isDemoConversation) {
          void onAction({ type: "preview_chat_message", groupId: payload.activeGroup.id, body: message, resourceId: resourceId || undefined }, "Demo message saved inside Volunteer Hub.").then(() => {
            setMessage("");
            setResourceId("");
          });
          return;
        }
        setReviewing(true);
      }}>
        <SectionTitle icon={<Send aria-hidden="true" />} eyebrow="Composer" title={isLiveConversation ? "Prepare a leader message" : "Message workspace"} />
        <label className="field volunteer-message-field"><span>Message</span><textarea className="input" rows={7} maxLength={900} disabled={!isLiveConversation && !isDemoConversation} value={message} onChange={(event) => { setMessage(event.target.value); setReviewing(false); }} placeholder="Share a clear update, encouragement, or preparation reminder..." /><small>{message.length}/900</small></label>
        <label className="field"><span>Attach platform resource</span><select className="input" disabled={!isLiveConversation && !isDemoConversation} value={resourceId} onChange={(event) => setResourceId(event.target.value)}>
          <option value="">No resource</option>
          {payload.resources.filter((resource) => resource.shareable).map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
        </select></label>
        {reviewing ? (
          <div className="volunteer-message-review" role="region" aria-label="Review GroupMe message">
            <span><Check aria-hidden="true" />Ready for final review</span>
            <p>{outgoingMessage}</p>
            <div className="volunteer-card-actions">
              <button className="button" type="button" onClick={() => setReviewing(false)}>Keep editing</button>
              <button className="button primary" type="button" disabled={sending} onClick={() => void sendReviewedMessage()}>
                {sending ? <LoaderCircle className="volunteer-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {sending ? "Sending..." : "Send to GroupMe"}
              </button>
            </div>
          </div>
        ) : (
          <button className="button primary" type="submit" disabled={!outgoingMessage || (!isLiveConversation && !isDemoConversation)}>
            <Send aria-hidden="true" />{isDemoConversation ? "Save demo message" : "Review message"}
          </button>
        )}
        {chatError ? <p className="volunteer-hub-error" role="alert">{chatError}</p> : null}
        {sentStatus ? <p className="volunteer-hub-notice" role="status">{sentStatus}</p> : null}
      </form>
    </div>
  );
}

function ResourcesWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  return (
    <div className="volunteer-hub-grid">
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<BookOpen aria-hidden="true" />} eyebrow="Volunteer Prep" title={payload.resources.length ? "This week's leader workflow" : "No resources published yet"} />
        <p className="muted">Preparation estimate: {payload.resources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0)} minutes.</p>
        <ResourceAttachments compact parentType="small_group_resource" parentId={payload.activeGroup.id} title="Small-group videos and resources" />
      </article>
      {payload.resources.some((resource) => resource.id === "res_leader_guide") ? <JerichoLeaderGuideCard /> : null}
      {payload.resources.length ? payload.resources.map((resource) => (
        <ResourceCard key={resource.id} groupId={payload.activeGroup.id} resource={resource} onAction={onAction} />
      )) : <EmptyPanel title="No weekly resources yet" detail="Published leader guides, audio, notes, or parent resources will appear here when they are created for this ministry." />}
    </div>
  );
}

function JerichoLeaderGuideCard() {
  return (
    <article className="volunteer-hub-panel volunteer-hub-span-3 volunteer-guide-card">
      <header className="volunteer-guide-hero">
        <div>
          <p className="eyebrow">Ready-to-lead guide</p>
          <h3>{jerichoLeaderGuide.title}</h3>
          <p>{jerichoLeaderGuide.subtitle}</p>
        </div>
        <span>10 min prep</span>
      </header>
      <div className="volunteer-guide-scripture" aria-label="Primary passages">
        {jerichoLeaderGuide.passages.map((passage) => <span key={passage}>{passage}</span>)}
      </div>
      <section className="volunteer-guide-big-idea">
        <p className="eyebrow">Big Idea</p>
        <strong>{jerichoLeaderGuide.bigIdea}</strong>
        <p>{jerichoLeaderGuide.leaderGoal}</p>
      </section>
      <div className="volunteer-guide-columns">
        <section>
          <h4>Teaching flow</h4>
          <div className="volunteer-guide-movements">
            {jerichoLeaderGuide.movements.map((movement, index) => (
              <div key={movement.title}>
                <span>{index + 1}</span>
                <div><strong>{movement.title}</strong><p>{movement.summary}</p></div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h4>Small group questions</h4>
          <div className="volunteer-guide-questions">
            {jerichoLeaderGuide.discussion.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary><span>{item.phase}</span>{item.question}</summary>
                <p><strong>Leader cue:</strong> {item.leaderCue}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <div className="volunteer-guide-footer">
        <section><p className="eyebrow">Practice</p><p>{jerichoLeaderGuide.practice}</p></section>
        <section><p className="eyebrow">Close in prayer</p><p>{jerichoLeaderGuide.prayer}</p></section>
        <section className="volunteer-guide-care"><ShieldCheck aria-hidden="true" /><div><strong>Leader care note</strong><p>{jerichoLeaderGuide.careNote}</p></div></section>
      </div>
    </article>
  );
}

function ResourceCard({ resource, groupId, onAction }: { resource: VolunteerHubResource; groupId: string; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  return (
    <article className="volunteer-hub-panel volunteer-resource-card">
      <BookOpen aria-hidden="true" />
      <h3>{resource.title}</h3>
      <p>{resource.detail}</p>
      <span>{resource.estimatedMinutes} minutes</span>
      <div className="volunteer-card-actions">
        <button className="button compact-button" type="button" onClick={() => onAction({ type: "complete_resource", resourceId: resource.id, completed: !resource.completed }, resource.completed ? "Resource reopened." : "Resource completed.")}>
          {resource.completed ? "Reopen" : "Mark complete"}
        </button>
        {resource.shareable ? (
          <button className="button compact-button" type="button" onClick={() => onAction({ type: "preview_chat_message", groupId, body: `Resource preview: ${resource.title}`, resourceId: resource.id }, "Resource share preview logged. Nothing was sent.")}>
            Share preview
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TrainingWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const completed = payload.trainingModules.filter((module) => module.completed).length;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<ShieldCheck aria-hidden="true" />} label="Current Quarter" value={`${completed}/${payload.trainingModules.length}`} detail="Required and optional module progress." />
      <article className="volunteer-hub-panel volunteer-hub-span-2">
        <SectionTitle icon={<ShieldCheck aria-hidden="true" />} eyebrow="Training" title="Quarterly training center" />
        <ResourceAttachments compact parentType="volunteer_training" parentId="quarterly-training-center" title="Training Materials" />
        <div className="volunteer-module-list">
          {payload.trainingModules.length ? payload.trainingModules.map((module) => (
            <div className="volunteer-module-row" key={module.id}>
              <strong>{module.title}</strong>
              <span>{module.category}</span>
              <span>{module.required ? "Required" : "Optional"}</span>
              <span>Due {formatDate(module.dueDate)}</span>
              <button className="button compact-button" type="button" onClick={() => onAction({ type: "complete_training", moduleId: module.id, completed: !module.completed }, module.completed ? "Training reopened." : "Training completed.")}>
                {module.completed ? "Completed" : "Mark complete"}
              </button>
              <div className="volunteer-module-resource-panel">
                <ResourceAttachments compact parentType="volunteer_training_module" parentId={module.id} title={`Materials for ${module.title}`} />
              </div>
            </div>
          )) : <EmptyState title="No training modules yet" detail="Training records will appear here after real modules are published or imported." />}
        </div>
      </article>
    </div>
  );
}

function OnboardingWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const blockers = payload.onboardingItems.filter((item) => item.blocksStudentContact && !item.completed).length;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<ShieldCheck aria-hidden="true" />} label="Student Contact" value={blockers ? "Blocked" : "Approved"} detail={blockers ? `${blockers} required item(s) incomplete.` : "Required onboarding is complete."} />
      <article className="volunteer-hub-panel volunteer-hub-span-2">
        <SectionTitle icon={<ShieldCheck aria-hidden="true" />} eyebrow="Onboarding" title="New volunteer checklist" />
        <div className="volunteer-task-list">
          {payload.onboardingItems.length ? payload.onboardingItems.map((item) => (
            <button key={item.id} type="button" className={item.completed ? "volunteer-task complete" : "volunteer-task"} onClick={() => onAction({ type: "update_onboarding", itemId: item.id, completed: !item.completed }, "Onboarding checklist updated.")}>
              <CheckCircle2 aria-hidden="true" />
              <span><strong>{item.label}</strong><small>{item.blocksStudentContact ? "Required before student contact" : "Preparation step"}</small></span>
            </button>
          )) : <EmptyState title="No onboarding checklist yet" detail="Registered users will not see a seeded checklist until real onboarding records are connected." />}
        </div>
      </article>
    </div>
  );
}

function CalendarWorkspace({ payload }: { payload: VolunteerHubPayload }) {
  const items = payload.dataSource === "live" ? [
    ["Serving schedule", payload.activeGroup.serviceTime],
    ["Student roster", `${payload.students.length} Planning Center student refs`]
  ] : [
    ["Serving schedule", payload.activeGroup.serviceTime],
    ["Leader meeting", "Sunday - 8:40 AM"],
    ["Volunteer Training", "In 16 days"],
    ["Student birthdays", payload.students.map((student) => `${student.preferredName}: ${student.birthday}`).join(", ") || "No birthdays in this group"]
  ];
  return (
    <article className="volunteer-hub-panel">
      <SectionTitle icon={<ClipboardCheck aria-hidden="true" />} eyebrow="Calendar" title="Volunteer-specific calendar" />
      <div className="volunteer-module-list">{items.map(([label, detail]) => <div className="volunteer-module-row" key={label}><strong>{label}</strong><span>{detail}</span></div>)}</div>
    </article>
  );
}

function ProfileWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [availability, setAvailability] = useState(payload.activeVolunteer.availability);
  const [preferredCommunication, setPreferredCommunication] = useState(payload.activeVolunteer.preferredCommunication);
  const actionsEnabled = !payload.readOnlyReason;
  return (
    <form className="volunteer-hub-panel volunteer-profile-panel" onSubmit={(event) => {
      event.preventDefault();
      void onAction({ type: "update_profile", availability, preferredCommunication }, "Volunteer profile updated.");
    }}>
      <SectionTitle icon={<UserRound aria-hidden="true" />} eyebrow="Profile" title={payload.activeVolunteer.name} />
      <label className="field"><span>Availability</span><textarea className="input" rows={3} value={availability} disabled={!actionsEnabled} onChange={(event) => setAvailability(event.target.value)} /></label>
      <label className="field"><span>Preferred communication</span><select className="input" value={preferredCommunication} disabled={!actionsEnabled} onChange={(event) => setPreferredCommunication(event.target.value as typeof preferredCommunication)}>
        <option value="email">Email</option>
        <option value="text">Text</option>
        <option value="groupme">GroupMe</option>
      </select></label>
      <div className="volunteer-group-summary">
        <span><strong>Serving areas</strong>{payload.activeVolunteer.servingAreas.join(", ")}</span>
        <span><strong>Skills</strong>{payload.activeVolunteer.skills.join(", ")}</span>
        <span><strong>Background check</strong>{formatDate(payload.activeVolunteer.backgroundCheckExpires)}</span>
      </div>
      <button className="button primary" type="submit" disabled={!actionsEnabled}>Save profile</button>
    </form>
  );
}

function DirectorDashboard({
  payload,
  onAction,
  onLinkGroupMe,
  onReload
}: {
  payload: VolunteerHubPayload;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onLinkGroupMe: (platformGroupId: string, groupMeGroupId: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const activeGroupStudents = payload.activeGroups.reduce((sum, group) => sum + group.memberStudentIds.length, 0);
  const completedTraining = payload.trainingModules.filter((module) => module.completed).length;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<UsersRound aria-hidden="true" />} label="Active Small Groups" value={String(payload.activeGroups.length)} detail={`${activeGroupStudents} assigned students in active groups.`} />
      <MetricCard icon={<ShieldCheck aria-hidden="true" />} label="Training Completion" value={`${completedTraining}/${payload.trainingModules.length}`} detail="Quarterly leader-readiness modules." />
      <MetricCard icon={<Archive aria-hidden="true" />} label="Archived Groups" value={String(payload.archivedGroups.length)} detail="Reversible archive for consolidated groups." />
      <SmallGroupDirectorPanel payload={payload} onAction={onAction} onLinkGroupMe={onLinkGroupMe} onReload={onReload} />
      <LeaderPoolPanel payload={payload} onAction={onAction} />
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<ClipboardCheck aria-hidden="true" />} eyebrow="Audit Activity" title="Accountability log" />
        <div className="volunteer-module-list">
          {payload.audit.map((entry) => (
            <div className="volunteer-module-row" key={entry.id}>
              <strong>{entry.action}</strong>
              <span>{entry.target}</span>
              <span>{entry.actorName}</span>
              <span>{formatDate(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function SmallGroupDirectorPanel({
  payload,
  onAction,
  onLinkGroupMe,
  onReload
}: {
  payload: VolunteerHubPayload;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onLinkGroupMe: (platformGroupId: string, groupMeGroupId: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [managedGroup, setManagedGroup] = useState<VolunteerHubSmallGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const serviceOptions = useMemo(() => uniqueServiceTimes([
    payload.activeGroup.serviceTime,
    ...payload.activeGroups.map((group) => group.serviceTime),
    ...payload.archivedGroups.map((group) => group.serviceTime),
    ...defaultServiceTimes
  ]), [payload.activeGroup.serviceTime, payload.activeGroups, payload.archivedGroups]);
  const serviceBuckets = useMemo(() => groupSmallGroupsByService(payload.activeGroups), [payload.activeGroups]);
  const [serviceTime, setServiceTime] = useState(payload.activeGroup.serviceTime || serviceOptions[0] || defaultServiceTimes[0]);
  const [leaderId, setLeaderId] = useState(payload.volunteers[0]?.id ?? "");
  const [groupMeGroups, setGroupMeGroups] = useState<GroupMeChoice[]>([]);
  const [loadingGroupMe, setLoadingGroupMe] = useState(false);
  const [groupMeError, setGroupMeError] = useState("");
  const groupMeDisplayStatus = payload.integrations.groupMe.displayStatus;

  const loadGroupMeGroups = useCallback(async () => {
    if (groupMeDisplayStatus !== "connected") return;
    setLoadingGroupMe(true);
    setGroupMeError("");
    try {
      const response = await fetch("/api/integrations/groupme/groups", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { groups?: GroupMeChoice[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "GroupMe conversations could not be loaded.");
      setGroupMeGroups(body.groups ?? []);
    } catch (error) {
      setGroupMeError(error instanceof Error ? error.message : "GroupMe conversations could not be loaded.");
    } finally {
      setLoadingGroupMe(false);
    }
  }, [groupMeDisplayStatus]);

  useEffect(() => {
    void loadGroupMeGroups();
  }, [loadGroupMeGroups]);

  return (
    <article className="volunteer-hub-panel volunteer-hub-span-3">
      <div className="volunteer-panel-head">
        <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Small Groups" title="Small groups by service" />
        <div className="volunteer-card-actions">
          {groupMeDisplayStatus !== "connected" && payload.dataSource === "live" ? (
            <a className="button" href="/api/integrations/groupme/connect"><Link2 aria-hidden="true" />Connect GroupMe</a>
          ) : null}
          {!payload.readOnlyReason ? <button className="button primary" type="button" onClick={() => setCreating((value) => !value)}><Plus aria-hidden="true" />Create Service Group</button> : null}
        </div>
      </div>
      {payload.dataSource === "live" ? (
        <div className="volunteer-groupme-population" role="status" aria-live="polite">
          <Link2 aria-hidden="true" />
          <div>
            <strong>{groupMeStatusHeadline(groupMeDisplayStatus, groupMeGroups.length, loadingGroupMe)}</strong>
            <p>{groupMeError || groupMePopulationDetail(groupMeDisplayStatus, groupMeGroups.length, payload.integrations.groupMe.message)}</p>
          </div>
          {groupMeDisplayStatus === "connected" ? (
            <button className="button compact-button" type="button" disabled={loadingGroupMe} onClick={() => void loadGroupMeGroups()}>
              {loadingGroupMe ? <LoaderCircle className="volunteer-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Refresh conversations
            </button>
          ) : null}
        </div>
      ) : null}
      {creating ? (
        <form className="volunteer-create-group" onSubmit={(event) => {
          event.preventDefault();
          void onAction({ type: "create_group", name, room, serviceTime, leaderId }, "Small group created.").then(() => {
            setName("");
            setRoom("");
            setCreating(false);
          });
        }}>
          <label className="field"><span>Service</span><input className="input" list="volunteer-service-times" required value={serviceTime} onChange={(event) => setServiceTime(event.target.value)} placeholder="Sunday - 10:30 AM" /></label>
          <label className="field"><span>Group name</span><input className="input" required value={name} onChange={(event) => setName(event.target.value)} placeholder="9th Grade Girls" /></label>
          <label className="field"><span>Primary leader</span><select className="input" value={leaderId} onChange={(event) => setLeaderId(event.target.value)}><option value="">Unassigned</option>{payload.volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name}</option>)}</select></label>
          <label className="field"><span>Room</span><input className="input" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Room 204" /></label>
          <datalist id="volunteer-service-times">
            {serviceOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
          <button className="button primary" type="submit">Create and manage roster</button>
        </form>
      ) : null}
      <div className="volunteer-service-group-list">
        {serviceBuckets.length ? serviceBuckets.map((bucket) => (
          <section className="volunteer-service-group" key={bucket.serviceTime} aria-label={`${bucket.serviceTime} small groups`}>
            <header className="volunteer-service-group-head">
              <div>
                <span className="eyebrow">{bucket.serviceTime}</span>
                <strong>{bucket.groups.length} {bucket.groups.length === 1 ? "group" : "groups"} - {bucket.studentCount} {bucket.studentCount === 1 ? "student" : "students"}</strong>
              </div>
              {!payload.readOnlyReason ? (
                <button className="button compact-button" type="button" onClick={() => {
                  setServiceTime(bucket.serviceTime);
                  setCreating(true);
                }}>
                  <Plus aria-hidden="true" />New group
                </button>
              ) : null}
            </header>
            <div className="volunteer-group-card-grid">
              {bucket.groups.map((group) => (
                <GroupCard key={group.id} group={group} volunteers={payload.volunteers} persisted={payload.dataSource !== "live" || isUuid(group.id)} onManage={() => setManagedGroup(group)} onArchive={(reason) => onAction({ type: "archive_group", groupId: group.id, reason }, "Small group archived.")} />
              ))}
            </div>
          </section>
        )) : <EmptyState title="No active small groups" detail="Create the first group for a service, then assign leaders and students." />}
      </div>
      <h3 className="volunteer-subtitle">Archived small groups</h3>
      <div className="volunteer-group-card-grid">
        {payload.archivedGroups.length ? payload.archivedGroups.map((group) => (
          <article className="volunteer-group-card archived" key={group.id}>
            <strong>{group.name}</strong>
            <p>{group.archiveReason ?? "Archived."}</p>
            <button className="button compact-button" type="button" onClick={() => onAction({ type: "restore_group", groupId: group.id }, "Small group restored.")}>
              <RotateCcw aria-hidden="true" />Restore
            </button>
          </article>
        )) : <p className="muted">No small groups are archived.</p>}
      </div>
      {managedGroup ? (
        <ManageGroupDialog
          group={managedGroup}
          volunteers={payload.volunteers}
          students={payload.studentRoster}
          serviceOptions={serviceOptions}
          groupMeStatus={groupMeDisplayStatus}
          groupMeGroups={groupMeGroups}
          loadingGroupMe={loadingGroupMe}
          onAction={onAction}
          onLinkGroupMe={onLinkGroupMe}
          onReload={onReload}
          onClose={() => setManagedGroup(null)}
        />
      ) : null}
    </article>
  );
}

function GroupCard({
  group,
  volunteers,
  persisted,
  onManage,
  onArchive
}: {
  group: VolunteerHubSmallGroup;
  volunteers: VolunteerHubVolunteer[];
  persisted: boolean;
  onManage: () => void;
  onArchive: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const leader = volunteers.find((volunteer) => volunteer.id === group.leaderId);
  return (
    <article className="volunteer-group-card">
      {persisted ? <button className="volunteer-group-menu-button" type="button" aria-label={`Open ${group.name} small group menu`} onClick={onManage}>
        <UsersRound aria-hidden="true" />
      </button> : null}
      <strong>{group.name}</strong>
      <span>{group.room} - {group.serviceTime}</span>
      <p>{leader?.name ?? "Unassigned"} leads {group.memberStudentIds.length} {group.memberStudentIds.length === 1 ? "student" : "students"}.</p>
      {group.groupMeConnected ? <StatusBadge tone="success">{group.groupMeGroupName ?? "GroupMe linked"}</StatusBadge> : <StatusBadge tone="warning">GroupMe not linked</StatusBadge>}
      {persisted ? <button className="button compact-button" type="button" onClick={onManage}>Manage Group</button> : <p className="muted">Create a permanent group to assign this imported roster.</p>}
      {persisted ? <label className="field volunteer-archive-reason">
        <span>Archive reason</span>
        <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Consolidated with another group" />
      </label> : null}
      {persisted ? <button className="button compact-button danger" type="button" onClick={() => onArchive(reason)}>
        <Archive aria-hidden="true" />Archive small group
      </button> : null}
    </article>
  );
}

function ManageGroupDialog({
  group,
  volunteers,
  students,
  serviceOptions,
  groupMeStatus,
  groupMeGroups,
  loadingGroupMe,
  onAction,
  onLinkGroupMe,
  onReload,
  onClose
}: {
  group: VolunteerHubSmallGroup;
  volunteers: VolunteerHubVolunteer[];
  students: VolunteerHubStudent[];
  serviceOptions: string[];
  groupMeStatus: VolunteerHubPayload["integrations"]["groupMe"]["displayStatus"];
  groupMeGroups: GroupMeChoice[];
  loadingGroupMe: boolean;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
  onLinkGroupMe: (platformGroupId: string, groupMeGroupId: string) => Promise<void>;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [leaderId, setLeaderId] = useState(group.leaderId);
  const [coLeaderId, setCoLeaderId] = useState(group.coLeaderId ?? "");
  const [room, setRoom] = useState(group.room);
  const [serviceTime, setServiceTime] = useState(group.serviceTime);
  const [memberStudentIds, setMemberStudentIds] = useState(group.memberStudentIds);
  const [studentQuery, setStudentQuery] = useState("");
  const [groupMeGroupId, setGroupMeGroupId] = useState(group.groupMeGroupId ?? "");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const filteredStudents = students.filter((student) => {
    const query = studentQuery.trim().toLowerCase();
    return !query || `${student.fullName} ${student.grade} ${student.school}`.toLowerCase().includes(query);
  });

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setDialogError("");
    try {
      await onAction({
        type: "update_group",
        groupId: group.id,
        name,
        leaderId,
        coLeaderId,
        room,
        serviceTime,
        memberStudentIds
      }, "Small group leaders and roster updated.");
      if (groupMeGroupId && groupMeGroupId !== group.groupMeGroupId) {
        await onLinkGroupMe(group.id, groupMeGroupId);
      }
      await onReload();
      onClose();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Small group could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="ministry-people-modal-backdrop" role="presentation">
      <section className="ministry-people-modal volunteer-manage-group-dialog" role="dialog" aria-modal="true" aria-label="Manage Small Group">
        <div className="ministry-people-modal-head">
          <div>
            <h3>Manage Small Group</h3>
            <p>Assign leaders, build the student roster, set the meeting details, and link the correct GroupMe conversation.</p>
          </div>
          <button className="button compact-button" type="button" onClick={onClose}>Close</button>
        </div>
        <form className="volunteer-manage-group-form" onSubmit={saveGroup}>
          <div className="volunteer-manage-group-fields">
            <label className="field"><span>Group name</span><input className="input" required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>Leader</span><select className="input" value={leaderId} onChange={(event) => setLeaderId(event.target.value)}><option value="">Unassigned</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name} - {volunteer.role}</option>)}</select></label>
            <label className="field"><span>Co-Leader</span><select className="input" value={coLeaderId} onChange={(event) => setCoLeaderId(event.target.value)}><option value="">Open slot</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name} - {volunteer.role}</option>)}</select></label>
            <label className="field"><span>Room</span><input className="input" value={room} onChange={(event) => setRoom(event.target.value)} /></label>
            <label className="field"><span>Service</span><input className="input" list="volunteer-manage-service-times" value={serviceTime} onChange={(event) => setServiceTime(event.target.value)} /></label>
            <datalist id="volunteer-manage-service-times">
              {serviceOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
            <label className="field"><span>GroupMe conversation</span><select className="input" disabled={groupMeStatus !== "connected" || loadingGroupMe} value={groupMeGroupId} onChange={(event) => setGroupMeGroupId(event.target.value)}><option value="">{loadingGroupMe ? "Loading conversations..." : "Not linked"}</option>{groupMeGroups.map((choice) => <option key={choice.id} value={choice.id}>{choice.name} ({choice.memberCount})</option>)}</select></label>
          </div>
          <fieldset className="volunteer-member-picker">
            <legend>Students in this group <span>{memberStudentIds.length} selected</span></legend>
            <label className="volunteer-member-search"><Search aria-hidden="true" /><span className="sr-only">Search students</span><input className="input" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search name, grade, or school" /></label>
            <div className="volunteer-member-list">
              {filteredStudents.map((student) => {
                const selected = memberStudentIds.includes(student.id);
                return (
                  <label className={selected ? "selected" : ""} key={student.id}>
                    <input type="checkbox" checked={selected} onChange={() => setMemberStudentIds((current) => selected ? current.filter((id) => id !== student.id) : [...current, student.id])} />
                    <span className="volunteer-avatar" aria-hidden="true">{initials(student.preferredName)}</span>
                    <span><strong>{student.fullName}</strong><small>{student.grade} - {student.school}</small></span>
                    {selected ? <Check aria-hidden="true" /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {dialogError ? <p className="volunteer-hub-error" role="alert">{dialogError}</p> : null}
          <div className="volunteer-card-actions volunteer-manage-actions">
            <button className="button" type="button" onClick={onClose}>Cancel</button>
            <button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="volunteer-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{saving ? "Saving..." : "Save group"}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

function LeaderPoolPanel({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Small Group Coach");
  const [sourceChurch, setSourceChurch] = useState("Lead Emergence");
  return (
    <article className="volunteer-hub-panel volunteer-hub-span-3">
      <div className="volunteer-panel-head">
        <SectionTitle icon={<UserRound aria-hidden="true" />} eyebrow="Leader Pool" title="Small group leaders" />
        {payload.readOnlyReason ? null : <button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>Add Leader</button>}
      </div>
      {open ? (
        <form className="ministry-people-add-leader-form volunteer-leader-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void onAction({ type: "add_leader", name, email, role, sourceChurch }, "Volunteer leader added.").then(() => {
            setName("");
            setEmail("");
            setRole("Small Group Coach");
            setSourceChurch("Lead Emergence");
            setOpen(false);
          });
        }}>
          <label className="field"><span>Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Role label</span><input className="input" value={role} onChange={(event) => setRole(event.target.value)} /></label>
          <label className="field"><span>Email</span><input className="input" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span>Source church</span><input className="input" value={sourceChurch} onChange={(event) => setSourceChurch(event.target.value)} /></label>
          <button className="button primary" type="submit">Save Leader</button>
        </form>
      ) : null}
      <div className="volunteer-leader-list">
        {payload.volunteers.length ? payload.volunteers.map((volunteer) => (
          <div className="ministry-people-leader-row volunteer-leader-row" key={volunteer.id}>
            <span className="volunteer-avatar" aria-hidden="true">{initials(volunteer.name)}</span>
            <strong>{volunteer.name}</strong>
            <span>{volunteer.role}</span>
            <span>{volunteer.email}</span>
            <button className="button compact-button" type="button" disabled={Boolean(payload.readOnlyReason) || volunteer.role === "admin" || volunteer.role === "director"} aria-label={`Delete leader ${volunteer.name}`} onClick={() => onAction({ type: "delete_leader", volunteerId: volunteer.id }, "Volunteer leader removed.")}>
              Delete
            </button>
          </div>
        )) : <EmptyState title="No registered volunteers yet" detail="Registered leader profiles will appear here when they are added to this ministry." />}
      </div>
    </article>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="volunteer-hub-panel volunteer-metric">
      <span className="volunteer-metric-icon">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong><p>{detail}</p></div>
    </article>
  );
}

function uniqueServiceTimes(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function groupMeStatusHeadline(status: VolunteerHubPayload["integrations"]["groupMe"]["displayStatus"], groupCount: number, loading: boolean) {
  if (loading) return "Loading GroupMe conversations";
  if (status === "connected") return groupCount ? `${groupCount} GroupMe conversations available` : "GroupMe connected";
  if (status === "not_configured") return "GroupMe setup needed";
  if (status === "storage_unavailable") return "GroupMe storage unavailable";
  if (status === "error") return "GroupMe needs attention";
  return "GroupMe not connected";
}

function groupMePopulationDetail(status: VolunteerHubPayload["integrations"]["groupMe"]["displayStatus"], groupCount: number, fallback: string) {
  if (status === "connected" && groupCount) return "Choose Manage Group on a small group, then select the matching conversation.";
  if (status === "connected") return "No conversations were returned for the connected GroupMe account. Refresh or reconnect with the account that owns the ministry groups.";
  return fallback;
}

function groupSmallGroupsByService(groups: VolunteerHubSmallGroup[]): ServiceGroupBucket[] {
  const buckets = new Map<string, VolunteerHubSmallGroup[]>();
  groups.forEach((group) => {
    const serviceTime = group.serviceTime.trim() || "Unscheduled service";
    buckets.set(serviceTime, [...(buckets.get(serviceTime) ?? []), group]);
  });
  return Array.from(buckets.entries())
    .map(([serviceTime, serviceGroups]) => ({
      serviceTime,
      groups: serviceGroups,
      studentCount: serviceGroups.reduce((sum, group) => sum + group.memberStudentIds.length, 0)
    }))
    .sort((left, right) => left.serviceTime.localeCompare(right.serviceTime));
}

function LatestResources({ resources, onOpen }: { resources: VolunteerHubResource[]; onOpen: () => void }) {
  return (
    <article className="volunteer-hub-panel">
      <SectionTitle icon={<BookOpen aria-hidden="true" />} eyebrow="Latest Resources" title="Newest preparation" />
      <div className="volunteer-mini-list">{resources.length ? resources.slice(0, 5).map((resource) => <span key={resource.id}>{resource.title}</span>) : <EmptyState title="No resources yet" detail="Real resources will appear after they are published." />}</div>
      {resources.length ? <button className="button compact-button" type="button" onClick={onOpen}>Open resources</button> : null}
    </article>
  );
}

function NotificationsPanel({ payload, onOpen }: { payload: VolunteerHubPayload; onOpen: (tab: VolunteerTab) => void }) {
  const routeTab = (href: string): VolunteerTab => href.includes("training") ? "training" : href.includes("resources") ? "resources" : href.includes("attendance") ? "attendance" : "dashboard";
  return (
    <article className="volunteer-hub-panel">
      <SectionTitle icon={<Bell aria-hidden="true" />} eyebrow="Notifications" title="What changed" />
      <div className="volunteer-mini-list">
        {payload.notifications.length ? payload.notifications.map((notification) => (
          <button key={notification.id} type="button" onClick={() => onOpen(routeTab(notification.href))}>
            <strong>{notification.label}</strong>
            <span>{notification.detail}</span>
          </button>
        )) : <EmptyState title="No notifications" detail="You are seeing live account data, so no seeded notification feed is shown." />}
      </div>
    </article>
  );
}

function HubStatus({ integrations }: { integrations: VolunteerHubPayload["integrations"] }) {
  return (
    <div className="volunteer-hub-status">
      <StatusBadge tone={integrations.planningCenter.displayStatus === "connected" ? "success" : "warning"}>
        Planning Center: {integrations.planningCenter.displayStatus}
      </StatusBadge>
      <StatusBadge tone="info">{integrations.planningCenter.peopleCount} people refs</StatusBadge>
      <StatusBadge tone="info">{integrations.planningCenter.attendanceCount} attendance refs</StatusBadge>
      <StatusBadge tone={integrations.groupMe.displayStatus === "connected" ? "success" : "warning"}>
        GroupMe: {integrations.groupMe.displayStatus.replaceAll("_", " ")}
      </StatusBadge>
    </div>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return (
    <header className="volunteer-section-title">
      <span>{icon}</span>
      <div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>
    </header>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "V";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="volunteer-hub-panel">
      <EmptyState title={title} detail={detail} />
    </article>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="volunteer-empty-state">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
