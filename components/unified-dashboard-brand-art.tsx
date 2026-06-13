/**
 * UnifiedDashboardBrandArt
 *
 * ONE shared watercolor brand painting for the entire top of the app. A single
 * inline SVG, mounted once at the `.app-shell` level (never inside the sidebar
 * and never duplicated inside the header) so a single continuous composition
 * crosses the sidebar → header boundary with no seam.
 *
 * The watercolor is built as deliberate PAINT, not a smooth gradient:
 *   - Layer 1 — a very light horizontal paper wash, lighter in the center so the
 *     DASHBOARD title stays readable, tinted only toward the outer edges.
 *   - Layer 2 — irregular pigment BLOOMS near the far-left (reaching across the
 *     logo area, horizontally, so there is no hard vertical split) and far-right
 *     edges. Each bloom uses edge-weighted radial gradients (more pigment at the
 *     rim, like a real watercolor stain) and is feathered by a turbulence
 *     displacement filter — NOT a big Gaussian blur — so the edges read as
 *     hand-painted, with darker "pigment pooling" spots inside.
 *   - Layer 3 — small, crisp SPLATTER droplets and fine speckles concentrated
 *     near the left/right edges and lightly around the arc.
 * The center stays clean.
 *
 * Coordinate system: a full-page reference viewBox (0 0 1440 200) stretched to
 * the real page width with `preserveAspectRatio="none"`.
 *
 * Two layers, ONE composition:
 *   - `.unified-brand-art` (z-index 0) holds the WATERCOLOR — it sits behind
 *     every surface; the transparent sidebar top + translucent glass header let
 *     it read through both regions.
 *   - `.unified-brand-arch` (above the glass header) holds the single thin ARCH
 *     line + ring nodes, so the delicate line reads crisply across the top
 *     instead of being washed out behind the frosted header. It is one
 *     continuous path and is pointer-events:none, so it never blocks the UI.
 */
