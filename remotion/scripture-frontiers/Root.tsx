import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  registerRoot,
  Sequence,
  staticFile,
  useCurrentFrame,
  Video
} from "remotion";

const fps = 30;
const width = 1920;
const height = 1080;
const durationInFrames = 5342;
const closingStartFrame = 4440;
const closingDurationInFrames = durationInFrames - closingStartFrame;
const defaultSource = "scripture-frontiers/source.mp4";

type ScriptureFrontiersFinalizerProps = {
  source: string;
};

export function RemotionRoot() {
  return (
    <Composition
      id="ScriptureFrontiersFinalizer"
      component={ScriptureFrontiersFinalizer}
      durationInFrames={durationInFrames}
      fps={fps}
      width={width}
      height={height}
      defaultProps={{ source: defaultSource }}
    />
  );
}

export function ScriptureFrontiersFinalizer({ source }: ScriptureFrontiersFinalizerProps) {
  const videoSource = source.includes("://") ? source : staticFile(source);

  return (
    <AbsoluteFill style={styles.canvas}>
      <Video src={videoSource} style={styles.sourceVideo} />
      <Sequence from={closingStartFrame} durationInFrames={closingDurationInFrames}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
}

function ClosingScene() {
  const frame = useCurrentFrame();
  const localFrame = frame;
  const fade = interpolate(localFrame, [0, 24, closingDurationInFrames - 24, closingDurationInFrames], [0, 1, 1, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const rise = interpolate(localFrame, [0, 36], [36, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const progress = `${interpolate(localFrame, [0, closingDurationInFrames], [82, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  })}%`;

  return (
    <AbsoluteFill style={{ ...styles.close, opacity: fade }}>
      <div style={styles.texture} />
      <div
        style={{
          ...styles.glow,
          scale: interpolate(localFrame, [0, closingDurationInFrames], [0.9, 1.14], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1)
          })
        }}
      />
      <div style={styles.brand}>
        <span>Lead</span>
        <strong>Emergence</strong>
        <small>AUTOMATED PLATFORM</small>
      </div>
      <main style={{ ...styles.closeContent, translate: `0px ${rise}px` }}>
        <p style={styles.eyebrow}>SCRIPTURE IN NEW FRONTIERS</p>
        <h1 style={styles.headline}>Scripture, memory, decisions, and people connected.</h1>
        <p style={styles.body}>A ministry operating system that helps leaders spend less attention coordinating work and more attention shepherding people.</p>
        <div style={styles.proofGrid}>
          <ProofCard label="YouVersion" value="Scripture opens inside the journey" />
          <ProofCard label="Meridian" value="Ministry memory grounds decisions" />
          <ProofCard label="Gloo AI Studio" value="Drafts stay reviewable and safe" />
          <ProofCard label="Leader Approval" value="No sending, writes, or AI verdicts alone" />
        </div>
        <div style={styles.cta}>Judge path: leademergence.com/login - Continue as guest</div>
      </main>
      <div style={styles.timeline}>
        <span style={{ ...styles.timelineFill, width: progress }} />
      </div>
    </AbsoluteFill>
  );
}

function ProofCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.proofCard}>
      <span style={styles.proofLabel}>{label}</span>
      <strong style={styles.proofValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    background: "#020817",
    color: "#f8fafc",
    fontFamily: "Inter, Arial, sans-serif",
    overflow: "hidden"
  },
  sourceVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  close: {
    overflow: "hidden",
    background: "linear-gradient(135deg, #020817 0%, #072133 42%, #080b16 100%)"
  },
  texture: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(rgba(125, 211, 252, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 211, 252, 0.045) 1px, transparent 1px), radial-gradient(circle at 18% 18%, rgba(34, 211, 238, 0.28), transparent 34%), radial-gradient(circle at 86% 22%, rgba(251, 191, 36, 0.20), transparent 30%)",
    backgroundSize: "96px 96px, 96px 96px, 100% 100%, 100% 100%"
  },
  glow: {
    position: "absolute",
    width: 1060,
    height: 1060,
    right: -190,
    top: -180,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(45, 212, 191, 0.28), rgba(14, 165, 233, 0.10) 56%, transparent 74%)"
  },
  brand: {
    position: "absolute",
    top: 62,
    left: 76,
    display: "grid",
    gap: 4,
    zIndex: 4,
    fontSize: 30,
    lineHeight: 0.96
  },
  closeContent: {
    position: "relative",
    zIndex: 3,
    width: 1580,
    margin: "0 auto",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 28,
    paddingTop: 52
  },
  eyebrow: {
    margin: 0,
    color: "#38bdf8",
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  headline: {
    margin: 0,
    maxWidth: 1360,
    fontSize: 92,
    lineHeight: 0.98,
    letterSpacing: 0
  },
  body: {
    margin: 0,
    maxWidth: 1180,
    color: "#cbd5e1",
    fontSize: 42,
    lineHeight: 1.2
  },
  proofGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 18,
    marginTop: 20
  },
  proofCard: {
    minHeight: 170,
    display: "grid",
    alignContent: "start",
    gap: 16,
    padding: "26px 24px",
    borderRadius: 18,
    border: "1px solid rgba(125, 211, 252, 0.28)",
    background: "linear-gradient(145deg, rgba(15, 48, 82, 0.82), rgba(15, 23, 42, 0.72))"
  },
  proofLabel: {
    color: "#22d3ee",
    fontSize: 26,
    fontWeight: 900,
    textTransform: "uppercase"
  },
  proofValue: {
    color: "#f8fafc",
    fontSize: 31,
    lineHeight: 1.08
  },
  cta: {
    marginTop: 16,
    width: "fit-content",
    padding: "20px 26px",
    borderRadius: 16,
    border: "1px solid rgba(45, 212, 191, 0.48)",
    background: "rgba(4, 120, 87, 0.28)",
    color: "#ecfeff",
    fontSize: 34,
    fontWeight: 900
  },
  timeline: {
    position: "absolute",
    left: 76,
    right: 76,
    bottom: 50,
    height: 9,
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.18)",
    overflow: "hidden",
    zIndex: 5
  },
  timelineFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #38bdf8, #22c55e, #f59e0b, #fb7185)"
  }
};

export default RemotionRoot;

registerRoot(RemotionRoot);
