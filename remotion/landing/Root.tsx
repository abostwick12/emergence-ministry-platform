import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  registerRoot,
  Sequence,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { landingVideoScenes, type LandingVideoScene } from "../../lib/landing-video";

const fps = 30;
const secondsPerScene = 7;
const sceneFrames = fps * secondsPerScene;
const width = 1920;
const height = 1080;

export function RemotionRoot() {
  return (
    <Composition
      id="LeadEmergenceLandingVideo"
      component={LeadEmergenceLandingVideo}
      durationInFrames={landingVideoScenes.length * sceneFrames}
      fps={fps}
      width={width}
      height={height}
      defaultProps={{ scenes: landingVideoScenes }}
    />
  );
}

export function LeadEmergenceLandingVideo({ scenes }: { scenes: LandingVideoScene[] }) {
  return (
    <AbsoluteFill style={styles.canvas}>
      <div style={styles.texture} />
      <div style={styles.brand}>
        <span>Lead</span>
        <strong>Emergence</strong>
        <small>AUTOMATED PLATFORM</small>
      </div>
      {scenes.map((scene, index) => (
        <Sequence from={index * sceneFrames} durationInFrames={sceneFrames} key={scene.eyebrow}>
          <LandingScene scene={scene} index={index} total={scenes.length} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function LandingScene({ scene, index, total }: { scene: LandingVideoScene; index: number; total: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progressWidth = `${((index + interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) / total) * 100}%`;

  return (
    <AbsoluteFill
      style={{
        ...styles.scene,
        opacity: interpolate(frame, [0, 18, durationInFrames - 18, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1)
        })
      }}
    >
      <div
        style={{
          ...styles.glow,
          background: accentGradient(scene.accent),
          scale: interpolate(frame, [0, durationInFrames], [0.92, 1.08], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1)
          })
        }}
      />
      <section style={styles.copy}>
        <p style={styles.eyebrow}>{scene.eyebrow}</p>
        <h1 style={styles.title}>{scene.title}</h1>
        <p style={styles.body}>{scene.body}</p>
      </section>
      <aside
        style={{
          ...styles.product,
          translate: interpolate(frame, [0, 28], ["90px 0px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1)
          })
        }}
      >
        <div style={styles.productTop}>
          <span>{scene.productArea}</span>
          <strong>{scene.metric}</strong>
        </div>
        <div style={styles.productGrid}>
          <div style={styles.metricCard} />
          <div style={styles.metricCard} />
          <div style={styles.metricCard} />
        </div>
        <div style={styles.productRows}>
          <i style={styles.row} />
          <i style={styles.row} />
          <i style={styles.rowShort} />
        </div>
      </aside>
      <div style={styles.timeline}>
        <span style={{ ...styles.timelineFill, width: progressWidth }} />
      </div>
    </AbsoluteFill>
  );
}

function accentGradient(accent: LandingVideoScene["accent"]) {
  const colors: Record<LandingVideoScene["accent"], string> = {
    cyan: "radial-gradient(circle, rgba(56, 189, 248, 0.42), rgba(14, 165, 233, 0.08) 58%, transparent 72%)",
    blue: "radial-gradient(circle, rgba(37, 99, 235, 0.42), rgba(56, 189, 248, 0.10) 58%, transparent 72%)",
    emerald: "radial-gradient(circle, rgba(16, 185, 129, 0.36), rgba(45, 212, 191, 0.10) 58%, transparent 72%)",
    violet: "radial-gradient(circle, rgba(139, 92, 246, 0.34), rgba(14, 165, 233, 0.08) 58%, transparent 72%)",
    amber: "radial-gradient(circle, rgba(245, 158, 11, 0.34), rgba(56, 189, 248, 0.08) 58%, transparent 72%)",
    rose: "radial-gradient(circle, rgba(244, 63, 94, 0.34), rgba(14, 165, 233, 0.08) 58%, transparent 72%)"
  };
  return colors[accent];
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    overflow: "hidden",
    background: "linear-gradient(135deg, #020817 0%, #08213a 48%, #050a16 100%)",
    color: "#f8fafc",
    fontFamily: "Inter, Arial, sans-serif"
  },
  texture: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 8% 8%, rgba(56, 189, 248, 0.24), transparent 30%), radial-gradient(circle at 88% 18%, rgba(244, 114, 182, 0.16), transparent 28%), linear-gradient(120deg, rgba(255,255,255,0.06), transparent 36%)"
  },
  brand: {
    position: "absolute",
    top: 72,
    left: 88,
    display: "grid",
    gap: 4,
    zIndex: 3
  },
  scene: {
    padding: "190px 104px 112px",
    display: "grid",
    gridTemplateColumns: "1fr 760px",
    alignItems: "center",
    gap: 82
  },
  glow: {
    position: "absolute",
    width: 980,
    height: 980,
    right: -180,
    top: -120,
    borderRadius: 999
  },
  copy: {
    display: "grid",
    gap: 28,
    maxWidth: 840,
    zIndex: 2
  },
  eyebrow: {
    margin: 0,
    color: "#38bdf8",
    fontSize: 34,
    fontWeight: 900,
    textTransform: "uppercase"
  },
  title: {
    margin: 0,
    fontSize: 92,
    lineHeight: 0.96,
    maxWidth: 860
  },
  body: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 42,
    lineHeight: 1.22,
    maxWidth: 760
  },
  product: {
    zIndex: 2,
    display: "grid",
    gap: 28,
    minHeight: 560,
    padding: 34,
    border: "1px solid rgba(125, 211, 252, 0.32)",
    borderRadius: 28,
    background: "linear-gradient(145deg, rgba(15, 48, 82, 0.90), rgba(7, 20, 39, 0.90))",
    boxShadow: "0 34px 90px rgba(0, 0, 0, 0.34)"
  },
  productTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 28,
    alignItems: "center",
    fontSize: 30,
    color: "#bae6fd"
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18
  },
  metricCard: {
    minHeight: 126,
    borderRadius: 20,
    background: "linear-gradient(145deg, rgba(56, 189, 248, 0.20), rgba(15, 23, 42, 0.42))",
    border: "1px solid rgba(125, 211, 252, 0.24)"
  },
  productRows: {
    display: "grid",
    gap: 20
  },
  row: {
    height: 62,
    borderRadius: 18,
    background: "rgba(125, 211, 252, 0.15)",
    border: "1px solid rgba(125, 211, 252, 0.18)"
  },
  rowShort: {
    height: 62,
    width: "72%",
    borderRadius: 18,
    background: "rgba(45, 212, 191, 0.16)",
    border: "1px solid rgba(45, 212, 191, 0.20)"
  },
  timeline: {
    position: "absolute",
    left: 104,
    right: 104,
    bottom: 76,
    height: 9,
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.20)",
    overflow: "hidden",
    zIndex: 4
  },
  timelineFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #38bdf8, #22c55e, #f59e0b)"
  }
};

export default RemotionRoot;

registerRoot(RemotionRoot);
