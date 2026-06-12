/**
 * UnifiedDashboardBrandArt
 *
 * ONE shared watercolor brand painting for the entire top of the app. It is a
 * single inline SVG, mounted once at the `.app-shell` level (never inside the
 * sidebar and never duplicated inside the header), so a single continuous
 * composition crosses the sidebar → header boundary with no seam.
 *
 * Coordinate system: a full-page reference viewBox (0 0 1440 200) stretched to
 * the real page width with `preserveAspectRatio="none"`. On a typical desktop
 * the navy sidebar is ~264px ≈ x18 of this box, so the painting is laid out so
 * that:
 *   - irregular NAVY pigment concentrates at the far-left edge (x0–300),
 *     pooling around the Lead Emergence wordmark;
 *   - layered CYAN / TEAL / AQUA blooms spread RIGHT through the sidebar
 *     boundary into roughly the left 45–50% of the page (x300–700) — i.e. well
 *     into the dashboard header, not stopping at the sidebar edge;
 *   - splatter droplets scatter from the wordmark out into the header (x up to
 *     ~720) so the header is never flat white;
 *   - one continuous glowing cyan ARCH path starts at the absolute left edge
 *     (x=0), sweeps up over the wordmark, crosses the boundary and arcs across
 *     the header above the DASHBOARD title, then fades to nothing on the right.
 *
 * The painting renders behind every surface (z-index 0). The sidebar is
 * transparent at the very top and the dashboard header is translucent glass, so
 * this one composition reads through both regions as a single unified painting.
 * All real text sits on the surface layers above, so pigment/arch never cross
 * type.
 */
