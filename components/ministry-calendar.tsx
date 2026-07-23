"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useEventCard } from "@/components/event-card-context";
import { eventTypeLabels } from "@/lib/templates";
import { eventCategoryColors } from "@/lib/event-categories";
import type { EventType, MinistryEvent } from "@/lib/types";

const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(first: Date, second: Date) {
  return dayKey(first) === dayKey(second);
}

function formatChipTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MinistryCalendar({ events }: { events: MinistryEvent[] }) {
  const { openEdit } = useEventCard();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MinistryEvent[]>();
    for (const event of events) {
      const key = dayKey(new Date(event.startTime));
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    map.forEach((bucket) => {
      bucket.sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime());
    });
    return map;
  }, [events]);

  const usedTypes = useMemo(() => {
    const seen = new Set<EventType>();
    for (const event of events) seen.add(event.type);
    return Array.from(seen);
  }, [events]);

  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });
  const mobileAgenda = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return events
      .filter((event) => {
        const eventStart = new Date(event.startTime);
        return eventStart >= start && eventStart < end;
      })
      .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime())
      .slice(0, 8);
  }, [events, month]);

  return (
    <section className="panel calendar-panel" aria-label="Ministry Calendar">
      <div className="calendar-header">
        <div className="calendar-title">
          <CalendarGlyph />
          <h2 className="section-title flush">
            Ministry Calendar
          </h2>
        </div>
        <div className="calendar-controls">
          <button
            className="button icon"
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            {"<"}
          </button>
          <strong className="calendar-month" aria-live="polite">
            {monthLabel}
          </strong>
          <button
            className="button icon"
            type="button"
            aria-label="Next month"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            {">"}
          </button>
          <button
            className="calendar-today-btn"
            type="button"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
        </div>
      </div>

      <div className="calendar-mobile-agenda" aria-label={`${monthLabel} agenda`}>
        {mobileAgenda.length ? mobileAgenda.map((event) => {
          const start = new Date(event.startTime);
          return (
            <button className="calendar-mobile-agenda-item" type="button" key={event.id} onClick={() => openEdit(event.id)}>
              <span aria-hidden="true">
                <strong>{start.toLocaleDateString([], { month: "short" }).toUpperCase()}</strong>
                <em>{start.getDate()}</em>
              </span>
              <span>
                <strong>{event.title}</strong>
                <small>{formatChipTime(event.startTime)}{event.location ? ` - ${event.location}` : ""}</small>
              </span>
            </button>
          );
        }) : <p className="muted">No events are scheduled this month.</p>}
      </div>

      <div className="calendar-grid" role="grid" aria-label={`${monthLabel} ministry calendar`}>
        <div className="calendar-weekdays" role="row">
          {weekdayLabels.map((label) => (
            <span className="calendar-weekday" role="columnheader" key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="calendar-weeks">
          {days.map((day) => {
            const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = isSameDay(day, today);
            const cellClass = ["calendar-cell", inMonth ? "" : "outside", isToday ? "today" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <div className={cellClass} role="gridcell" key={dayKey(day)}>
                <span className="calendar-daynum">{day.getDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      className="calendar-event-chip"
                      type="button"
                      key={event.id}
                      style={{ "--chip": eventCategoryColors[event.type] } as CSSProperties}
                      onClick={() => openEdit(event.id)}
                      aria-label={`Open ${event.title} on ${day.toLocaleDateString()}`}
                    >
                      <span className="chip-time">{formatChipTime(event.startTime)}</span>
                      <span className="chip-title">{event.title}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="calendar-more">+{dayEvents.length - 3} more</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {usedTypes.length > 0 ? (
        <div className="calendar-legend" aria-label="Calendar legend">
          {usedTypes.map((type) => (
            <span className="legend-item" key={type}>
              <span className="legend-dot" style={{ background: eventCategoryColors[type] }} aria-hidden="true" />
              {eventTypeLabels[type]}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CalendarGlyph() {
  return (
    <svg className="calendar-title-glyph" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
