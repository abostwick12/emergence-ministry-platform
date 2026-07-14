"use client";

import { useMemo, useState } from "react";
import { Download, Guitar, KeyboardMusic, Mic2, Music2 } from "lucide-react";
import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";

type AssignmentStatus = "confirmed" | "needs_reply" | "tentative";
type SlideStatus = "ready" | "needs_update" | "not_started";

type WorshipAssignment = {
  id: string;
  student: string;
  role: string;
  service: string;
  status: AssignmentStatus;
  notes: string;
};

type SlideItem = {
  id: string;
  title: string;
  owner: string;
  status: SlideStatus;
  detail: string;
};

const initialAssignments: WorshipAssignment[] = [
  {
    id: "student-ava",
    student: "Ava Thompson",
    role: "Lead Vocal",
    service: "Sunday Worship",
    status: "confirmed",
    notes: "Arrives 8:15 AM for warmup"
  },
  {
    id: "student-miles",
    student: "Miles Carter",
    role: "Acoustic Guitar",
    service: "Sunday Worship",
    status: "needs_reply",
    notes: "Waiting on parent confirmation"
  },
  {
    id: "student-naomi",
    student: "Naomi Reyes",
    role: "Keys",
    service: "Midweek",
    status: "tentative",
    notes: "Can serve if practice ends by 6:15"
  },
  {
    id: "student-eli",
    student: "Eli Brooks",
    role: "Drums",
    service: "Midweek",
    status: "confirmed",
    notes: "Needs click track"
  }
];

const initialSlides: SlideItem[] = [
  {
    id: "song-king",
    title: "King of My Heart",
    owner: "Jordan",
    status: "ready",
    detail: "Lyrics checked, arrangement notes attached"
  },
  {
    id: "song-goodness",
    title: "Goodness of God",
    owner: "Alex",
    status: "needs_update",
    detail: "Update bridge repeat and lower-third cue"
  },
  {
    id: "welcome",
    title: "Welcome / Announcements",
    owner: "Avery",
    status: "not_started",
    detail: "Waiting on final event reminders"
  }
];

const statusLabels: Record<AssignmentStatus, string> = {
  confirmed: "Confirmed",
  needs_reply: "Needs Reply",
  tentative: "Tentative"
};

const slideLabels: Record<SlideStatus, string> = {
  ready: "Ready",
  needs_update: "Needs Update",
  not_started: "Not Started"
};

const setList = ["King of My Heart", "Goodness of God", "Build My Life", "Student Testimony", "Closing Prayer"];

const worshipTabs = ["Sunday, Jul 12", "Sunday, Jul 19", "HS Worship Night · Jul 19", "Team View"];

const worshipSetRows = [
  { number: "01", song: "Gratitude", artist: "Brandon Lake", key: "B", bpm: "74", arrangement: "Full band", lead: "Sarah J.", files: ["Chart", "MP3", "Track"] },
  { number: "02", song: "Holy Forever", artist: "Chris Tomlin", key: "Db", bpm: "90", arrangement: "Track-led", lead: "Caleb H.", files: ["Chart", "Track"] },
  { number: "03", song: "King of Kings", artist: "Hillsong", key: "D", bpm: "74", arrangement: "Full band", lead: "Sarah J.", files: ["Chart", "MP3"] },
  { number: "-", song: "Communion Set", artist: "Instrumental pad", key: "-", bpm: "-", arrangement: "Pad only", lead: "David L.", files: ["Pad"] },
  { number: "04", song: "Living Hope", artist: "Phil Wickham", key: "A", bpm: "76", arrangement: "Full band", lead: "Marcus T.", files: ["Chart", "MP3", "Track"] }
];

const worshipTeam = [
  { name: "Sarah Jenkins", role: "Worship Lead", status: "Confirmed", icon: <Mic2 aria-hidden="true" /> },
  { name: "Marcus Thorne", role: "Vocals", status: "Confirmed", icon: <Mic2 aria-hidden="true" /> },
  { name: "Elena Whitfield", role: "Vocals", status: "Pending", icon: <Mic2 aria-hidden="true" /> },
  { name: "Chris Miller", role: "Acoustic / Lead", status: "Confirmed", icon: <Guitar aria-hidden="true" /> },
  { name: "Open", role: "Electric", status: "Open", icon: <Guitar aria-hidden="true" /> },
  { name: "Nate Ortiz", role: "Bass", status: "Confirmed", icon: <Guitar aria-hidden="true" /> },
  { name: "David Lee", role: "Keys / Tracks", status: "Confirmed", icon: <KeyboardMusic aria-hidden="true" /> }
];