export function UnifiedDashboardBrandArt() {
  return (
    <svg
      className="unified-brand-art"
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* ── Watercolor pigment gradients ─────────────────────── */}
        <radialGradient id="baNavy" cx="50%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#0a2a52" stopOpacity="0.97" />
          <stop offset="46%" stopColor="#0d3a6e" stopOpacity="0.66" />
          <stop offset="100%" stopColor="#0a2a52" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baCyan" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.80" />
          <stop offset="55%" stopColor="#1bb6d6" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baAqua" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.62" />
          <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baTeal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.50" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baLight" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </radialGradient>

        {/* Arch line: saturated cyan at the far-left, fading to nothing right.
            Deeper hues hold contrast against the pale cyan wash behind. */}
        <linearGradient id="baArch" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0891b2" stopOpacity="0.98" />
          <stop offset="14%" stopColor="#0ea5e9" stopOpacity="0.9" />
          <stop offset="46%" stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="74%" stopColor="#7dd3fc" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </linearGradient>

        {/* ── Filters ──────────────────────────────────────────── */}
        {/* Organic feathered edges: fractal noise pushed through a
            displacement map breaks every smooth blob into a painted edge. */}
        <filter id="baEdge" x="-25%" y="-60%" width="150%" height="240%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.010 0.017"
            numOctaves="3"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="44"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Soft bloom diffusion. */}
        <filter id="baBloom" x="-50%" y="-80%" width="200%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        {/* Gentle droplet softening. */}
        <filter id="baDrop" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        {/* Cyan glow for the arch. */}
        <filter id="baGlow" x="-20%" y="-220%" width="140%" height="540%">
          <feGaussianBlur stdDeviation="3" />
        </filter>

        {/* Natural fade so the whole painting dissolves toward the right and
            the bottom instead of ending on a rectangular edge. The X fade
            stays strong out to ~48% so the wash reaches into the header. */}
        <linearGradient id="baFadeX" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="48%" stopColor="#fff" stopOpacity="0.88" />
          <stop offset="80%" stopColor="#fff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="baFadeY" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="64%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="baFade">
          <rect x="0" y="0" width="1440" height="200" fill="url(#baFadeX)" />
          <rect
            x="0"
            y="0"
            width="1440"
            height="200"
            fill="url(#baFadeY)"
            style={{ mixBlendMode: "multiply" }}
          />
        </mask>
      </defs>

      {/* Everything except the arch fades organically left→right, top→bottom. */}
      <g mask="url(#baFade)">
        {/* Broad translucent wash spreading from the left deep into the header. */}
        <g filter="url(#baBloom)" opacity="0.92">
          <ellipse cx="190" cy="80" rx="430" ry="160" fill="url(#baAqua)" />
          <ellipse cx="540" cy="58" rx="380" ry="120" fill="url(#baLight)" />
          <ellipse cx="60" cy="92" rx="260" ry="170" fill="url(#baCyan)" />
          <ellipse cx="700" cy="70" rx="300" ry="104" fill="url(#baTeal)" opacity="0.7" />
        </g>

        {/* Deep navy + cyan pigment pooled near the far-left edge, with
            irregular painted edges from the turbulence displacement. */}
        <g filter="url(#baEdge)">
          <ellipse cx="150" cy="70" rx="240" ry="128" fill="url(#baNavy)" />
          <ellipse cx="64" cy="58" rx="150" ry="108" fill="url(#baNavy)" opacity="0.92" />
          <ellipse cx="300" cy="86" rx="200" ry="112" fill="url(#baCyan)" opacity="0.88" />
          <ellipse cx="460" cy="52" rx="220" ry="92" fill="url(#baTeal)" opacity="0.82" />
          <ellipse cx="650" cy="74" rx="250" ry="86" fill="url(#baAqua)" opacity="0.74" />
          {/* darker pigment pooling */}
          <ellipse cx="118" cy="104" rx="118" ry="58" fill="#08233f" opacity="0.52" />
          <ellipse cx="244" cy="40" rx="92" ry="52" fill="#0a3a66" opacity="0.46" />
        </g>

        {/* A couple of crisper paint blooms for depth (lighter blur). */}
        <g filter="url(#baDrop)">
          <ellipse cx="392" cy="98" rx="100" ry="52" fill="url(#baCyan)" opacity="0.55" />
          <ellipse cx="560" cy="48" rx="84" ry="40" fill="url(#baLight)" opacity="0.6" />
        </g>

        {/* ── Splatter: scattered droplets + pigment marks into the header ── */}
        <g filter="url(#baDrop)" fill="#06b6d4">
          <circle cx="318" cy="18" r="7" opacity="0.82" />
          <circle cx="372" cy="30" r="4.2" opacity="0.72" />
          <circle cx="262" cy="12" r="3.6" opacity="0.66" />
          <circle cx="440" cy="24" r="5.4" opacity="0.66" />
          <circle cx="512" cy="14" r="3.4" opacity="0.6" />
          <circle cx="596" cy="28" r="4.4" opacity="0.56" />
          <circle cx="668" cy="18" r="3" opacity="0.48" />
          <circle cx="724" cy="36" r="2.6" opacity="0.4" />
          <circle cx="190" cy="156" r="5.2" opacity="0.56" />
          <circle cx="116" cy="170" r="3.4" opacity="0.5" />
          <ellipse cx="350" cy="162" rx="9" ry="5" opacity="0.46" />
          <ellipse cx="476" cy="150" rx="6" ry="3.6" opacity="0.4" />
          <ellipse cx="624" cy="150" rx="5" ry="3" opacity="0.34" />
        </g>
        <g fill="#0d3a6e">
          <circle cx="228" cy="22" r="3.4" opacity="0.56" />
          <circle cx="166" cy="13" r="2.4" opacity="0.5" />
          <ellipse cx="74" cy="160" rx="6" ry="3.4" opacity="0.42" />
        </g>
      </g>

      {/* ── Continuous glowing arch: ONE path from x=0, fading right ── */}
      <g>
        {/* glow underlay */}
        <path
          d="M0,128 C90,92 200,40 430,30 C680,18 980,26 1280,38 C1430,43 1560,42 1700,36"
          fill="none"
          stroke="url(#baArch)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#baGlow)"
          opacity="0.85"
        />
        {/* primary crisp line */}
        <path
          d="M0,128 C90,92 200,40 430,30 C680,18 980,26 1280,38 C1430,43 1560,42 1700,36"
          fill="none"
          stroke="url(#baArch)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        {/* faint companion arcs for depth */}
        <path
          d="M0,154 C100,116 230,60 470,50 C720,40 1020,48 1320,60 C1450,65 1560,64 1660,60"
          fill="none"
          stroke="url(#baArch)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.62"
        />
        <path
          d="M0,104 C80,78 190,30 420,20 C620,12 860,18 1100,28"
          fill="none"
          stroke="url(#baArch)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.52"
        />
      </g>
    </svg>
  );
}
