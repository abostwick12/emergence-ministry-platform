# Scripture Discussion Video Scaffold

Leader discussion videos use `buildDiscussionVideoScript` in `lib/scripture/discussion-video.ts` as the source of truth.

The current launch slice prepares a reviewed scene plan only. It does not render, upload, post, or share a video.

## Ministry Guardrails

- Only leader-approved or posted prompts should be rendered.
- Student names, emails, private reflection notes, and care-sensitive details must stay out of the video.
- The leader must review the script before rendering or sharing.
- Care-sensitive prompts should stay general and point students toward direct leader follow-up.

## Remotion Contract

The future Remotion composition should accept a JSON-serializable `DiscussionVideoScript`:

- `compositionId`: `LeaderDiscussionVideo`
- `remotion.width`: `1080`
- `remotion.height`: `1920`
- `remotion.fps`: `30`
- `scenes`: ordered title, Scripture, question, reflection, prayer, and next-step cards

Suggested composition shape once Remotion is installed:

```tsx
import { Composition } from "remotion";
import type { DiscussionVideoScript } from "@/lib/scripture/discussion-video";
import { LeaderDiscussionVideo } from "./LeaderDiscussionVideo";

export function RemotionRoot({ script }: { script: DiscussionVideoScript }) {
  return (
    <Composition
      id={script.compositionId}
      component={LeaderDiscussionVideo}
      durationInFrames={script.totalDurationSeconds * script.remotion.fps}
      fps={script.remotion.fps}
      width={script.remotion.width}
      height={script.remotion.height}
      defaultProps={{ script }}
    />
  );
}
```

Rendering should be added as a separate server-side workflow so a normal page click does not block the app or bypass leader review.
