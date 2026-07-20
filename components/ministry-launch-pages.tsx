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
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound
} from "lucide-react";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import { EditorialSection, PageIntro } from "@/components/platform-ui";
import { PlanningCenterIntegrationControl } from "@/components/planning-center-integration-control";
import type { CampStaffMember } from "@/lib/camp/types";
import type { MinistryEmmaPage } from "@/lib/emma/ministry-page-assistant";
import type { ActiveTask, ActivityLog, EventExpense, MinistryEvent, User } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";
import {
  createLocalLeaderId,
  loadCustomVolunteerLeaders,
  loadDeletedVolunteerLeaderIds,
  loadEventLeaderAssignments,
  mergeVolunteerLeaders,
  removeLeaderFromAssignments,
  saveCustomVolunteerLeaders,
  saveDeletedVolunteerLeaderIds,
  saveEventLeaderAssignments,
  type VolunteerLeader
} from "@/lib/volunteer-leaders";

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

type PeopleLeader = VolunteerLeader;

type SmallGroup = {
  id: string;
  name: string;
  leaderIds: [string, string];
  room: string;
  focus: string;
  memberCount: number;
};

type SmallGroupService = {
  id: string;
  name: string;
  serviceType: "permanent" | "one-time";
  groups: SmallGroup[];
};

const SMALL_GROUP_SERVICES_KEY = "lead-emergence.volunteer-hub.small-group-services.v1";

function loadSmallGroupServices() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(SMALL_GROUP_SERVICES_KEY);
    return stored ? (JSON.parse(stored) as SmallGroupService[]) : [];
  } catch {
    return [];
  }
}

function saveSmallGroupServices(services: SmallGroupService[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SMALL_GROUP_SERVICES_KEY, JSON.stringify(services));
}

