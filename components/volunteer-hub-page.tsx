"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/platform-ui";
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

export function VolunteerHubPage({ mode = "volunteer" }: { mode?: VolunteerHubMode }) {
  const [payload, setPayload] = useState<VolunteerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<VolunteerTab>("dashboard");

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

  useEffect(() => {
    void load();
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
        <DirectorDashboard payload={payload} onAction={act} />
      ) : (
        <>
          <nav className="volunteer-hub-tabs" aria-label="Volunteer Hub sections">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>
          <VolunteerTabContent payload={payload} activeTab={activeTab} onTabChange={setActiveTab} onAction={act} />
          {payload.role === "admin" || payload.role === "director" || payload.role === "leader" ? (
            <div className="volunteer-hub-grid" aria-label="Volunteer Hub operations">
              <SmallGroupDirectorPanel payload={payload} onAction={act} />
              <LeaderPoolPanel payload={payload} onAction={act} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function VolunteerTabContent({
  payload,
  activeTab,
  onTabChange,
  onAction
}: {
  payload: VolunteerHubPayload;
  activeTab: VolunteerTab;
  onTabChange: (tab: VolunteerTab) => void;
  onAction: (action: VolunteerHubAction, success: string) => Promise<void>;
}) {
  if (activeTab === "group") return <SmallGroupWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "students") return <StudentsWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "attendance") return <AttendanceWorkspace payload={payload} onAction={onAction} />;
  if (activeTab === "chat") return <ChatWorkspace payload={payload} onAction={onAction} />;
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
  const actionsEnabled = payload.dataSource !== "live";
  return (
    <div className="volunteer-hub-grid">
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Permanent Small Group Workspace" title={payload.activeGroup.name} />
        <div className="volunteer-group-summary">
          <span><strong>Leader</strong>{leader?.name ?? "Unassigned"}</span>
          <span><strong>Co-Leader</strong>{coLeader?.name ?? "Open slot"}</span>
          <span><strong>Students</strong>{payload.students.length}</span>
          <span><strong>GroupMe</strong>{payload.activeGroup.groupMeConnected ? "Connected" : "Preview only"}</span>
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
      <div className="volunteer-avatar" aria-hidden="true">{student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" /> : initials(student.preferredName)}</div>
      <h3>{student.preferredName}</h3>
      <p>{student.grade} - {student.school}</p>
      <div className="volunteer-student-tags">
        <StatusBadge tone={student.attendanceStatus === "present" ? "success" : student.attendanceStatus === "absent" ? "warning" : "info"}>{student.attendanceStatus}</StatusBadge>
        {student.followUpNeeded ? <StatusBadge tone="warning">Needs follow-up</StatusBadge> : null}
        {student.prayerRequestIndicator ? <StatusBadge tone="info">Prayer indicator</StatusBadge> : null}
        {student.source === "camp_clc" ? <StatusBadge tone="info">Camp CLC</StatusBadge> : null}
      </div>
      <dl className="volunteer-facts">
        {student.teamName ? <div><dt>Team</dt><dd>{student.teamName}</dd></div> : null}
        {student.cabin ? <div><dt>Room</dt><dd>{student.cabin}</dd></div> : null}
        {student.vehicleName ? <div><dt>Vehicle</dt><dd>{student.vehicleName}</dd></div> : null}
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
  const [team, setTeam] = useState("all");
  const [source, setSource] = useState("all");
  const teams = useMemo(
    () => Array.from(new Set(payload.studentRoster.map((student) => student.teamName).filter((value): value is string => Boolean(value)))).sort(),
    [payload.studentRoster]
  );
  const filtered = payload.studentRoster.filter((student) => {
    const text = `${student.preferredName} ${student.fullName} ${student.grade} ${student.teamName ?? ""} ${student.cabin ?? ""}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase()))
      && (team === "all" || student.teamName === team)
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
          <label className="field"><span>Search</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, grade, team, or room" /></label>
          <label className="field"><span>Team</span><select className="input" value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">All teams</option>{teams.map((teamName) => <option key={teamName} value={teamName}>{teamName}</option>)}</select></label>
          <label className="field"><span>Source</span><select className="input" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option><option value="camp_clc">Camp CLC</option><option value="planning_center">Planning Center</option><option value="demo">Demo</option></select></label>
        </div>
      </article>
      {filtered.length ? filtered.map((student) => (
        <StudentCard key={student.id} student={student} actionsEnabled={actionsEnabled} onAction={onAction} />
      )) : <EmptyPanel title="No students match these filters" detail="Adjust the search, team, or source filters to widen the roster view." />}
    </div>
  );
}

function AttendanceWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const actionsEnabled = !payload.readOnlyReason;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<ClipboardCheck aria-hidden="true" />} label="Assigned" value={String(payload.attendance.assigned)} detail="Students assigned to your active small group." />
      <MetricCard icon={<CheckCircle2 aria-hidden="true" />} label="Present" value={String(payload.attendance.present)} detail={`${payload.attendance.attendancePercent}% attendance from latest imported snapshot.`} />
      <MetricCard icon={<Bell aria-hidden="true" />} label="Need Follow-up" value={String(payload.attendance.needFollowUp)} detail="Suggestions only. No automatic messages are sent." />
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<ClipboardCheck aria-hidden="true" />} eyebrow="Attendance Dashboard" title="Planning Center-backed snapshot" />
        <p className="muted">Planning Center remains the source of truth. This V1 displays safe operational summaries and stores only review state in the Volunteer Hub preview.</p>
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

function ChatWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [resourceId, setResourceId] = useState("");
  const actionsEnabled = payload.dataSource !== "live";
  return (
    <div className="volunteer-hub-grid">
      <article className="volunteer-hub-panel volunteer-hub-span-2">
        <SectionTitle icon={<MessageSquareText aria-hidden="true" />} eyebrow="Group Chat" title={`${payload.activeGroup.name} conversation`} />
        <p className="muted">{payload.integrations.groupMe.message}</p>
        <div className="volunteer-chat-window">
          {payload.chatMessages.length ? payload.chatMessages.map((chat) => (
            <div className="volunteer-chat-message" key={chat.id}>
              <strong>{chat.senderName}</strong>
              <p>{chat.body}</p>
              <small>{formatDate(chat.createdAt)} - Preview only{chat.resourceId ? " - resource attached" : ""}</small>
            </div>
          )) : <EmptyState title="No stored messages" detail="No demo chat history is shown for registered production users." />}
        </div>
      </article>
      {actionsEnabled ? <form className="volunteer-hub-panel volunteer-chat-composer" onSubmit={(event) => {
        event.preventDefault();
        void onAction({ type: "preview_chat_message", groupId: payload.activeGroup.id, body: message, resourceId: resourceId || undefined }, "GroupMe preview logged. Nothing was sent.").then(() => {
          setMessage("");
          setResourceId("");
        });
      }}>
        <SectionTitle icon={<Send aria-hidden="true" />} eyebrow="Composer" title="Preview a message" />
        <label className="field"><span>Message</span><textarea className="input" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <label className="field"><span>Attach platform resource</span><select className="input" value={resourceId} onChange={(event) => setResourceId(event.target.value)}>
          <option value="">No resource</option>
          {payload.resources.filter((resource) => resource.shareable).map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
        </select></label>
        <button className="button primary" type="submit"><Send aria-hidden="true" />Preview message</button>
      </form> : null}
    </div>
  );
}

function ResourcesWorkspace({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  return (
    <div className="volunteer-hub-grid">
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<BookOpen aria-hidden="true" />} eyebrow="Weekly Resources" title={payload.resources.length ? "Published preparation" : "No resources published yet"} />
        <p className="muted">Preparation estimate: {payload.resources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0)} minutes.</p>
      </article>
      {payload.resources.length ? payload.resources.map((resource) => (
        <ResourceCard key={resource.id} groupId={payload.activeGroup.id} resource={resource} onAction={onAction} />
      )) : <EmptyPanel title="No weekly resources yet" detail="Published leader guides, audio, notes, or parent resources will appear here when they are created for this ministry." />}
    </div>
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
  const actionsEnabled = payload.dataSource !== "live";
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

function DirectorDashboard({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const activeGroupStudents = payload.activeGroups.reduce((sum, group) => sum + group.memberStudentIds.length, 0);
  const completedTraining = payload.trainingModules.filter((module) => module.completed).length;
  return (
    <div className="volunteer-hub-grid">
      <MetricCard icon={<UsersRound aria-hidden="true" />} label="Active Small Groups" value={String(payload.activeGroups.length)} detail={`${activeGroupStudents} assigned students in active groups.`} />
      <MetricCard icon={<ShieldCheck aria-hidden="true" />} label="Training Completion" value={`${completedTraining}/${payload.trainingModules.length}`} detail="Quarterly leader-readiness modules." />
      <MetricCard icon={<Archive aria-hidden="true" />} label="Archived Groups" value={String(payload.archivedGroups.length)} detail="Reversible archive for consolidated groups." />
      <SmallGroupDirectorPanel payload={payload} onAction={onAction} />
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

function SmallGroupDirectorPanel({ payload, onAction }: { payload: VolunteerHubPayload; onAction: (action: VolunteerHubAction, success: string) => Promise<void> }) {
  const [managedGroup, setManagedGroup] = useState<VolunteerHubSmallGroup | null>(null);
  if (payload.dataSource === "live") {
    return (
      <article className="volunteer-hub-panel volunteer-hub-span-3">
        <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Live Roster" title="Planning Center-backed student refs" />
        <div className="volunteer-group-card-grid">
          {payload.activeGroups.map((group) => (
            <article className="volunteer-group-card" key={group.id}>
              <strong>{group.name}</strong>
              <span>{group.room} - {group.serviceTime}</span>
              <p>{group.memberStudentIds.length} student refs are available. Group assignment and archive controls need persistent Volunteer Hub tables before they can be enabled.</p>
            </article>
          ))}
        </div>
      </article>
    );
  }
  return (
    <article className="volunteer-hub-panel volunteer-hub-span-3">
      <SectionTitle icon={<UsersRound aria-hidden="true" />} eyebrow="Small Groups" title="Active and archived small groups" />
      <div className="volunteer-group-card-grid">
        {payload.activeGroups.map((group) => (
          <GroupCard key={group.id} group={group} volunteers={payload.volunteers} onManage={() => setManagedGroup(group)} onArchive={(reason) => onAction({ type: "archive_group", groupId: group.id, reason }, "Small group archived.")} />
        ))}
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
      {managedGroup ? <ManageGroupDialog group={managedGroup} volunteers={payload.volunteers} onClose={() => setManagedGroup(null)} /> : null}
    </article>
  );
}

function GroupCard({
  group,
  volunteers,
  onManage,
  onArchive
}: {
  group: VolunteerHubSmallGroup;
  volunteers: VolunteerHubVolunteer[];
  onManage: () => void;
  onArchive: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const leader = volunteers.find((volunteer) => volunteer.id === group.leaderId);
  return (
    <article className="volunteer-group-card">
      <button className="volunteer-group-menu-button" type="button" aria-label={`Open ${group.name} small group menu`} onClick={onManage}>
        <UsersRound aria-hidden="true" />
      </button>
      <strong>{group.name}</strong>
      <span>{group.room} - {group.serviceTime}</span>
      <p>{leader?.name ?? "Unassigned"} leads {group.memberStudentIds.length} students.</p>
      <button className="button compact-button" type="button" onClick={onManage}>Manage Group</button>
      <label className="field volunteer-archive-reason">
        <span>Archive reason</span>
        <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Consolidated with another group" />
      </label>
      <button className="button compact-button danger" type="button" onClick={() => onArchive(reason)}>
        <Archive aria-hidden="true" />Archive small group
      </button>
    </article>
  );
}

function ManageGroupDialog({ group, volunteers, onClose }: { group: VolunteerHubSmallGroup; volunteers: VolunteerHubVolunteer[]; onClose: () => void }) {
  return (
    <div className="ministry-people-modal-backdrop" role="presentation">
      <section className="ministry-people-modal" role="dialog" aria-modal="true" aria-label="Manage Small Group">
        <div className="ministry-people-modal-head">
          <div>
            <h3>Manage Small Group</h3>
            <p>{group.name} is managed from the Volunteer Hub V1 preview. Archive/restore is active; leader reassignment will persist with the production schema.</p>
          </div>
          <button className="button compact-button" type="button" onClick={onClose}>Close</button>
        </div>
        <label className="field"><span>Leader</span><select className="input" defaultValue={group.leaderId}>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name} - {volunteer.role}</option>)}</select></label>
        <label className="field"><span>Co-Leader</span><select className="input" defaultValue={group.coLeaderId ?? ""}><option value="">Open slot</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name} - {volunteer.role}</option>)}</select></label>
        <label className="field"><span>Room</span><input className="input" defaultValue={group.room} /></label>
      </section>
    </div>
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
      <StatusBadge tone="warning">GroupMe preview-only</StatusBadge>
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
