/**
 * UnifiedTopArtwork
 *
 * One shared watercolor ink-wash composition that spans the ENTIRE top of the
 * application. It is mounted once at the `.app-shell` level (never inside the
 * sidebar or the fixed header) so a single continuous painting crosses the
 * sidebar/header boundary without any vertical seam.
 *
 * The composition is a real inline-SVG painting — not a stacked set of CSS
 * linear gradients:
 *   - radial-gradient pigment cores (navy / cyan / aqua / teal)
 *   - feTurbulence + feDisplacementMap for organic, feathered watercolor edges
 *   - feGaussianBlur paint blooms with pigment pooling
 *   - scattered droplet circles + ellipses (splatter)
 *   - one continuous glowing aqua arch path that starts at the absolute left
 *     edge (x=0), sweeps across the sidebar/header boundary, and fades right.
 *
 * Rendered behind the surfaces (z-index 0). The navy sidebar is transparent at
 * the very top and the glassy header is translucent, so this painting shows
 * through and unifies both regions. All real text sits on the surface layers
 * above it, so the arch and pigment never read as crossing the type.
 */
export function UnifiedTopArtwork() {
  return (
    <svg
      className="unified-top-artwork"
      viewBox="0 0 1600 150"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* ── Watercolor pigment gradients ─────────────────────── */}
        <radialGradient id="wcNavy" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#0a2a52" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#0d3a6e" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#0a2a52" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcCyan" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.72" />
          <stop offset="55%" stopColor="#1bb6d6" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcAqua" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcTeal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wcLight" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.46" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </radialGradient>

        {/* Arch line: opaque cyan at the far-left, fading to nothing right. */}
        <linearGradient id="wcArch" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="12%" stopColor="#38bdf8" stopOpacity="0.74" />
          <stop offset="42%" stopColor="#7dd3fc" stopOpacity="0.38" />
          <stop offset="70%" stopColor="#bae6fd" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0" />
        </linearGradient>

        {/* ── Filters ──────────────────────────────────────────── */}
        {/* Organic feathered edges: fractal noise pushed through a
            displacement map breaks every smooth blob into a painted edge. */}
        <filter id="wcEdge" x="-25%" y="-60%" width="150%" height="240%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.018"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="38"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Soft bloom diffusion. */}
        <filter id="wcBloom" x="-50%" y="-80%" width="200%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        {/* Gentle droplet softening. */}
        <filter id="wcDrop" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        {/* Cyan glow for the arch. */}
        <filter id="wcGlow" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>

        {/* Natural fade so the whole painting dissolves toward the right
            and the bottom instead of ending on a rectangular edge. */}
        <linearGradient id="wcFadeX" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="46%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="78%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wcFadeY" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="62%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="wcFade">
          <rect x="0" y="0" width="1600" height="150" fill="url(#wcFadeX)" />
          <rect
            x="0"
            y="0"
            width="1600"
            height="150"
            fill="url(#wcFadeY)"
            style={{ mixBlendMode: "multiply" }}
          />
        </mask>
      </defs>

      {/* Everything except the arch fades organically left→right, top→bottom. */}
      <g mask="url(#wcFade)">
        {/* Broad translucent wash spreading from the left into the header. */}
        <g filter="url(#wcBloom)" opacity="0.9">
          <ellipse cx="150" cy="58" rx="330" ry="120" fill="url(#wcAqua)" />
          <ellipse cx="430" cy="44" rx="300" ry="92" fill="url(#wcLight)" />
          <ellipse cx="40" cy="70" rx="210" ry="130" fill="url(#wcCyan)" />
        </g>

        {/* Deep navy + cyan pigment pooled near the far-left edge, with
            irregular painted edges from the turbulence displacement. */}
        <g filter="url(#wcEdge)">
          <ellipse cx="120" cy="52" rx="190" ry="98" fill="url(#wcNavy)" />
          <ellipse cx="58" cy="44" rx="120" ry="82" fill="url(#wcNavy)" opacity="0.9" />
          <ellipse cx="232" cy="66" rx="150" ry="86" fill="url(#wcCyan)" opacity="0.85" />
          <ellipse cx="350" cy="40" rx="170" ry="70" fill="url(#wcTeal)" opacity="0.8" />
          <ellipse cx="500" cy="58" rx="190" ry="66" fill="url(#wcAqua)" opacity="0.7" />
          {/* darker pigment pooling */}
          <ellipse cx="96" cy="78" rx="92" ry="44" fill="#08233f" opacity="0.5" />
          <ellipse cx="190" cy="30" rx="70" ry="40" fill="#0a3a66" opacity="0.45" />
        </g>

        {/* A couple of crisper paint blooms for depth (lighter blur). */}
        <g filter="url(#wcDrop)">
          <ellipse cx="300" cy="74" rx="78" ry="40" fill="url(#wcCyan)" opacity="0.55" />
          <ellipse cx="430" cy="36" rx="64" ry="30" fill="url(#wcLight)" opacity="0.6" />
        </g>

        {/* ── Splatter: scattered droplets + pigment marks ─────── */}
        <g filter="url(#wcDrop)" fill="#22d3ee">
          <circle cx="248" cy="14" r="4.5" opacity="0.7" />
          <circle cx="286" cy="22" r="2.6" opacity="0.6" />
          <circle cx="210" cy="9" r="2.2" opacity="0.55" />
          <circle cx="338" cy="18" r="3.4" opacity="0.5" />
          <circle cx="392" cy="12" r="2" opacity="0.5" />
          <circle cx="150" cy="116" r="3.6" opacity="0.5" />
          <circle cx="92" cy="126" r="2.4" opacity="0.45" />
          <circle cx="470" cy="24" r="2.6" opacity="0.4" />
          <circle cx="525" cy="16" r="1.8" opacity="0.38" />
          <ellipse cx="270" cy="120" rx="6" ry="3.4" opacity="0.4" />
          <ellipse cx="360" cy="112" rx="4.4" ry="2.6" opacity="0.34" />
        </g>
        <g fill="#0d3a6e">
          <circle cx="176" cy="18" r="3" opacity="0.55" />
          <circle cx="128" cy="10" r="2.2" opacity="0.5" />
          <ellipse cx="58" cy="120" rx="5" ry="3" opacity="0.4" />
        </g>
      </g>

      {/* ── Continuous glowing arch: one path from x=0, fades right ── */}
      <g>
        {/* glow underlay */}
        <path
          d="M0,96 C70,70 150,30 330,22 C520,14 760,20 1010,30 C1130,35 1260,34 1400,28"
          fill="none"
          stroke="url(#wcArch)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#wcGlow)"
          opacity="0.7"
        />
        {/* primary crisp line */}
        <path
          d="M0,96 C70,70 150,30 330,22 C520,14 760,20 1010,30 C1130,35 1260,34 1400,28"
          fill="none"
          stroke="url(#wcArch)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* faint companion arcs for depth */}
        <path
          d="M0,116 C80,88 170,46 360,38 C560,30 800,36 1040,46 C1150,51 1250,50 1360,46"
          fill="none"
          stroke="url(#wcArch)"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M0,78 C60,58 140,22 320,14 C470,8 640,12 840,18"
          fill="none"
          stroke="url(#wcArch)"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>
    </svg>
  );
}
