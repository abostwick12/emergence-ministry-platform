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
      {contestScenes.map((scene, index) => {
        const from = start;
        const duration = scene.durationSeconds * fps;
        start += duration;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={duration}>
            <ProductTourScene scene={scene} index={index} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function ProductTourScene({ scene, index }: { scene: ContestScene; index: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const vertical = height > width;
  const fade = interpolate(frame, [0, 12, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const browserScale = interpolate(frame, [0, durationInFrames], [1.02, 1.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const driftX = interpolate(frame, [0, durationInFrames], [index % 2 === 0 ? 0 : -34, index % 2 === 0 ? -48 : 18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const driftY = interpolate(frame, [0, durationInFrames], [12, -24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const copyRise = interpolate(frame, [0, 24], [38, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic)
  });
  const cursorX = interpolate(frame, [18, durationInFrames * 0.46, durationInFrames * 0.82], [74, vertical ? 62 : 72, vertical ? 44 : 58], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const cursorY = interpolate(frame, [18, durationInFrames * 0.46, durationInFrames * 0.82], [36, vertical ? 49 : 62, vertical ? 67 : 54], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const pulse = interpolate(frame % 42, [0, 16, 42], [0.35, 1, 0.35]);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={styles.ambient} />
      <div
        style={{
          ...styles.browser,
          left: vertical ? "6%" : "25%",
          right: vertical ? "6%" : "4%",
          top: vertical ? "32%" : "9%",
          bottom: vertical ? "9%" : "10%",
          scale: browserScale,
          translate: `${driftX}px ${driftY}px`
        }}
      >
        <div style={styles.browserBar}>
          <div style={styles.dots}><i /><i /><i /></div>
          <div style={styles.address}>leademergence.com</div>
          <div style={styles.secure}>LEAP</div>
        </div>
        <div style={styles.captureWrap}>
          <div style={styles.placeholder}>
            <span>{scene.eyebrow}</span>
            <strong>REAL APP CAPTURE</strong>
          </div>
          <div
            style={{
              ...styles.capture,
              backgroundImage: `url(${staticFile(scene.capture)})`
            }}
          />
          <div
            style={{
              ...styles.focusRing,
              left: `${cursorX - 6}%`,
              top: `${cursorY - 5}%`,
              opacity: pulse
            }}
          />
          <div style={{ ...styles.cursor, left: `${cursorX}%`, top: `${cursorY}%` }}>➤</div>
        </div>
      </div>

      <div style={styles.scrim} />
      <header style={styles.brand}>
        <strong>LEAD EMERGENCE</strong>
        <span>AUTOMATED PLATFORM</span>
      </header>

      <section
        style={{
          ...styles.copy,
          left: vertical ? "7%" : "5%",
          top: vertical ? "7%" : "22%",
          width: vertical ? "86%" : "39%",
          translate: `0 ${copyRise}px`
        }}
      >
        <p style={styles.eyebrow}>{scene.eyebrow}</p>
        <h1 style={{ ...styles.title, fontSize: vertical ? 64 : 78 }}>{scene.title}</h1>
        <p style={{ ...styles.body, fontSize: vertical ? 31 : 35 }}>{scene.body}</p>
        {scene.previewLabel ? <p style={styles.preview}>{scene.previewLabel}</p> : null}
      </section>

      <div style={styles.progressTrack}>
        <span
          style={{
            ...styles.progressFill,
            width: `${interpolate(frame, [0, durationInFrames], [0, 100], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            })}%`
          }}
        />
      </div>
      <div style={styles.caption}>{scene.body}</div>
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <>
      <Composition id="LeadEmergenceContestFilm" component={ContestFilm} durationInFrames={totalContestSeconds * fps} fps={fps} width={1920} height={1080} />
      <Composition id="LeadEmergenceContestFilmVertical" component={ContestFilm} durationInFrames={totalContestSeconds * fps} fps={fps} width={1080} height={1920} />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: { overflow: "hidden", background: "#020617", color: "#f8fafc", fontFamily: "Inter, Arial, sans-serif" },
  ambient: { position: "absolute", inset: 0, background: "radial-gradient(circle at 78% 18%, rgba(14,165,233,.26), transparent 32%), radial-gradient(circle at 16% 82%, rgba(139,92,246,.18), transparent 34%), linear-gradient(135deg,#020617,#071a2d 52%,#03101f)" },
  browser: { position: "absolute", overflow: "hidden", border: "1px solid rgba(125,211,252,.32)", borderRadius: 28, background: "#eaf4fb", boxShadow: "0 44px 130px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.8)", zIndex: 2 },
  browserBar: { height: 58, display: "grid", gridTemplateColumns: "120px 1fr 90px", alignItems: "center", gap: 16, padding: "0 20px", background: "linear-gradient(#f8fbfd,#dceaf3)", borderBottom: "1px solid rgba(15,23,42,.14)" },
  dots: { display: "flex", gap: 9 },
  address: { border: "1px solid rgba(15,23,42,.12)", borderRadius: 999, background: "white", color: "#334155", textAlign: "center", padding: "8px 18px", fontSize: 18, fontWeight: 700 },
  secure: { color: "#0369a1", textAlign: "right", fontWeight: 900, letterSpacing: 1.2 },
  captureWrap: { position: "absolute", inset: "58px 0 0", overflow: "hidden", background: "linear-gradient(135deg,#e0f2fe,#f8fafc)" },
  capture: { position: "absolute", inset: 0, backgroundPosition: "top center", backgroundRepeat: "no-repeat", backgroundSize: "cover", zIndex: 2 },
  placeholder: { position: "absolute", inset: 0, display: "grid", placeContent: "center", gap: 10, color: "#0f172a", textAlign: "center", background: "linear-gradient(145deg,#dbeafe,#eff6ff)", zIndex: 1 },
  focusRing: { position: "absolute", width: 130, height: 82, border: "4px solid #38bdf8", borderRadius: 18, boxShadow: "0 0 0 10px rgba(56,189,248,.16)", zIndex: 4 },
  cursor: { position: "absolute", zIndex: 5, color: "white", fontSize: 42, filter: "drop-shadow(0 4px 5px rgba(0,0,0,.7))", rotate: "-18deg" },
  scrim: { position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(2,6,23,.96),rgba(2,6,23,.84) 38%,rgba(2,6,23,.08) 62%,rgba(2,6,23,.2))", zIndex: 3, pointerEvents: "none" },
  brand: { position: "absolute", top: 42, left: 54, zIndex: 5, display: "grid", gap: 2, letterSpacing: 1.4 },
  copy: { position: "absolute", zIndex: 5, display: "grid", gap: 20 },
  eyebrow: { margin: 0, color: "#38bdf8", fontSize: 27, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 },
  title: { margin: 0, lineHeight: .98, textWrap: "balance" },
  body: { margin: 0, color: "#dbeafe", lineHeight: 1.25, fontWeight: 600 },
  preview: { margin: 0, width: "fit-content", border: "1px solid rgba(251,191,36,.5)", borderRadius: 999, background: "rgba(120,53,15,.64)", color: "#fef3c7", padding: "10px 16px", fontSize: 19, fontWeight: 800 },
  progressTrack: { position: "absolute", left: "5%", right: "5%", bottom: 94, height: 6, borderRadius: 999, overflow: "hidden", background: "rgba(148,163,184,.22)", zIndex: 6 },
  progressFill: { display: "block", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#38bdf8,#22c55e,#f59e0b)" },
  caption: { position: "absolute", left: "8%", right: "8%", bottom: 28, zIndex: 6, borderRadius: 14, background: "rgba(2,6,23,.84)", color: "white", padding: "12px 20px", textAlign: "center", fontSize: 23, fontWeight: 700 }
};

export default RemotionRoot;
registerRoot(RemotionRoot);