type CampStaffState =
  | { status: "loading"; staff: CampStaffMember[] }
  | { status: "ready"; staff: CampStaffMember[] }
  | { status: "error"; staff: CampStaffMember[] };

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
  const [campStaffState, setCampStaffState] = useState<CampStaffState>({ status: "loading", staff: [] });
  const [services, setServices] = useState<SmallGroupService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceType, setNewServiceType] = useState<SmallGroupService["serviceType"]>("permanent");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [editingGroup, setEditingGroup] = useState<SmallGroup | null>(null);
  const [customVolunteerLeaders, setCustomVolunteerLeaders] = useState<PeopleLeader[]>([]);
  const [deletedVolunteerLeaderIds, setDeletedVolunteerLeaderIds] = useState<string[]>([]);
  const [leaderFormOpen, setLeaderFormOpen] = useState(false);
  const [newLeaderName, setNewLeaderName] = useState("");
  const [newLeaderRole, setNewLeaderRole] = useState("Leader");
  const [newLeaderEmail, setNewLeaderEmail] = useState("");
  const [newLeaderSourceChurch, setNewLeaderSourceChurch] = useState("");
  const [newLeaderPhotoUrl, setNewLeaderPhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const owners = overview.users.filter((user) => user.role === "admin" || user.role === "leader");

  useEffect(() => {
    setCustomVolunteerLeaders(loadCustomVolunteerLeaders());
    setDeletedVolunteerLeaderIds(loadDeletedVolunteerLeaderIds());
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/camp", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setCampStaffState({ status: "error", staff: [] });
          return;
        }
        const payload = (await response.json()) as { staff?: CampStaffMember[] };
        setCampStaffState({ status: "ready", staff: payload.staff ?? [] });
      })
      .catch(() => {
        if (active) setCampStaffState({ status: "error", staff: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const baseLeaderPool = useMemo(() => buildPeopleLeaderPool(campStaffState.staff, owners), [campStaffState.staff, owners]);
  const leaderPool = useMemo(
    () => mergeVolunteerLeaders(baseLeaderPool, customVolunteerLeaders, deletedVolunteerLeaderIds),
    [baseLeaderPool, customVolunteerLeaders, deletedVolunteerLeaderIds]
  );

  useEffect(() => {
    if (campStaffState.status === "loading" || services.length) return;
    const storedServices = loadSmallGroupServices();
    const seeded = storedServices.length ? storedServices : buildInitialSmallGroupServices(leaderPool);
    setServices(seeded);
    setSelectedServiceId(seeded[0]?.id ?? "");
  }, [campStaffState.status, leaderPool, services.length]);

  useEffect(() => {
    if (services.length) saveSmallGroupServices(services);
  }, [services]);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];
  const selectedGroup = selectedService?.groups.find((group) => group.id === selectedGroupId);
  const totalGroups = services.reduce((sum, service) => sum + service.groups.length, 0);
  const leaderAssignments = selectedService
    ? selectedService.groups.reduce((sum, group) => sum + group.leaderIds.filter(Boolean).length, 0)
    : 0;
  const openLeaderSlots = selectedService
    ? selectedService.groups.reduce((sum, group) => sum + group.leaderIds.filter((leaderId) => !leaderId).length, 0)
    : 0;

  function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = newServiceName.trim();
    if (!trimmedName) return;
    const service: SmallGroupService = {
      id: uniqueId("service", trimmedName),
      name: trimmedName,
      serviceType: newServiceType,
      groups: buildSmallGroupsForService(trimmedName, leaderPool)
    };
    setServices((current) => [...current, service]);
    setSelectedServiceId(service.id);
    setNewServiceName("");
    setNewServiceType("permanent");
    setServiceFormOpen(false);
    setMessage(`${trimmedName} added as a ${newServiceType === "permanent" ? "permanent" : "one-time"} service.`);
  }

  function saveGroup() {
    if (!editingGroup || !selectedService) return;
    setServices((current) =>
      current.map((service) =>
        service.id === selectedService.id
          ? { ...service, groups: service.groups.map((group) => group.id === editingGroup.id ? editingGroup : group) }
          : service
      )
    );
    setSelectedGroupId(editingGroup.id);
    setEditingGroup(null);
    setMessage(`${editingGroup.name} updated for ${selectedService.name}.`);
  }

  function submitLeader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newLeaderName.trim();
    if (!name) return;
    const leader: PeopleLeader = {
      id: createLocalLeaderId(name),
      name,
      role: newLeaderRole.trim() || "Leader",
      email: newLeaderEmail.trim() || undefined,
      sourceChurch: newLeaderSourceChurch.trim() || undefined,
      profilePhotoUrl: newLeaderPhotoUrl.trim() || undefined
    };
    setCustomVolunteerLeaders((current) => {
      const next = [...current, leader];
      saveCustomVolunteerLeaders(next);
      return next;
    });
    setNewLeaderName("");
    setNewLeaderRole("Leader");
    setNewLeaderEmail("");
    setNewLeaderSourceChurch("");
    setNewLeaderPhotoUrl("");
    setLeaderFormOpen(false);
    setMessage(`${leader.name} added to the small-group leader pool.`);
  }

  function deleteLeader(leader: PeopleLeader) {
    setCustomVolunteerLeaders((current) => {
      const next = current.filter((item) => item.id !== leader.id);
      saveCustomVolunteerLeaders(next);
      return next;
    });
    setDeletedVolunteerLeaderIds((current) => {
      const next = current.includes(leader.id) ? current : [...current, leader.id];
      saveDeletedVolunteerLeaderIds(next);
      return next;
    });
    setServices((current) =>
      current.map((service) => ({
        ...service,
        groups: service.groups.map((group) => ({
          ...group,
          leaderIds: group.leaderIds.map((leaderId) => leaderId === leader.id ? "" : leaderId) as [string, string]
        }))
      }))
    );
    saveEventLeaderAssignments(removeLeaderFromAssignments(loadEventLeaderAssignments(), leader.id));
    setMessage(`${leader.name} removed from visible leader assignments.`);
  }

  return (
    <div className="ministry-launch-grid ministry-people-board">
      <LaunchMetric icon={<ShieldCheck aria-hidden="true" />} label="Emerge leaders" value={String(leaderPool.length)} detail={campStaffState.status === "ready" && campStaffState.staff.length ? "Loaded from safe Camp staff records" : "Using platform leader profiles"} tone="cyan" />
      <LaunchMetric icon={<UsersRound aria-hidden="true" />} label="Small groups" value={String(totalGroups)} detail="Across configured services" tone="gold" />
      <LaunchMetric icon={<Clock3 aria-hidden="true" />} label="Open leader slots" value={String(openLeaderSlots)} detail="Two leader slots remain visible on each group" tone="violet" />

      <section className="ministry-launch-panel ministry-launch-span-3 ministry-people-service-panel" aria-label="Small group services">
        <div className="ministry-people-toolbar">
          <SectionHead eyebrow="Small Groups" title="Small group coverage" />
          <div className="ministry-people-controls">
            <label className="field ministry-people-service-select">
              <span>Service</span>
              <select className="input" value={selectedService?.id ?? ""} onChange={(event) => setSelectedServiceId(event.target.value)}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="button" onClick={() => setServiceFormOpen(true)}>
              <Plus aria-hidden="true" />
              Add Service
            </button>
          </div>
        </div>
        {message ? <p className="ministry-launch-success" role="status">{message}</p> : null}
        {selectedService ? (
          <>
            <div className="ministry-people-service-summary" aria-label={`${selectedService.name} summary`}>
              <span className="pill blue">{selectedService.serviceType === "permanent" ? "Permanent" : "One-time"} service</span>
              <span>{selectedService.groups.length} groups</span>
              <span>{leaderAssignments} assigned leader slots</span>
              <span>{selectedService.groups.reduce((sum, group) => sum + group.memberCount, 0)} people placed</span>
            </div>
            <div className="ministry-people-group-grid">
              {selectedService.groups.map((group, index) => (
                <SmallGroupCard
                  key={group.id}
                  group={group}
                  accentClass={`tone-${index % 6}`}
                  leaders={leaderPool}
                  onSelect={() => setSelectedGroupId(group.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Loading small groups...</p>
        )}
      </section>

      <article className="ministry-launch-panel ministry-launch-span-2">
        <div className="ministry-people-toolbar">
          <SectionHead eyebrow="Leader Pool" title="Available Emerge leaders" />
          <button className="button primary" type="button" onClick={() => setLeaderFormOpen((current) => !current)}>
            <Plus aria-hidden="true" />
            Add Leader
          </button>
        </div>
        {leaderFormOpen ? (
          <form className="ministry-launch-form ministry-people-add-leader-form" onSubmit={submitLeader}>
            <label className="field">
              <span>Name</span>
              <input className="input" value={newLeaderName} onChange={(event) => setNewLeaderName(event.target.value)} placeholder="Leader name" required />
            </label>
            <div className="ministry-people-edit-grid">
              <label className="field">
                <span>Role label</span>
                <input className="input" value={newLeaderRole} onChange={(event) => setNewLeaderRole(event.target.value)} placeholder="Leader" />
              </label>
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" value={newLeaderEmail} onChange={(event) => setNewLeaderEmail(event.target.value)} placeholder="leader@example.com" />
              </label>
            </div>
            <div className="ministry-people-edit-grid">
              <label className="field">
                <span>Source church</span>
                <input className="input" value={newLeaderSourceChurch} onChange={(event) => setNewLeaderSourceChurch(event.target.value)} placeholder="Emerge" />
              </label>
              <label className="field">
                <span>Photo URL</span>
                <input className="input" value={newLeaderPhotoUrl} onChange={(event) => setNewLeaderPhotoUrl(event.target.value)} placeholder="https://..." />
              </label>
            </div>
            <div className="ministry-people-modal-actions">
              <button className="button" type="button" onClick={() => setLeaderFormOpen(false)}>Cancel</button>
              <button className="button primary" type="submit">Save Leader</button>
            </div>
          </form>
        ) : null}
        <div className="ministry-people-leader-list">
          {leaderPool.map((leader) => (
            <LeaderPoolRow key={leader.id} leader={leader} selectedService={selectedService} onDelete={deleteLeader} />
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

      {serviceFormOpen ? (
        <ModalShell title="Add Service" description="Create a service view and seed it with the current Emerge leader pool." onClose={() => setServiceFormOpen(false)}>
          <form className="ministry-launch-form" onSubmit={submitService}>
            <label className="field">
              <span>Service name</span>
              <input className="input" value={newServiceName} onChange={(event) => setNewServiceName(event.target.value)} placeholder="Sunday night special" required />
            </label>
            <fieldset className="ministry-people-radio-group">
              <legend>Service type</legend>
              <label>
                <input type="radio" name="service-type" value="permanent" checked={newServiceType === "permanent"} onChange={() => setNewServiceType("permanent")} />
                <span>Permanent</span>
              </label>
              <label>
                <input type="radio" name="service-type" value="one-time" checked={newServiceType === "one-time"} onChange={() => setNewServiceType("one-time")} />
                <span>One-time service</span>
              </label>
            </fieldset>
            <div className="ministry-people-modal-actions">
              <button className="button" type="button" onClick={() => setServiceFormOpen(false)}>Cancel</button>
              <button className="button primary" type="submit">Add Service</button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {selectedGroup && selectedService ? (
        <ModalShell title={selectedGroup.name} description={`Manage leaders and room for ${selectedService.name}.`} onClose={() => setSelectedGroupId("")}>
          <div className="ministry-people-detail">
            <dl>
              <div>
                <dt>Leader</dt>
                <dd>{leaderNameById(selectedGroup.leaderIds[0], leaderPool) || "Open slot"}</dd>
              </div>
              <div>
                <dt>Co-leader</dt>
                <dd>{leaderNameById(selectedGroup.leaderIds[1], leaderPool) || "Open slot"}</dd>
              </div>
              <div>
                <dt>Room</dt>
                <dd>{selectedGroup.room}</dd>
              </div>
              <div>
                <dt>People</dt>
                <dd>{selectedGroup.memberCount}</dd>
              </div>
            </dl>
            <p>{selectedGroup.focus}</p>
            <div className="ministry-people-modal-actions">
              <button className="button" type="button" onClick={() => setSelectedGroupId("")}>Close</button>
              <button className="button primary" type="button" onClick={() => { setEditingGroup(selectedGroup); setSelectedGroupId(""); }}>Manage Group</button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editingGroup ? (
        <ModalShell title="Manage Small Group" description="Update the visible small group assignment." onClose={() => setEditingGroup(null)}>
          <div className="ministry-launch-form">
            <label className="field">
              <span>Group name</span>
              <input className="input" value={editingGroup.name} onChange={(event) => setEditingGroup({ ...editingGroup, name: event.target.value })} />
            </label>
            <div className="ministry-people-edit-grid">
              <LeaderAssignmentSelect label="Leader" value={editingGroup.leaderIds[0]} leaders={leaderPool} onChange={(leaderId) => setEditingGroup({ ...editingGroup, leaderIds: [leaderId, editingGroup.leaderIds[1]] })} />
              <LeaderAssignmentSelect label="Co-leader" value={editingGroup.leaderIds[1]} leaders={leaderPool} onChange={(leaderId) => setEditingGroup({ ...editingGroup, leaderIds: [editingGroup.leaderIds[0], leaderId] })} />
            </div>
            <label className="field">
              <span>Room</span>
              <input className="input" value={editingGroup.room} onChange={(event) => setEditingGroup({ ...editingGroup, room: event.target.value })} />
            </label>
            <label className="field">
              <span>Focus</span>
              <textarea className="input" rows={3} value={editingGroup.focus} onChange={(event) => setEditingGroup({ ...editingGroup, focus: event.target.value })} />
            </label>
            <div className="ministry-people-modal-actions">
              <button className="button" type="button" onClick={() => setEditingGroup(null)}>Cancel</button>
              <button className="button primary" type="button" onClick={saveGroup}>Save Changes</button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function SmallGroupCard({
  group,
  accentClass,
  leaders,
  onSelect
}: {
  group: SmallGroup;
  accentClass: string;
  leaders: PeopleLeader[];
  onSelect: () => void;
}) {
  return (
    <button className={`ministry-people-group-card ${accentClass}`} type="button" onClick={onSelect} aria-label={`Open ${group.name} small group menu`}>
      <div className="ministry-people-group-head">
        <span className="ministry-people-group-dot" aria-hidden="true" />
        <strong>{group.name}</strong>
        <span>{group.memberCount}</span>
      </div>
      <div className="ministry-people-group-body">
        <PeopleLeaderSlot roleLabel="Leader" leader={leaderById(group.leaderIds[0], leaders)} />
        <PeopleLeaderSlot roleLabel="Co-leader" leader={leaderById(group.leaderIds[1], leaders)} />
      </div>
      <div className="ministry-people-group-footer">
        <span>{group.room}</span>
        <span>Open group menu</span>
      </div>
    </button>
  );
}

function PeopleLeaderSlot({ roleLabel, leader }: { roleLabel: "Leader" | "Co-leader"; leader?: PeopleLeader }) {
  return (
    <span className={leader ? "ministry-people-leader-slot assigned" : "ministry-people-leader-slot empty"}>
      <span className="ministry-people-avatar" aria-hidden="true">
        {leader?.profilePhotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leader.profilePhotoUrl} alt="" />
          </>
        ) : (
          initialsForPerson(leader?.name ?? "")
        )}
      </span>
      <span>
        <span>{roleLabel}</span>
        <strong>{leader?.name ?? "Open slot"}</strong>
      </span>
    </span>
  );
}

function LeaderPoolRow({ leader, selectedService, onDelete }: { leader: PeopleLeader; selectedService?: SmallGroupService; onDelete: (leader: PeopleLeader) => void }) {
  const assignment = selectedService?.groups.find((group) => group.leaderIds.includes(leader.id));
  return (
    <div className="ministry-people-leader-row">
      <span className="ministry-people-avatar" aria-hidden="true">
        {leader.profilePhotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leader.profilePhotoUrl} alt="" />
          </>
        ) : (
          initialsForPerson(leader.name)
        )}
      </span>
      <span>
        <strong>{leader.name}</strong>
        <small>{leader.role}{leader.sourceChurch ? ` - ${leader.sourceChurch}` : ""}</small>
      </span>
      <span className="pill blue">{assignment?.name ?? "Available"}</span>
      <button className="button compact-button danger ministry-people-delete-leader" type="button" onClick={() => onDelete(leader)} aria-label={`Delete leader ${leader.name}`}>
        <Trash2 aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}

function LeaderAssignmentSelect({
  label,
  value,
  leaders,
  onChange
}: {
  label: string;
  value: string;
  leaders: PeopleLeader[];
  onChange: (leaderId: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Open slot</option>
        {leaders.map((leader) => (
          <option key={leader.id} value={leader.id}>
            {leader.name} - {leader.role}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ministry-people-modal-backdrop" role="presentation">
      <section className="ministry-people-modal" role="dialog" aria-modal="true" aria-labelledby={`${slugify(title)}-modal-title`} aria-describedby={`${slugify(title)}-modal-description`}>
        <div className="ministry-people-modal-head">
          <div>
            <h3 id={`${slugify(title)}-modal-title`}>{title}</h3>
            <p id={`${slugify(title)}-modal-description`}>{description}</p>
          </div>
          <button className="button compact-button" type="button" onClick={onClose}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function buildPeopleLeaderPool(campStaff: CampStaffMember[], owners: User[]): PeopleLeader[] {
  const activeCampStaff = campStaff.filter((member) => !member.archivedAt);
  const emergeCampStaff = activeCampStaff.filter((member) => {
    const source = member.sourceChurch?.toLowerCase() ?? "";
    return !source || source.includes("emerge") || source.includes("community life") || source.includes("clc");
  });
  const preferredStaff = emergeCampStaff.length ? emergeCampStaff : activeCampStaff;

  if (preferredStaff.length) {
    return preferredStaff.map((member) => ({
      id: `camp-${member.id}`,
      name: member.name,
      role: campStaffRoleLabel(member.role),
      profilePhotoUrl: member.profilePhotoUrl,
      sourceChurch: member.sourceChurch
    }));
  }

  return owners.map((user) => ({
    id: `user-${user.id}`,
    name: displayName(user),
    role: user.role === "admin" ? "Admin" : "Leader",
    email: user.email
  }));
}

function buildInitialSmallGroupServices(leaders: PeopleLeader[]): SmallGroupService[] {
  return [
    {
      id: "sunday-morning",
      name: "Sunday Morning",
      serviceType: "permanent",
      groups: buildSmallGroupsForService("Sunday Morning", leaders)
    },
    {
      id: "sunday-evening",
      name: "Sunday Evening",
      serviceType: "permanent",
      groups: buildSmallGroupsForService("Sunday Evening", rotateLeaders(leaders, 2))
    }
  ];
}

function buildSmallGroupsForService(serviceName: string, leaders: PeopleLeader[]): SmallGroup[] {
  const groupNames = [
    "6th Grade",
    "7th-8th Grade Boys",
    "7th-8th Grade Girls",
    "9th-10th Grade Boys",
    "11th-12th Grade Boys",
    "High School Girls"
  ];
  const rooms = ["Room 101", "Room 102", "Room 201", "Room 202", "Cafe", "Prayer Room"];
  const countBase = serviceName.toLowerCase().includes("evening") ? 8 : 10;
  const groupCount = Math.max(4, Math.min(groupNames.length, Math.ceil(Math.max(leaders.length, 8) / 2)));

  return groupNames.slice(0, groupCount).map((name, index) => {
    const firstLeader = leaders.length ? leaders[(index * 2) % leaders.length] : undefined;
    const secondLeader = leaders.length > 1 ? leaders[(index * 2 + 1) % leaders.length] : undefined;
    return {
      id: uniqueId("group", `${serviceName}-${name}`),
      name,
      leaderIds: [firstLeader?.id ?? "", secondLeader?.id ?? ""],
      room: rooms[index],
      focus: `${serviceName} formation, care follow-up, and leader-owned next steps.`,
      memberCount: countBase + index * 2
    };
  });
}

function rotateLeaders(leaders: PeopleLeader[], count: number) {
  if (!leaders.length) return leaders;
  const offset = count % leaders.length;
  return [...leaders.slice(offset), ...leaders.slice(0, offset)];
}

function leaderById(id: string, leaders: PeopleLeader[]) {
  return leaders.find((leader) => leader.id === id);
}

function leaderNameById(id: string, leaders: PeopleLeader[]) {
  return leaderById(id, leaders)?.name ?? "";
}

function initialsForPerson(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "+";
}

function campStaffRoleLabel(role: CampStaffMember["role"]) {
  if (role === "leader") return "Leader";
  if (role === "staff") return "Staff";
  return "Adult volunteer";
}

function uniqueId(prefix: string, value: string) {
  return `${prefix}-${slugify(value)}-${Date.now().toString(36)}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
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
