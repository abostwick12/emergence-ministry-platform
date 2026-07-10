import { buildQuestionNextStep } from "@/lib/scripture/student-home";
import { matchQuestionToStoryline } from "@/lib/scripture/storyline-guide";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

export type DiscussionVideoSceneKind = "title" | "scripture" | "question" | "reflect" | "pray" | "next_step";

export type DiscussionVideoScene = {
  id: string;
  kind: DiscussionVideoSceneKind;
  eyebrow: string;
  headline: string;
  body: string;
  durationSeconds: number;
  speakerNotes: string;
  visualCue: string;
};

export type DiscussionVideoScript = {
  compositionId: "LeaderDiscussionVideo";
  promptId: string;
  title: string;
  subtitle: string;
  status: "ready_for_review" | "needs_leader_approval";
  totalDurationSeconds: number;
  remotion: {
    fps: 30;
    width: 1080;
    height: 1920;
  };
  guardrails: string[];
  scenes: DiscussionVideoScene[];
};

export type DiscussionVideoRenderPackage = {
  compositionId: DiscussionVideoScript["compositionId"];
  promptId: string;
  renderConfig: {
    fps: DiscussionVideoScript["remotion"]["fps"];
    width: DiscussionVideoScript["remotion"]["width"];
    height: DiscussionVideoScript["remotion"]["height"];
    durationInFrames: number;
  };
  inputProps: {
    title: string;
    subtitle: string;
    status: DiscussionVideoScript["status"];
    guardrails: string[];
    scenes: DiscussionVideoScene[];
  };
};

export function buildDiscussionVideoScript(prompt: StudentDiscussionPrompt): DiscussionVideoScript {
  const storyline = matchQuestionToStoryline(prompt);
  const nextStep = buildQuestionNextStep(prompt, prompt.knowledgeContext ?? []);
  const approvedPrompt = prompt.discussionPrompt.trim();
  const title = limitText(approvedPrompt || prompt.question, 88);
  const scriptureReference = prompt.scriptureReference.trim();
  const keyPassages = scriptureReference || storyline.keyPassages.slice(0, 3).join(", ");
  const ready = prompt.status === "approved" || prompt.status === "posted";
  const care = careGuardrail(prompt);
  const scenes: DiscussionVideoScene[] = [
    {
      id: "title",
      kind: "title",
      eyebrow: "Group Discussion",
      headline: title,
      body: "Bring the question into the light with Scripture, honesty, and care.",
      durationSeconds: 5,
      speakerNotes: "Open by naming that honest questions are welcome and that the group will move slowly.",
      visualCue: "Large title over the Lead Emergence dark Scripture background."
    },
    {
      id: "scripture",
      kind: "scripture",
      eyebrow: scriptureReference ? "Open Scripture" : "Start in Scripture",
      headline: keyPassages,
      body: storyline.studentSummary,
      durationSeconds: 7,
      speakerNotes: "Invite students to read the passage before trying to solve the question.",
      visualCue: "Reference card with subtle line-map motion and a short summary."
    },
    {
      id: "question",
      kind: "question",
      eyebrow: "Wrestle With It",
      headline: nextStep.wrestleQuestions[0] ?? "What are we really asking?",
      body: nextStep.wrestleQuestions[1] ?? "Name what is sticking out, bothering you, or raising a deeper question.",
      durationSeconds: 8,
      speakerNotes: "Pause long enough for students to think before discussion begins.",
      visualCue: "Two question cards entering one at a time."
    },
    {
      id: "reflect",
      kind: "reflect",
      eyebrow: "Reflect",
      headline: nextStep.journalPrompts[0] ?? "What are you noticing?",
      body: nextStep.digQuestions[0] ?? nextStep.summary,
      durationSeconds: 8,
      speakerNotes: "Use this as a quiet writing moment or a personal reflection prompt.",
      visualCue: "Journal-style card with the Scripture reference held in the corner."
    },
    {
      id: "pray",
      kind: "pray",
      eyebrow: "Pray",
      headline: nextStep.prayerPrompts[0] ?? "God, help us seek you honestly.",
      body: nextStep.prayerPrompts[1] ?? "Ask God for wisdom, courage, humility, and care for one another.",
      durationSeconds: 7,
      speakerNotes: "Close the video by turning the question toward God, not just toward opinions.",
      visualCue: "Calm closing card with softened motion and no distracting animation."
    },
    {
      id: "next-step",
      kind: "next_step",
      eyebrow: "Wrestle Together",
      headline: approvedPrompt || nextStep.wrestleTogetherPrompt,
      body: nextStep.careNote ?? "Bring one honest thought, one Scripture observation, and one remaining question to group.",
      durationSeconds: 8,
      speakerNotes: "Point students back to the leader-guided group conversation and any needed private follow-up.",
      visualCue: "Final call-to-discussion card with a leader-reviewed badge."
    }
  ];

  return {
    compositionId: "LeaderDiscussionVideo",
    promptId: prompt.id,
    title,
    subtitle: scriptureReference ? `Discussion video for ${scriptureReference}` : "Discussion video for your group",
    status: ready ? "ready_for_review" : "needs_leader_approval",
    totalDurationSeconds: scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    remotion: {
      fps: 30,
      width: 1080,
      height: 1920
    },
    guardrails: [
      "Leader review is required before rendering or sharing.",
      "Do not include student names, emails, private notes, or care-sensitive details in the video.",
      "Use Scripture references and leader-approved prompts instead of unreviewed AI language.",
      care
    ].filter(Boolean),
    scenes
  };
}

export function formatDiscussionVideoScriptForCopy(script: DiscussionVideoScript) {
  return [
    `${script.title}`,
    script.subtitle,
    "",
    "Guardrails:",
    ...script.guardrails.map((guardrail) => `- ${guardrail}`),
    "",
    "Scenes:",
    ...script.scenes.flatMap((scene, index) => [
      `${index + 1}. ${scene.eyebrow}: ${scene.headline}`,
      `   ${scene.body}`,
      `   Leader note: ${scene.speakerNotes}`
    ])
  ].join("\n");
}

export function buildDiscussionVideoRenderPackage(script: DiscussionVideoScript): DiscussionVideoRenderPackage {
  return {
    compositionId: script.compositionId,
    promptId: script.promptId,
    renderConfig: {
      fps: script.remotion.fps,
      width: script.remotion.width,
      height: script.remotion.height,
      durationInFrames: script.totalDurationSeconds * script.remotion.fps
    },
    inputProps: {
      title: script.title,
      subtitle: script.subtitle,
      status: script.status,
      guardrails: script.guardrails,
      scenes: script.scenes
    }
  };
}

export function formatDiscussionVideoRenderPackageForCopy(script: DiscussionVideoScript) {
  return JSON.stringify(buildDiscussionVideoRenderPackage(script), null, 2);
}

function careGuardrail(prompt: StudentDiscussionPrompt) {
  if (prompt.safetyLabel === "pastoral_escalation") {
    return "This question needs pastoral care. Keep the video general and move personal details into direct leader follow-up.";
  }

  if (prompt.safetyLabel === "needs_leader_care" || prompt.escalationReason) {
    return "Frame this topic slowly and invite direct leader follow-up where needed.";
  }

  return "";
}

function limitText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trim()}...`;
}