export function UnifiedDashboardBrandArt() {
  return (
    <>
    <svg
      className="unified-brand-art"
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* ── Edge-stained pigment gradients ──────────────────────
            Each bloom is more pigmented at ~74–80% of its radius than at the
            centre, mimicking how watercolor pigment migrates to the drying
            edge (the "bloom"/"cauliflower" stain). */}
        <radialGradient id="wcTeal" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.30" />
          <stop offset="44%" stopColor="#14b8a6" stopOpacity="0.18" />
          <stop offset="76%" stopColor="#0d9488" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcCyan" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="#34d3ee" stopOpacity="0.34" />
          <stop offset="42%" stopColor="#06b6d4" stopOpacity="0.20" />
          <stop offset="78%" stopColor="#0891b2" stopOpacity="0.56" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcAqua" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.30" />
          <stop offset="48%" stopColor="#38bdf8" stopOpacity="0.16" />
          <stop offset="80%" stopColor="#0ea5e9" stopOpacity="0.44" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcBlue" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.24" />
          <stop offset="78%" stopColor="#3b82f6" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcLight" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#cffafe" stopOpacity="0.42" />
          <stop offset="70%" stopColor="#a5f3fc" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#a5f3fc" stopOpacity="0" />
        </radialGradient>

        {/* Layer 1 — horizontal paper wash: tinted at the edges, clean centre. */}
        <linearGradient id="wcWashX" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.20" />
          <stop offset="15%" stopColor="#67e8f9" stopOpacity="0.11" />
          <stop offset="36%" stopColor="#a5f3fc" stopOpacity="0.03" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="64%" stopColor="#bae6fd" stopOpacity="0.04" />
          <stop offset="85%" stopColor="#7dd3fc" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.20" />
        </linearGradient>

        {/* ── Filters ──────────────────────────────────────────── */}
        {/* Hand-painted feathered edges: fractal noise pushed through a
            displacement map breaks each smooth ellipse into an organic,
            blotchy watercolor shape. A light blur only softens it — the
            character comes from the displacement, not the blur. */}
        <filter id="wcFeather" x="-10%" y="-28%" width="120%" height="158%">
          <feTurbulence type="fractalNoise" baseFrequency="0.016 0.024" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        {/* Bottom fade so the painting dissolves softly into the white page
            below the header instead of ending on a hard edge. */}
        <linearGradient id="wcFadeYGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="wcFadeY">
          <rect x="0" y="0" width="1440" height="200" fill="url(#wcFadeYGrad)" />
        </mask>
      </defs>

      {/* Everything dissolves softly toward the bottom. */}
      <g mask="url(#wcFadeY)">
        {/* Layer 1 — light horizontal paper wash. */}
        <rect x="0" y="0" width="1440" height="200" fill="url(#wcWashX)" />

        {/* Layer 2 — LEFT pigment bloom. Reaches across the logo area and
            spreads horizontally into the header (wide, not a vertical column),
            with feathered edges. Bright aqua/cyan so it reads on the navy. */}
        <g filter="url(#wcFeather)">
          <ellipse cx="70" cy="52" rx="150" ry="72" fill="url(#wcAqua)" />
          <ellipse cx="210" cy="66" rx="205" ry="86" fill="url(#wcCyan)" />
          <ellipse cx="360" cy="80" rx="178" ry="72" fill="url(#wcTeal)" />
          <ellipse cx="150" cy="38" rx="120" ry="52" fill="url(#wcLight)" opacity="0.7" />
          <ellipse cx="478" cy="58" rx="140" ry="54" fill="url(#wcAqua)" opacity="0.7" />
          {/* darker pigment pooling inside the left bloom */}
          <ellipse cx="120" cy="86" rx="66" ry="30" fill="#0e7490" opacity="0.34" />
          <ellipse cx="300" cy="44" rx="58" ry="26" fill="#0891b2" opacity="0.30" />
          <ellipse cx="236" cy="104" rx="52" ry="24" fill="#0d9488" opacity="0.26" />
        </g>

        {/* Layer 2 — RIGHT pigment bloom near the notification / right edge. */}
        <g filter="url(#wcFeather)">
          <ellipse cx="1305" cy="56" rx="210" ry="84" fill="url(#wcAqua)" />
          <ellipse cx="1402" cy="44" rx="150" ry="78" fill="url(#wcCyan)" />
          <ellipse cx="1210" cy="74" rx="150" ry="66" fill="url(#wcBlue)" opacity="0.85" />
          <ellipse cx="1330" cy="38" rx="118" ry="46" fill="url(#wcLight)" opacity="0.7" />
          {/* darker pigment pooling inside the right bloom */}
          <ellipse cx="1362" cy="82" rx="70" ry="30" fill="#0891b2" opacity="0.30" />
          <ellipse cx="1248" cy="48" rx="56" ry="24" fill="#0ea5e9" opacity="0.26" />
        </g>

        {/* Layer 3 — splatter droplets + fine speckles near the LEFT edge. */}
        <g fill="#0891b2">
          <circle cx="86" cy="120" r="5.5" opacity="0.6" />
          <circle cx="150" cy="150" r="3.4" opacity="0.5" />
          <circle cx="250" cy="24" r="4.2" opacity="0.5" />
          <circle cx="330" cy="120" r="3" opacity="0.46" />
          <circle cx="430" cy="150" r="4.6" opacity="0.42" />
          <circle cx="500" cy="70" r="3" opacity="0.44" />
          <circle cx="556" cy="118" r="2.6" opacity="0.4" />
          <circle cx="120" cy="40" r="2" opacity="0.5" />
          <circle cx="392" cy="40" r="2.2" opacity="0.42" />
          <circle cx="600" cy="96" r="2.2" opacity="0.36" />
        </g>
        <g fill="#0d9488">
          <circle cx="186" cy="106" r="2" opacity="0.5" />
          <circle cx="270" cy="150" r="2.4" opacity="0.44" />
          <circle cx="470" cy="40" r="1.8" opacity="0.44" />
          <circle cx="64" cy="150" r="2.2" opacity="0.4" />
        </g>

        {/* Layer 3 — splatter droplets + fine speckles near the RIGHT edge. */}
        <g fill="#0ea5e9">
          <circle cx="1100" cy="58" r="3" opacity="0.46" />
          <circle cx="1160" cy="30" r="2.4" opacity="0.42" />
          <circle cx="1250" cy="120" r="4.4" opacity="0.5" />
          <circle cx="1330" cy="150" r="3.4" opacity="0.46" />
          <circle cx="1392" cy="92" r="4.8" opacity="0.5" />
          <circle cx="1430" cy="40" r="3" opacity="0.44" />
          <circle cx="1300" cy="24" r="2.4" opacity="0.42" />
          <circle cx="1180" cy="120" r="2.6" opacity="0.4" />
        </g>
        <g fill="#0891b2">
          <circle cx="1360" cy="64" r="2" opacity="0.46" />
          <circle cx="1410" cy="150" r="2.4" opacity="0.4" />
          <circle cx="1140" cy="92" r="1.8" opacity="0.4" />
        </g>
      </g>

    </svg>

    {/* ── Arch overlay: ONE thin line + ring nodes, rendered ABOVE the glass
         header so the delicate steel-blue line reads crisply across the top
         (matches the reference) instead of washing out behind the frost.
         pointer-events:none keeps it from blocking the UI. ── */}
    <svg
      className="unified-brand-arch"
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Thin arch line. Transparent across the sidebar (~left 18%) so it
            never draws over the Lead Emergence wordmark, then steel-blue across
            the header, fading out before the right edge. */}
        <linearGradient id="baArch" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0" />
          <stop offset="15%" stopColor="#93c5fd" stopOpacity="0" />
          <stop offset="22%" stopColor="#7dafe0" stopOpacity="0.72" />
          <stop offset="50%" stopColor="#5b9bf0" stopOpacity="0.92" />
          <stop offset="84%" stopColor="#7dafe0" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
        </linearGradient>
        <filter id="baGlow" x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* faint companion arc */}
      <path
        d="M0,60 C170,40 390,28 680,26 C920,24 1060,38 1140,50 C1205,62 1330,86 1440,104"
        fill="none"
        stroke="url(#baArch)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* soft glow underlay. Crests well above the DASHBOARD title and descends
          only on the far right (right of the welcome line, left of the Stub
          Mode pill) so the line + nodes never cross any text. */}
      <path
        d="M0,46 C170,24 390,12 680,10 C920,8 1060,22 1140,34 C1175,40 1205,46 1260,58 C1330,73 1390,82 1440,92"
        fill="none"
        stroke="url(#baArch)"
        strokeWidth="3.4"
        strokeLinecap="round"
        filter="url(#baGlow)"
        opacity="0.5"
      />
      {/* primary thin line */}
      <path
        d="M0,46 C170,24 390,12 680,10 C920,8 1060,22 1140,34 C1175,40 1205,46 1260,58 C1330,73 1390,82 1440,92"
        fill="none"
        stroke="url(#baArch)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* ring node accents in the clear gap between the welcome line and the
          Stub Mode pill (holds across 1280–1440 desktop widths). */}
      <g>
        <circle cx="1140" cy="34" r="7.5" fill="#ffffff" fillOpacity="0.95" stroke="#5b9bf0" strokeWidth="1.8" />
        <circle cx="1140" cy="34" r="2.2" fill="#5b9bf0" fillOpacity="0.65" />
        <circle cx="1205" cy="46" r="7.5" fill="#ffffff" fillOpacity="0.95" stroke="#5b9bf0" strokeWidth="1.8" />
        <circle cx="1205" cy="46" r="2.2" fill="#5b9bf0" fillOpacity="0.65" />
      </g>
    </svg>
    </>
  );
}
