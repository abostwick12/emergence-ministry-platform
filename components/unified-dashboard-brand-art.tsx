/**
 * UnifiedDashboardBrandArt
 *
 * ONE shared watercolor brand painting for the entire top of the app. A single
 * inline SVG, mounted once at the `.app-shell` level (never inside the sidebar
 * and never duplicated inside the header) so a single continuous composition
 * crosses the sidebar → header boundary with no seam.
 *
 * Visual target — light + airy, NOT a heavy left-side mass:
 *   - the dashboard header stays mostly CLEAN WHITE behind the DASHBOARD title;
 *   - the densest watercolor is a teal / cyan / aqua SPLATTER cluster right at
 *     the sidebar → header seam, bleeding out of the navy sidebar into the
 *     header with crisp scattered droplets;
 *   - a softer secondary blue / cyan bloom sits TOP-RIGHT near the Stub Mode
 *     pill and notification bell;
 *   - one thin, elegant steel-blue ARCH line starts at the far-left edge,
 *     crests high above the DASHBOARD title (never through the text) and slopes
 *     gently down to the right, carrying two small ring "node" accents, then
 *     fades out near the right edge.
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
        {/* ── Watercolor pigment gradients (light, translucent) ─── */}
        <radialGradient id="baTeal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#2dd4bf" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baCyan" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="58%" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baAqua" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baSky" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baInk" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>

        {/* ── Filters ──────────────────────────────────────────── */}
        {/* Organic feathered watercolor edges. */}
        <filter id="baEdge" x="-30%" y="-70%" width="160%" height="260%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Soft bloom diffusion. */}
        <filter id="baBloom" x="-50%" y="-80%" width="200%" height="260%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        {/* Gentle droplet softening. */}
        <filter id="baDrop" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>

        {/* Bottom fade so the painting dissolves softly into the white page
            below the header instead of ending on a hard edge. */}
        <linearGradient id="baFadeYGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="58%" stopColor="#fff" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="baFadeY">
          <rect x="0" y="0" width="1440" height="200" fill="url(#baFadeYGrad)" />
        </mask>
      </defs>

      {/* Watercolor dissolves softly toward the bottom. */}
      <g mask="url(#baFadeY)">
        {/* Subtle blue tint behind the Lead Emergence wordmark (sidebar top). */}
        <g filter="url(#baBloom)" opacity="0.6">
          <ellipse cx="120" cy="48" rx="190" ry="120" fill="url(#baInk)" />
        </g>

        {/* ── Splatter cluster at the sidebar → header seam (densest) ── */}
        <g filter="url(#baBloom)" opacity="0.92">
          <ellipse cx="320" cy="70" rx="190" ry="118" fill="url(#baCyan)" />
          <ellipse cx="430" cy="92" rx="160" ry="120" fill="url(#baTeal)" opacity="0.85" />
          <ellipse cx="270" cy="48" rx="130" ry="92" fill="url(#baAqua)" />
          <ellipse cx="500" cy="60" rx="150" ry="86" fill="url(#baSky)" opacity="0.7" />
        </g>
        <g filter="url(#baEdge)">
          <ellipse cx="338" cy="78" rx="156" ry="100" fill="url(#baCyan)" opacity="0.7" />
          <ellipse cx="452" cy="104" rx="126" ry="96" fill="url(#baTeal)" opacity="0.62" />
          <ellipse cx="248" cy="44" rx="96" ry="66" fill="url(#baSky)" opacity="0.6" />
        </g>

        {/* ── Softer secondary bloom: top-right near Stub Mode + bell ── */}
        <g filter="url(#baBloom)" opacity="0.82">
          <ellipse cx="1290" cy="54" rx="240" ry="124" fill="url(#baAqua)" />
          <ellipse cx="1392" cy="34" rx="170" ry="96" fill="url(#baCyan)" opacity="0.72" />
          <ellipse cx="1165" cy="78" rx="138" ry="98" fill="url(#baSky)" opacity="0.8" />
        </g>
        <g filter="url(#baEdge)">
          <ellipse cx="1312" cy="58" rx="176" ry="98" fill="url(#baAqua)" opacity="0.62" />
          <ellipse cx="1190" cy="70" rx="120" ry="72" fill="url(#baCyan)" opacity="0.5" />
        </g>

        {/* ── Splatter droplets scattering from the seam cluster ── */}
        <g filter="url(#baDrop)" fill="#22d3ee">
          <circle cx="520" cy="58" r="4.2" opacity="0.72" />
          <circle cx="566" cy="86" r="3" opacity="0.62" />
          <circle cx="610" cy="116" r="2.4" opacity="0.5" />
          <circle cx="498" cy="150" r="3.6" opacity="0.55" />
          <circle cx="648" cy="78" r="2" opacity="0.44" />
          <circle cx="436" cy="172" r="3" opacity="0.5" />
          <circle cx="392" cy="150" r="2.4" opacity="0.46" />
          <circle cx="588" cy="44" r="2.2" opacity="0.5" />
          <circle cx="300" cy="22" r="3" opacity="0.5" />
          <circle cx="350" cy="14" r="2" opacity="0.44" />
        </g>
        <g filter="url(#baDrop)" fill="#2dd4bf">
          <circle cx="540" cy="120" r="3.2" opacity="0.5" />
          <circle cx="470" cy="60" r="2.4" opacity="0.5" />
          <ellipse cx="600" cy="150" rx="6" ry="3.4" opacity="0.4" />
          <ellipse cx="412" cy="120" rx="5" ry="3" opacity="0.42" />
        </g>
        {/* a few light droplets around the top-right bloom */}
        <g filter="url(#baDrop)" fill="#38bdf8">
          <circle cx="1150" cy="40" r="3" opacity="0.46" />
          <circle cx="1110" cy="64" r="2.2" opacity="0.4" />
          <circle cx="1200" cy="26" r="2.4" opacity="0.42" />
          <circle cx="1248" cy="92" r="2.6" opacity="0.34" />
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
