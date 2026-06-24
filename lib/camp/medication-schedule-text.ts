function splitScheduleSegments(value: string): string[] {
  return value
    .split(/\s*(?:,|;|\n|\r|&|\+|\/|\band\b)\s*/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

type ParsedTime = {
  hour: number;
  minute: number;
  hasMeridiem: boolean;
  isBareHour: boolean;
};

function parseTimeSegment(segment: string): ParsedTime | null {
  const normalized = segment.trim().toLowerCase().replace(/\./g, "");
  if (normalized === "noon") return { hour: 12, minute: 0, hasMeridiem: true, isBareHour: false };
  if (normalized === "midnight") return { hour: 0, minute: 0, hasMeridiem: true, isBareHour: false };

  const match = normalized.match(/^(\d{1,4})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  const rawNumber = match[1];
  const minuteText = match[2];
  const meridiem = match[3] as "am" | "pm" | undefined;
  let hour: number;
  let minute: number;

  if (!minuteText && rawNumber.length >= 3) {
    hour = Number(rawNumber.slice(0, -2));
    minute = Number(rawNumber.slice(-2));
  } else {
    hour = Number(rawNumber);
    minute = minuteText ? Number(minuteText) : 0;
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "pm") hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return {
    hour,
    minute,
    hasMeridiem: Boolean(meridiem),
    isBareHour: !meridiem && !minuteText && rawNumber.length <= 2
  };
}

function formatTime(hour: number, minute: number): string {
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
}

export function parseMedicationScheduleText(value: string): string[] {
  const segments = splitScheduleSegments(value);
  const parsed = segments.map((segment) => ({ segment, time: parseTimeSegment(segment) }));
  const hasTime = parsed.some((item) => item.time);
  const results: string[] = [];
  let previousHour: number | null = null;

  for (const item of parsed) {
    const { time } = item;
    if (!time) {
      if (!hasTime) results.push(item.segment);
      continue;
    }

    let hour = time.hour;
    if (time.isBareHour && hour > 0 && hour < 12 && previousHour !== null && hour <= previousHour) {
      hour += 12;
    }

    previousHour = hour;
    results.push(formatTime(hour, time.minute));
  }

  const seen = new Set<string>();
  return results.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
