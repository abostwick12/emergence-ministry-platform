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
            <KineticScene scene={scene} index={index} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function KineticScene({ scene, index }: { scene: ContestScene; index: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const vertical = height > width;
  const progress = frame / durationInFrames;

  const opacity = interpolate(frame, [0, 7, durationInFrames - 7, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const cameraScale = interpolate(
    progress,
    [0, 0.18, 0.38, 0.62, 0.82, 1],
    vertical ? [1.04, 1.12, 1.3, 1.17, 1.36, 1.2] : [1.01, 1.08, 1.24, 1.12, 1.29, 1.16],
    { easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );

  const cameraX = interpolate(
    progress,
    [0, 0.2, 0.42, 0.64, 0.84, 1],
    index % 2 === 0 ? [0, -24, -92, 34, -62, 12] : [-18, 42, -48, -105, 20, -30],
    { easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );

  const cameraY = interpolate(
    progress,
    [0, 0.2, 0.42, 0.64, 0.84, 1],
    [0, -16, -62, 22, -38, -12],
    { easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );

  const cursorX = interpolate(progress, [0.12, 0.34, 0.58, 0.82], vertical ? [72, 40, 66, 45] : [80, 64, 74, 56], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });

  const cursorY = interpolate(progress, [0.12, 0.34, 0.58, 0.82], vertical ? [44, 57, 71, 60] : [34, 58, 48, 67], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });

  const click = interpolate(frame % 64, [0, 6, 16, 64], [0, 1, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const titleY = interpolate(frame, [4, 22], [48, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic)
  });

  const titleOpacity = interpolate(frame, [3, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const browserLeft = vertical ? "5%" : progress < 0.2 ? "28%" : "20%";
  const browserRight = vertical ? "5%" : progress < 0.2 ? "4%" : "2%";
  const browserTop = vertical ? "31%" : progress < 0.2 ? "11%" : "5%";
  const browserBottom = vertical ? "8%" : progress < 0.2 ? "10%" : "4%";

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={styles.ambient} />
      <div
        style={{
          ...styles.streak,
          translate: `${interpolate(frame, [0, 20], [-420, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1)
          })}px 0px`
        }}
      />

      <div
        style={{
          ...styles.browser,
          left: browserLeft,
          right: browserRight,
          top: browserTop,
          bottom: browserBottom,
          scale: cameraScale,
          translate: `${cameraX}px ${cameraY}px`,
          rotate: vertical ? "0deg" : progress < 0.18 ? "-1.2deg" : "0deg"
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
          <div style={{ ...styles.capture, backgroundImage: `url(${staticFile(scene.capture)})` }} />
          <div
            style={{
              ...styles.clickRipple,
              left: `${cursorX}%`,
              top: `${cursorY}%`,
              opacity: click,
              scale: interpolate(click, [0, 1], [0.35, 1.35])
            }}
          />
          <ArrowCursor x={cursorX} y={cursorY} />
        </div>
      </div>

      {!vertical && progress > 0.43 && progress < 0.72 ? (
        <div
          style={{
            ...styles.featureChip,
            opacity: interpolate(progress, [0.43, 0.49, 0.66, 0.72], [0, 1, 1, 0]),
            translate: `${interpolate(progress, [0.43, 0.5], [110, 0])}px 0px`
          }}
        >
          <span>{scene.eyebrow}</span>
          <strong>{featureLine(index)}</strong>
        </div>
      ) : null}

      <div style={styles.scrim} />
      <header style={styles.brand}>
        <strong>LEAD EMERGENCE</strong>
        <span>AUTOMATED PLATFORM</span>
      </header>

      <section
        style={{
          ...styles.copy,
          left: vertical ? "7%" : "5%",
          top: vertical ? "7%" : "18%",
          width: vertical ? "86%" : "38%",
          translate: `0 ${titleY}px`,
          opacity: titleOpacity
        }}
      >
        <p style={styles.eyebrow}>{scene.eyebrow}</p>
        <h1 style={{ ...styles.title, fontSize: vertical ? 62 : 74 }}>{scene.title}</h1>
        <p style={{ ...styles.body, fontSize: vertical ? 29 : 31 }}>{scene.body}</p>
      </section>

      <div
        style={{
          ...styles.wordFlash,
          opacity: interpolate(progress, [0.7, 0.77, 0.9, 0.97], [0, 1, 1, 0]),
          scale: interpolate(progress, [0.7, 0.8], [0.88, 1])
        }}
      >
        {impactWord(index)}
      </div>

      <div style={styles.sceneCounter}>{String(index + 1).padStart(2, "0")}</div>
      <div style={styles.progressTrack}>
        <span style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
      </div>
    </AbsoluteFill>
  );
}

function ArrowCursor({ x, y }: { x: number; y: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="38"
      height="38"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        zIndex: 6,
        filter: "drop-shadow(0 3px 4px rgba(0,0,0,.72))",
        translate: "-3px -3px"
      }}
    >
      <path d="M4 3.5 26 17l-9.7 1.2 5.2 8.8-4.6 2.7-5.2-8.8L5.5 28Z" fill="#fff" stroke="#0f172a" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function featureLine(index: number) {
  return [
    "One view of what needs attention",
    "Plan the work without losing the people",
    "Make follow-through visible",
    "Prepare students to lead worship",
    "Move questions toward Scripture and community",
    "Equip leaders with reviewed, relational next steps",
    "Create space for what matters most"
  ][index] ?? "Connected ministry, clearer next steps";
}

function impactWord(index: number) {
  return ["CLARITY", "ALIGNMENT", "MOMENTUM", "WORSHIP", "SCRIPTURE", "DISCIPLESHIP", "COMMUNITY"][index] ?? "EMERGENCE";
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
  ambient: { position: "absolute", inset: 0, background: "radial-gradient(circle at 78% 16%,rgba(14,165,233,.28),transparent 34%),radial-gradient(circle at 12% 86%,rgba(139,92,246,.2),transparent 32%),linear-gradient(135deg,#020617,#06182a 54%,#020b16)" },
  streak: { position: "absolute", top: "10%", left: 0, width: 520, height: 8, background: "linear-gradient(90deg,transparent,#38bdf8,#22c55e)", boxShadow: "0 0 30px rgba(56,189,248,.65)", zIndex: 1 },
  browser: { position: "absolute", overflow: "hidden", border: "1px solid rgba(125,211,252,.32)", borderRadius: 26, background: "#eaf4fb", boxShadow: "0 44px 130px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.8)", zIndex: 2 },
  browserBar: { height: 56, display: "grid", gridTemplateColumns: "112px 1fr 84px", alignItems: "center", gap: 14, padding: "0 18px", background: "linear-gradient(#f8fbfd,#dceaf3)", borderBottom: "1px solid rgba(15,23,42,.14)" },
  dots: { display: "flex", gap: 8 },
  address: { border: "1px solid rgba(15,23,42,.12)", borderRadius: 999, background: "white", color: "#334155", textAlign: "center", padding: "7px 16px", fontSize: 17, fontWeight: 700 },
  secure: { color: "#0369a1", textAlign: "right", fontWeight: 900, letterSpacing: 1.1 },
  captureWrap: { position: "absolute", inset: "56px 0 0", overflow: "hidden", background: "linear-gradient(135deg,#e0f2fe,#f8fafc)" },
  capture: { position: "absolute", inset: 0, backgroundPosition: "top center", backgroundRepeat: "no-repeat", backgroundSize: "cover", zIndex: 2 },
  placeholder: { position: "absolute", inset: 0, display: "grid", placeContent: "center", gap: 10, color: "#0f172a", textAlign: "center", background: "linear-gradient(145deg,#dbeafe,#eff6ff)", zIndex: 1 },
  clickRipple: { position: "absolute", width: 42, height: 42, marginLeft: -21, marginTop: -21, border: "3px solid #38bdf8", borderRadius: 999, boxShadow: "0 0 0 8px rgba(56,189,248,.14)", zIndex: 5 },
  featureChip: { position: "absolute", right: "4%", bottom: "13%", zIndex: 5, width: 430, border: "1px solid rgba(125,211,252,.3)", borderRadius: 22, background: "rgba(3,14,28,.88)", boxShadow: "0 20px 70px rgba(0,0,0,.42)", padding: "22px 26px", display: "grid", gap: 8 },
  scrim: { position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(2,6,23,.98),rgba(2,6,23,.84) 37%,rgba(2,6,23,.06) 62%,rgba(2,6,23,.14))", zIndex: 3, pointerEvents: "none" },
  brand: { position: "absolute", top: 38, left: 50, zIndex: 7, display: "grid", gap: 1, letterSpacing: 1.3 },
  copy: { position: "absolute", zIndex: 7, display: "grid", gap: 18 },
  eyebrow: { margin: 0, color: "#38bdf8", fontSize: 25, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 },
  title: { margin: 0, lineHeight: .98, textWrap: "balance" },
  body: { margin: 0, color: "#dbeafe", lineHeight: 1.24, fontWeight: 600 },
  wordFlash: { position: "absolute", right: "5%", top: "13%", zIndex: 7, color: "rgba(255,255,255,.96)", fontSize: 76, fontWeight: 950, letterSpacing: 3, textShadow: "0 12px 50px rgba(56,189,248,.35)" },
  sceneCounter: { position: "absolute", right: 40, bottom: 34, zIndex: 8, color: "rgba(186,230,253,.8)", fontSize: 20, fontWeight: 900, letterSpacing: 2 },
  progressTrack: { position: "absolute", left: "5%", right: "8%", bottom: 42, height: 5, borderRadius: 999, overflow: "hidden", background: "rgba(148,163,184,.2)", zIndex: 7 },
  progressFill: { display: "block", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#38bdf8,#22c55e,#f59e0b)" }
};

export default RemotionRoot;
registerRoot(RemotionRoot);
