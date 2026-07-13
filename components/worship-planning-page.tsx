"use client";

import { useMemo, useState } from "react";
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
      <div className="worship-hero">
        <div>
          <p className="eyebrow">Worship Planning</p>
          <h2 className="section-title">Student worship schedule</h2>
          <p className="muted">
            Plan student vocals, instruments, slides, and GroupMe updates in one rehearsal-ready workspace.
          </p>
        </div>
        <div className="worship-readiness">
          <span className="pill stub">Preview / Stub Mode</span>
          <strong>{serviceReadiness}</strong>
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

      <MinistryEmmaPanel
        page="worship"
        staticSignals={[
          `${confirmedCount} of ${assignments.length} worship assignments are confirmed.`,
          `${needsReplyCount} student assignment${needsReplyCount === 1 ? "" : "s"} still need replies.`,
          `${readySlides} of ${slides.length} slide item${slides.length === 1 ? "" : "s"} are ready.`,
          "GroupMe and ProPresenter actions are preview-only in this workspace."
        ]}
      />

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
