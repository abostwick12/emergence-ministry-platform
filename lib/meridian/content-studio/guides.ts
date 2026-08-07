import type {
  ContentGuideData,
  ContentGuideKind,
  ContentPlatform,
  InterviewPlaybookData,
  PlatformGuideData
} from "@/lib/meridian/content-studio/types";

export type DefaultContentGuide = {
  kind: ContentGuideKind;
  platform: ContentPlatform | null;
  title: string;
  bodyMarkdown: string;
  guideData: ContentGuideData;
};

const voiceGuide = `# Lead Emergence ministry voice

## Sound like a real ministry leader

- Write with specific people, places, stakes, and next steps in view.
- Prefer honest, concrete language over polish for its own sake.
- Use warmth without manufactured intimacy and confidence without hype.
- Let Scripture shape the message when it is relevant; never bolt on a verse as decoration.
- Preserve the speaker's natural vocabulary and point of view.

## Anti-AI-slop rules

- No throat-clearing, generic scene-setting, or summaries that merely repeat the prompt.
- No empty superlatives, inflated urgency, fake quotations, invented testimony, or unsupported numbers.
- Avoid stock phrases such as “in today's fast-paced world,” “more than just,” “journey together,” “game-changer,” and “whether you're … or …”.
- Do not stack rhetorical questions, em dashes, emoji, or three-part slogans by habit.
- Do not use spiritual pressure, guilt, fear, or belonging language to manipulate a response.
- Never infer a person's motives, spiritual state, diagnosis, or private story.
- If a detail is missing, ask or mark it as a placeholder. Never fabricate it.
- Cut any sentence that could belong to almost any church, event, or organization.

## Editorial test

Before returning a draft, ask: Is it true? Is it specific? Is it recognizably ours? Is the next step clear? Would a thoughtful person actually say this aloud?`;

const visualGuide = `# Lead Emergence visual direction

- Build one clear focal idea per asset.
- Favor deep blue, warm parchment, restrained gold, generous negative space, and high-contrast type.
- Use documentary ministry photography when real imagery is available; never invent attendance, emotion, or testimony.
- Keep text hierarchy obvious at a glance: one headline, one supporting line, one action or detail group.
- Avoid glossy AI-surreal imagery, fake crowds, plastic skin, excessive glow, random gradients, floating icons, and decorative clutter.
- Protect faces, logos, dates, and calls to action from crops and interface overlays.
- Every visual brief must include accessibility text and a legibility check at the destination size.`;

const interviewerGuide = `# Content interviewer playbook

The interviewer draws out the user's real idea instead of filling gaps with generic copy. It asks one question at a time, chooses the next dimension from what remains unresolved, and follows a promising answer when specificity would materially improve the draft.

The loop stops when the required dimensions are covered, the user asks to finish, or six questions have been answered. “Skip interview” is always offered beside “Start guided interview.”`;

const playbook: InterviewPlaybookData = {
  maxQuestions: 6,
  minQuestions: 3,
  dimensions: [
    {
      id: "purpose",
      label: "Purpose",
      objective: "the one outcome this content should create",
      priority: 100,
      required: true,
      platformAffinity: [],
      minWords: 5,
      maxAttempts: 2,
      probes: ["What should be different after someone sees this?", "What is the single most important result you want from this post?"],
      followups: ["What would a successful response look like in real life?", "Choose one result to prioritize over the others."]
    },
    {
      id: "audience",
      label: "Audience",
      objective: "the actual people being addressed and what they already know or feel",
      priority: 90,
      required: true,
      platformAffinity: ["facebook", "instagram", "groupme", "linkedin", "twitter"],
      minWords: 8,
      maxAttempts: 2,
      probes: ["Who specifically needs to hear this, and what is already on their mind?", "Who is this for—not just demographically, but in this moment?"],
      followups: ["What would make that person keep reading instead of scrolling past?", "What assumption should we not make about them?"]
    },
    {
      id: "substance",
      label: "Substance",
      objective: "the concrete story, observation, proof, or detail that makes the idea worth sharing",
      priority: 85,
      required: true,
      platformAffinity: ["facebook", "instagram", "linkedin", "twitter"],
      minWords: 12,
      maxAttempts: 2,
      probes: ["What happened, was said, or was noticed that gives this message its substance?", "What specific detail makes this more than a generic announcement?"],
      followups: ["Can you give me the moment or detail you would tell a friend first?", "Which detail can we verify and safely share?"]
    },
    {
      id: "response",
      label: "Response",
      objective: "the next step, invitation, or decision the audience can actually take",
      priority: 75,
      required: true,
      platformAffinity: ["groupme", "facebook", "instagram", "church_slide"],
      minWords: 5,
      maxAttempts: 2,
      probes: ["What exactly should someone do next, and by when?", "What is the clearest honest invitation this content can make?"],
      followups: ["What information would remove friction from that next step?", "If they do only one thing, what should it be?"]
    },
    {
      id: "tone",
      label: "Tone",
      objective: "the emotional register and the language that would feel natural coming from you",
      priority: 55,
      required: false,
      platformAffinity: ["linkedin", "groupme", "twitter"],
      minWords: 5,
      maxAttempts: 1,
      probes: ["How should this feel when someone reads it, and what should it definitely not sound like?"],
      followups: ["Name one phrase you would naturally say and one you would never say."]
    },
    {
      id: "visual",
      label: "Visual",
      objective: "the visual focal point, hierarchy, and practical details the asset must carry",
      priority: 70,
      required: false,
      platformAffinity: ["instagram", "church_slide"],
      minWords: 8,
      maxAttempts: 2,
      probes: ["What should someone understand from the visual before they read the caption or hear an explanation?", "What real image, object, person, or moment should anchor the design?"],
      followups: ["Which words must remain readable from the back of the room or on a phone?", "What visual would feel honest rather than staged?"]
    }
  ]
};

