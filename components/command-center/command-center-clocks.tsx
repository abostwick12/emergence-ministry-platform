"use client";

import { useEffect, useState } from "react";

const ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "ET" },
  { value: "America/Chicago", label: "CT" },
  { value: "America/Denver", label: "MT" },
  { value: "America/Los_Angeles", label: "PT" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Jerusalem", label: "Jerusalem" },
  { value: "Asia/Tokyo", label: "Tokyo" }
];

const DEFAULT_ZONES = ["America/New_York", "America/Chicago", "America/Los_Angeles"];

function formatTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);
}

// Andrew can swap any of the three clocks to a different time zone from its
// own picker. No persistence yet — resets to the ET/CT/PT defaults on
// reload.
export function CommandCenterClocks() {
  const [now, setNow] = useState<Date | null>(null);
  const [zones, setZones] = useState<string[]>(DEFAULT_ZONES);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function updateZone(index: number, value: string) {
    setZones((current) => current.map((zone, i) => (i === index ? value : zone)));
  }

  return (
    <div className="cc-clocks">
      {zones.map((zone, index) => (
        <div className="cc-clock" key={index}>
          <select aria-label={`Clock ${index + 1} time zone`} value={zone} onChange={(event) => updateZone(index, event.target.value)}>
            {ZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="cc-mono-tab" style={{ fontSize: 13, fontWeight: 600 }}>
            {now ? formatTime(now, zone) : "--:--:--"}
          </span>
        </div>
      ))}
    </div>
  );
}
