export function buildCampEmmaWelcomeGreeting(fullName?: string | null): string {
  return [
    "Hey! I\u2019m EMMA \u2014 your Camp Oakwood assistant.",
    "",
    `${leaderLine(fullName)}I can help you quickly find the camp information you\u2019re allowed to see, like teams, rooms, schedules, transportation, and leader details.`
  ].join("\n");
}

function firstNameFrom(fullName?: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || null;
}

function leaderLine(fullName?: string | null): string {
  const firstName = firstNameFrom(fullName);
  return firstName ? `${firstName}, ` : "";
}