const platformGuides: Record<ContentPlatform, { markdown: string; data: PlatformGuideData }> = {
  twitter: {
    markdown: "# Twitter / X\n\nLead with one sharp idea. Keep the standard draft within 280 characters, use at most one purposeful hashtag, and choose conversation or a clear link—not both by habit. Do not write a miniature press release.",
    data: { bodyMode: "short_post", maxBodyCharacters: 280, allowedAspectRatios: [], requiredDesignFields: [], differentiators: ["one claim", "conversational compression", "at most one hashtag"] }
  },
  facebook: {
    markdown: "# Facebook\n\nWrite for a mixed church-and-community audience. Give enough context to stand alone, use short paragraphs, and end with a concrete next step. A real photo and a specific story usually outperform slogan art.",
    data: { bodyMode: "feed_post", maxBodyCharacters: 1800, allowedAspectRatios: ["4:5", "1:1", "16:9"], requiredDesignFields: [], differentiators: ["standalone context", "short paragraphs", "community-readable next step"] }
  },
  instagram: {
    markdown: "# Instagram\n\nPair a phone-first visual with a caption that earns attention in its opening line. Prefer 4:5 feed art or 9:16 story/reel art, keep overlay copy sparse, and provide useful alt text. The caption can carry story and context that should not be forced onto the image.",
    data: { bodyMode: "caption", maxBodyCharacters: 2200, maxOverlayWords: 14, allowedAspectRatios: ["4:5", "1:1", "9:16"], requiredDesignFields: ["aspectRatio", "overlayText", "visualDirection", "accessibilityText"], differentiators: ["phone-first hook", "caption carries story", "sparse overlay", "alt text required"] }
  },
  church_slide: {
    markdown: "# Church slide\n\nDesign for a room, not a feed. Use a 16:9 canvas, one glanceable headline, no more than 22 total on-screen words, and only the logistics people must retain. Prioritize distance legibility and keep all critical text inside safe margins.",
    data: { bodyMode: "screen_copy", maxBodyCharacters: 180, maxOverlayWords: 22, allowedAspectRatios: ["16:9"], requiredDesignFields: ["aspectRatio", "overlayText", "visualDirection", "accessibilityText"], differentiators: ["room-distance legibility", "one glance", "16:9 only", "logistics over narrative"] }
  },
  linkedin: {
    markdown: "# LinkedIn\n\nConnect ministry work to leadership, formation, service, or organizational learning without turning people into case studies. Open with a concrete observation, earn the reflection, and avoid corporate inspiration language.",
    data: { bodyMode: "professional_post", maxBodyCharacters: 2200, allowedAspectRatios: ["1.91:1", "1:1", "4:5"], requiredDesignFields: [], differentiators: ["professional relevance", "ethical reflection", "no corporate inspiration clichés"] }
  },
  groupme: {
    markdown: "# GroupMe\n\nWrite like a useful teammate. Put the action, date, time, or answer near the top; keep the message brief; use bullets only when they make logistics easier to scan; and do not bury the ask beneath a devotional introduction.",
    data: { bodyMode: "message", maxBodyCharacters: 650, allowedAspectRatios: [], requiredDesignFields: [], differentiators: ["teammate voice", "logistics first", "brief and scannable"] }
  }
};

export const defaultContentGuides: DefaultContentGuide[] = [
  { kind: "voice", platform: null, title: "Lead Emergence voice and anti-slop guide", bodyMarkdown: voiceGuide, guideData: { editorialQuestions: ["true", "specific", "recognizably ours", "clear next step", "sayable aloud"] } },
  { kind: "visual", platform: null, title: "Lead Emergence visual style guide", bodyMarkdown: visualGuide, guideData: { palette: ["deep blue", "warm parchment", "restrained gold"], principles: ["one focal idea", "real imagery", "clear hierarchy", "accessible contrast"] } },
  { kind: "interviewer", platform: null, title: "Content interviewer playbook", bodyMarkdown: interviewerGuide, guideData: playbook },
  ...contentPlatformEntries()
];

function contentPlatformEntries(): DefaultContentGuide[] {
  return (Object.entries(platformGuides) as Array<[ContentPlatform, (typeof platformGuides)[ContentPlatform]]>).map(([platform, guide]) => ({
    kind: "platform",
    platform,
    title: `${platform.replace(/_/g, " ")} design guide`,
    bodyMarkdown: guide.markdown,
    guideData: guide.data
  }));
}
