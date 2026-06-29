export function buildCampEmmaWelcomeGreeting(fullName?: string | null): string {
  const firstName = firstNameFrom(fullName);
  const greeting = firstName
    ? `Hey, ${firstName}! I'm EMMA, the Emerge Ministry Management Agent.`
    : "Hey there! I'm EMMA, the Emerge Ministry Management Agent.";
  return [
    greeting,
    "",
    'I, too, am running on "camp mode," so not all of my reasoning skills are available right now. I\'m sure you understand what that\'s like.',
    "",
    "But I'm here for it, and I can still help you find what you need fast."
  ].join("\n");
}

function firstNameFrom(fullName?: string | null): string | null {
  const value = fullName?.trim();
  if (!value) return null;
  const source = value.includes("@") ? value.split("@")[0] : value;
  const first = source.split(/[\s._-]+/)[0];
  if (!first) return null;
  if (/^[a-z]+$/i.test(first)) return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return first || null;
}

export function getCampEmmaSuggestions(canRunActions: boolean): string[] {
  if (canRunActions) {
    return [
      "Which campers don't have a team yet?",
      "Which teams are short a leader?",
      "Move Isaac Carver to Orange Team",
      "Give me a briefing for tonight",
      "What rooms still need assignments?",
      "Who's in Cabin 5?"
    ];
  }
  return [
    "Who's on Purple Team?",
    "Where is Avery?",
    "What time is dinner tonight?",
    "Who's driving Van 2?",
    "Show me today's schedule",
    "Who are the team leaders?"
  ];
}
