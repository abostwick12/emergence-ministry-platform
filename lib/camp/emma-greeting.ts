export function buildCampEmmaWelcomeGreeting(fullName?: string | null): string {
  const firstName = firstNameFrom(fullName);
  const greeting = firstName
    ? `Hey, ${firstName}! I\u2019m EMMA, the Emerge Ministry Management Agent.`
    : "Hey there! I\u2019m EMMA, the Emerge Ministry Management Agent.";

  return [
    greeting,
    "",
    "I, too, am running on \u201ccamp mode,\u201d so not all of my reasoning skills are available right now. I\u2019m sure you understand what that\u2019s like.",
    "",
    "But I\u2019m here for it, and I can still help you find what you need fast.",
    "",
    "Ask me about schedules, teams, rooms, campers, leaders, or camp details."
  ].join("\n");
}

function firstNameFrom(fullName?: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || null;
}