export function WorshipPlanningPage() {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [slides, setSlides] = useState(initialSlides);
  const [message, setMessage] = useState(
    "Hey team! Please confirm your worship role for this week and arrive 15 minutes before rehearsal. Reply here if you have a conflict."
  );
  const [groupMePreview, setGroupMePreview] = useState("Draft saved locally. No GroupMe message has been sent.");
  const [slidePreview, setSlidePreview] = useState("Slide updates are being tracked locally. No ProPresenter playlist has been changed.");

  const confirmedCount = assignments.filter((item) => item.status === "confirmed").length;
  const needsReplyCount = assignments.filter((item) => item.status === "needs_reply").length;
  const readySlides = slides.filter((item) => item.status === "ready").length;

  const serviceReadiness = useMemo(() => {
    if (needsReplyCount > 0) return "Needs confirmations";
    if (readySlides < slides.length) return "Slides need attention";
    return "Ready for rehearsal";
  }, [needsReplyCount, readySlides, slides.length]);

  function updateAssignment(id: string, status: AssignmentStatus) {
    setAssignments((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  function updateSlide(id: string, status: SlideStatus) {
    setSlides((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  function prepareSlideUpdate() {
    setSlidePreview("ProPresenter update preview staged for review. Stub Mode keeps the live playlist unchanged.");
  }

  return (
    <section className="worship-page liquid-page-panel liquid-workspace" aria-label="Worship Planning">
      <MinistryEmmaPanel
        page="worship"
        staticSignals={[
          `${confirmedCount} of ${assignments.length} worship assignments are confirmed.`,
          `${needsReplyCount} student assignment${needsReplyCount === 1 ? "" : "s"} still need replies.`,
          `${readySlides} of ${slides.length} slide item${slides.length === 1 ? "" : "s"} are ready.`,
          "GroupMe and ProPresenter actions are preview-only in this workspace."
        ]}
      />

      <div className="worship-lovable-service">
        <div className="worship-lovable-tabs" aria-label="Worship service views">
          {worshipTabs.map((tab, index) => (
            <button className={index === 0 ? "active" : ""} type="button" key={tab}>
              {tab}
            </button>
          ))}
          <div className="worship-next-service">
            <span>Next Service</span>
            <strong>Sunday · Jul 12 · Track-led</strong>
            <small>{serviceReadiness}</small>
          </div>
        </div>

        <div className="worship-service-strip" aria-label="Selected service details">
          <div>
            <span>Set</span>
            <strong>Communion Set</strong>
            <small>5 songs · 32 min</small>
          </div>
          <div>
            <span>Arrival</span>
            <strong>7:15 AM</strong>
            <small>Doors 8:30</small>
          </div>
          <div>
            <span>Rehearsal</span>
            <strong>Thu · 6:30 PM</strong>
            <small>Full band + tracks</small>
          </div>
          <div>
            <span>Leader</span>
            <strong>Sarah Jenkins</strong>
            <small>Backup: Caleb H.</small>
          </div>
        </div>

        <div className="worship-lovable-layout">
          <section className="worship-setlist-panel" aria-label="Setlist">
            <div className="worship-setlist-head">
              <h3>
                <Music2 aria-hidden="true" />
                Setlist
              </h3>
              <div>
                <button className="button compact-button" type="button" onClick={prepareSlideUpdate}>
                  <Download aria-hidden="true" />
                  Send charts
                </button>
                <button className="button compact-button primary" type="button" onClick={prepareSlideUpdate}>
                  Add song
                </button>
              </div>
            </div>
            <div className="worship-setlist-table" role="table" aria-label="Sunday worship set list">
              <div className="worship-setlist-row header" role="row">
                <span>#</span>
                <span>Song</span>
                <span>Key</span>
                <span>BPM</span>
                <span>Arrangement</span>
                <span>Lead</span>
                <span>Files</span>
              </div>
              {worshipSetRows.map((song) => (
                <div className={song.number === "-" ? "worship-setlist-row pad" : "worship-setlist-row"} role="row" key={`${song.number}-${song.song}`}>
                  <span>{song.number}</span>
                  <span>
                    <strong>{song.song}</strong>
                    <small>{song.artist}</small>
                  </span>
                  <span>{song.key}</span>
                  <span>{song.bpm}</span>
                  <span>{song.arrangement}</span>
                  <span>{song.lead}</span>
                  <span className="worship-file-chips">
                    {song.files.map((file) => (
                      <small key={file}>{file}</small>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <aside className="worship-team-panel" aria-label="Team on Sunday">
            <div className="worship-setlist-head">
              <h3>Team on Sunday</h3>
              <span>{confirmedCount + 3} / 8</span>
            </div>
            <div className="worship-team-list">
              {worshipTeam.map((member) => (
                <article className="worship-team-card" key={`${member.role}-${member.name}`}>
                  <span className="worship-team-icon">{member.icon}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.role}</small>
                  </div>
                  <span className={`worship-team-status ${member.status.toLowerCase()}`}>{member.status}</span>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <div className="worship-kpi-row" aria-label="Worship planning metrics">
        <article className="worship-mini-card liquid-card">
          <span>Students Confirmed</span>
          <strong>{confirmedCount}/{assignments.length}</strong>
        </article>
        <article className="worship-mini-card liquid-card">
          <span>Need Replies</span>
          <strong>{needsReplyCount}</strong>
        </article>
        <article className="worship-mini-card liquid-card">
          <span>Slides Ready</span>
          <strong>{readySlides}/{slides.length}</strong>
        </article>
      </div>

      <div className="worship-layout">
        <section className="worship-section liquid-card-strong" aria-label="Student schedule">
          <div className="worship-section-header">
            <div>
              <p className="eyebrow">Students</p>
              <h3>Vocals and instruments</h3>
            </div>
            <span className="pill">{assignments.length} scheduled</span>
          </div>
          <div className="worship-roster">
            {assignments.map((assignment) => (
              <article className="worship-roster-card liquid-card" key={assignment.id}>
                <div>
                  <strong>{assignment.student}</strong>
                  <p>{assignment.role}</p>
                  <span>{assignment.service}</span>
                </div>
                <label className="worship-select">
                  <span>Status</span>
                  <select value={assignment.status} onChange={(event) => updateAssignment(assignment.id, event.target.value as AssignmentStatus)}>
                    {(Object.keys(statusLabels) as AssignmentStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted">{assignment.notes}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="worship-side-stack">
          <section className="worship-section liquid-card-strong" aria-label="Service set list">
            <div className="worship-section-header">
              <div>
                <p className="eyebrow">Set List</p>
                <h3>This week</h3>
              </div>
            </div>
            <ol className="worship-set-list">
              {setList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>

          <section className="worship-section liquid-card-strong" aria-label="GroupMe message draft">
            <div className="worship-section-header">
              <div>
                <p className="eyebrow">GroupMe</p>
                <h3>Team message draft</h3>
              </div>
              <span className="pill stub">Preview only</span>
            </div>
            <textarea
              className="worship-message-input"
              aria-label="GroupMe draft message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="worship-action-row">
              <button
                className="button compact-button"
                type="button"
                onClick={() => setGroupMePreview("GroupMe message preview prepared. No live message was sent.")}
              >
                Preview GroupMe Message
              </button>
              <button className="button compact-button" type="button" disabled>
                Send Live GroupMe
              </button>
            </div>
            <p className="worship-status-note">{groupMePreview}</p>
          </section>
        </aside>
      </div>

      <section className="worship-section liquid-card-strong" aria-label="ProPresenter slide preparation">
        <div className="worship-section-header">
          <div>
            <p className="eyebrow">ProPresenter</p>
            <h3>Slides and cues</h3>
          </div>
          <span className="pill stub">Stub adapter</span>
        </div>
        <div className="worship-action-row">
          <button className="button compact-button" type="button" onClick={prepareSlideUpdate}>
            Prepare ProPresenter Update
          </button>
          <p className="worship-status-note">{slidePreview}</p>
        </div>
        <div className="worship-slide-grid">
          {slides.map((slide) => (
            <article className="worship-slide-card liquid-card" key={slide.id}>
              <div>
                <strong>{slide.title}</strong>
                <p>{slide.detail}</p>
                <span>Owner: {slide.owner}</span>
              </div>
              <label className="worship-select">
                <span>Slide status</span>
                <select value={slide.status} onChange={(event) => updateSlide(slide.id, event.target.value as SlideStatus)}>
                  {(Object.keys(slideLabels) as SlideStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {slideLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
