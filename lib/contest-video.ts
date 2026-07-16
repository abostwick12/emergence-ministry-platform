export type ContestScene = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  capture: string;
  durationSeconds: number;
};

export const contestScenes: ContestScene[] = [
  {
    id: "opening",
    eyebrow: "Lead Emergence Automated Platform",
    title: "Create more space for community and connecting people to Jesus.",
    body: "LEAP brings the work of ministry into one connected platform so leaders can spend less time chasing systems and more time investing in people.",
    capture: "contest/dashboard.png",
    durationSeconds: 8
  },
  {
    id: "dashboard",
    eyebrow: "Dashboard",
    title: "See what matters before the week gets away from you.",
    body: "Upcoming priorities, ministry pulse, and the next right actions come together in one live operating view.",
    capture: "contest/dashboard.png",
    durationSeconds: 9
  },
  {
    id: "events",
    eyebrow: "Events",
    title: "Turn ministry ideas into coordinated plans.",
    body: "Dates, ownership, readiness, and shared details stay visible so the team can move together with clarity.",
    capture: "contest/events.png",
    durationSeconds: 10
  },
  {
    id: "tasks",
    eyebrow: "Tasks",
    title: "Make follow-through visible without adding more meetings.",
    body: "Leaders can see what is assigned, what is blocked, and what needs attention next.",
    capture: "contest/tasks.png",
    durationSeconds: 9
  },
  {
    id: "worship",
    eyebrow: "Worship",
    title: "Prepare students to lead, not just participate.",
    body: "Songs, teams, rehearsals, and ministry preparation live in one place so worship becomes a pathway for formation and ownership.",
    capture: "contest/worship.png",
    durationSeconds: 10
  },
  {
    id: "student-portal",
    eyebrow: "Student Portal",
    title: "Give students a clear path into Scripture, questions, and community.",
    body: "The Student Portal brings reading tools, guided questions, progress, and next steps into an experience built for students rather than administrators.",
    capture: "contest/student-portal.png",
    durationSeconds: 14
  },
  {
    id: "discipleship",
    eyebrow: "Discipleship",
    title: "Technology supports ministry. Trusted leaders still lead it.",
    body: "Student questions, reviewed resources, Scripture-centered guidance, and relational follow-through help leaders disciple with greater clarity and care.",
    capture: "contest/discipleship.png",
    durationSeconds: 13
  },
  {
    id: "closing",
    eyebrow: "Lead Emergence Automated Platform",
    title: "More than managing ministry.",
    body: "Creating more space for building community and connecting people to Jesus.",
    capture: "contest/dashboard.png",
    durationSeconds: 7
  }
];

export const totalContestSeconds = contestScenes.reduce((total, scene) => total + scene.durationSeconds, 0);
