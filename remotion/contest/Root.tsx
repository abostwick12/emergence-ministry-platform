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
  useVideoConfig
} from "remotion";
import { contestScenes, totalContestSeconds, type ContestScene } from "../../lib/contest-video";

const fps = 30;

export function ContestFilm() {
  let start = 0;
  return (
    <AbsoluteFill style={styles.canvas}>
      {contestScenes.map((scene) => {
        const from = start;
        const duration = scene.durationSeconds * fps;
        start += duration;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={duration}>
            <Scene scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function Scene({ scene }: { scene: ContestScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, 18, durationInFrames - 18, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = interpolate(frame, [0, durationInFrames], [1.035, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic)
  });
  const rise = interpolate(frame, [0, 28], [42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic)
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div
        style={{
          ...styles.capture,
          backgroundImage: `url(${staticFile(scene.capture)})`,
          transform: `scale(${scale})`
        }}
      />
      <div style={styles.placeholderVisual}>
        <div style={styles.placeholderGlow} />
        <div style={styles.placeholderFrame}>
          <div style={styles.placeholderTopline}>
            <span>{scene.eyebrow}</span>
            <strong>REAL PAGE CAPTURE SLOT</strong>
          </div>
          <div style={styles.placeholderGrid}>
            <i />
            <i />
            <i />
          </div>
          <div style={styles.placeholderRows}>
            <b />
            <b />
            <b />
          </div>
        </div>
      </div>
      <div style={styles.scrim} />
      <header style={styles.brand}>
        <strong>LEAD EMERGENCE</strong>
        <span>AUTOMATED PLATFORM</span>
      </header>
      <section style={{ ...styles.copy, transform: `translateY(${rise}px)` }}>
        <p style={styles.eyebrow}>{scene.eyebrow}</p>
        <h1 style={styles.title}>{scene.title}</h1>
        <p style={styles.body}>{scene.body}</p>
        {scene.previewLabel ? <p style={styles.preview}>{scene.previewLabel}</p> : null}
      </section>
      <div style={styles.caption}>{scene.body}</div>
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="LeadEmergenceContestFilm"
        component={ContestFilm}
        durationInFrames={totalContestSeconds * fps}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="LeadEmergenceContestFilmVertical"
        component={ContestFilm}
        durationInFrames={totalContestSeconds * fps}
        fps={fps}
        width={1080}
        height={1920}
      />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    overflow: "hidden",
    background: "#020617",
    color: "#f8fafc",
    fontFamily: "Inter, Arial, sans-serif"
  },
  capture: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    zIndex: 1
  },
  placeholderVisual: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "linear-gradient(135deg, #020817 0%, #08213a 48%, #050a16 100%)"
  },
  placeholderGlow: {
    position: "absolute",
    width: 900,
    height: 900,
    right: -180,
    top: -180,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(56,189,248,.34), rgba(14,165,233,.08) 58%, transparent 72%)"
  },
  placeholderFrame: {
    position: "absolute",
    right: "6%",
    top: "16%",
    width: "42%",
    minHeight: "58%",
    display: "grid",
    gap: 24,
    padding: 32,
    border: "1px solid rgba(125,211,252,.28)",
    borderRadius: 28,
    background: "linear-gradient(145deg, rgba(15,48,82,.88), rgba(7,20,39,.9))",
    boxShadow: "0 34px 90px rgba(0,0,0,.34)"
  },
  placeholderTopline: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    color: "#bae6fd",
    fontSize: 20,
    fontWeight: 800
  },
  placeholderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 16
  },
  placeholderRows: {
    display: "grid",
    gap: 18
  },
  scrim: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    background: "linear-gradient(90deg, rgba(2,6,23,.96) 0%, rgba(2,6,23,.82) 42%, rgba(2,6,23,.24) 74%, rgba(2,6,23,.5) 100%)"
  },
  brand: {
    position: "absolute",
    top: 58,
    left: 72,
    display: "grid",
    gap: 2,
    letterSpacing: 1.5,
    zIndex: 3
  },
  copy: {
    position: "absolute",
    left: 72,
    top: 210,
    width: "min(860px, 76%)",
    display: "grid",
    gap: 24,
    zIndex: 3
  },
  eyebrow: {
    margin: 0,
    color: "#38bdf8",
    fontSize: 30,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1.4
  },
  title: {
    margin: 0,
    fontSize: 84,
    lineHeight: 0.98,
    textWrap: "balance"
  },
  body: {
    margin: 0,
    maxWidth: 800,
    color: "#dbeafe",
    fontSize: 38,
    lineHeight: 1.25,
    fontWeight: 600
  },
  preview: {
    margin: 0,
    width: "fit-content",
    border: "1px solid rgba(251,191,36,.5)",
    borderRadius: 999,
    background: "rgba(120,53,15,.64)",
    color: "#fef3c7",
    padding: "10px 16px",
    fontSize: 20,
    fontWeight: 800
  },
  caption: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: 42,
    zIndex: 4,
    borderRadius: 14,
    background: "rgba(2,6,23,.82)",
    color: "white",
    padding: "14px 22px",
    textAlign: "center",
    fontSize: 25,
    fontWeight: 700
  }
};

styles.placeholderGrid_i = {
  minHeight: 118,
  borderRadius: 18,
  background: "rgba(56,189,248,.18)",
  border: "1px solid rgba(125,211,252,.2)"
};

styles.placeholderRows_b = {
  height: 58,
  borderRadius: 16,
  background: "rgba(125,211,252,.14)",
  border: "1px solid rgba(125,211,252,.16)"
};

export default RemotionRoot;
registerRoot(RemotionRoot);
