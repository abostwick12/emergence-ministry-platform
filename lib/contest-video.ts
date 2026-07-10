export type ContestScene = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  capture: string;
  durationSeconds: number;
  previewLabel?: string;
};

export const contestScenes: ContestScene[] = [
  {
    id: "opening",
    eyebrow: "Lead Emergence Automated Platform",
    title: "Create more space for community and connecting people to Jesus.",
    body: "LEAP brings ministry operations, Scripture engagement, trusted leaders, and guided discipleship into one connected platform.",
    capture: "contest/dashboard.png",
    durationSeconds: 8
  },
  {
    id: "operations",
    eyebrow: "One connected ministry workspace",
    title: "See what matters. Know what is next. Move together.",
    body: "Dashboard, events, tasks, people, and communications reduce the friction that pulls leaders away from relationships.",
    capture: "contest/events-tasks.png",
    durationSeconds: 10
  },
  {
    id: "camp",
    eyebrow: "Built for real ministry complexity",
    title: "A mobile command center when ministry gets complicated.",
    body: "Schedules, teams, rooms, safety information, protected workflows, and bounded AI support stay connected in the moment.",
    capture: "contest/camp-command.png",
    durationSeconds: 10
  },
  {
    id: "scripture",
    eyebrow: "YouVersion integration",
    title: "Scripture lives inside the discipleship journey.",
    body: "Students can open a passage, explore context, build reading habits, and move beyond isolated verses into the larger story of Scripture.",
    capture: "contest/youversion-scripture.png",
    durationSeconds: 13
  },
  {
    id: "student-journey",
    eyebrow: "Student Scripture Hub",
    title: "Questions become invitations to wrestle with Scripture together.",
    body: "Students can ask honestly, follow the Wrestle–Dig–Reflect–Pray pathway, journal privately, and bring discoveries back to community.",
    capture: "contest/student-journey.png",
    durationSeconds: 14
  },
  {
    id: "leaders",
    eyebrow: "Human-guided discipleship",
    title: "AI supports ministry. Trusted leaders still lead it.",
    body: "Leader review, approved resources, privacy boundaries, and relational follow-through keep technology accountable to pastoral care.",
    capture: "contest/leader-review.png",
    durationSeconds: 12
  },
  {
    id: "gloo",
    eyebrow: "Gloo integration",
    title: "Personalized, Scripture-centered next steps.",
    body: "Gloo-powered guidance helps organize student questions into contextual pathways while leaders remain responsible for wisdom, review, and care.",
    capture: "contest/gloo-guided-preview.png",
    durationSeconds: 9,
    previewLabel: "Gloo-guided workflow preview — replace with live capture when connected"
  },
  {
    id: "closing",
    eyebrow: "Lead Emergence Automated Platform",
    title: "More than managing ministry.",
    body: "Creating more space for building community and connecting people to Jesus.",
    capture: "contest/closing.png",
    durationSeconds: 7
  }
];

export const totalContestSeconds = contestScenes.reduce((total, scene) => total + scene.durationSeconds, 0);
