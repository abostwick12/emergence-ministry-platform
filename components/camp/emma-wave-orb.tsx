"use client";

type EmmaWaveOrbProps = {
  active?: boolean;
};

export function EmmaWaveOrb({ active = false }: EmmaWaveOrbProps) {
  return (
    <span className={active ? "emma-wave-orb active" : "emma-wave-orb"} aria-hidden="true">
      <svg className="emma-wave-orb-svg" viewBox="0 0 64 64" focusable="false">
        <defs>
          <radialGradient id="emmaOrbGlow" cx="34%" cy="24%" r="74%">
            <stop offset="0%" stopColor="#e0faff" />
            <stop offset="34%" stopColor="#0ea5e9" />
            <stop offset="72%" stopColor="#075985" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>
          <linearGradient id="emmaWaveLine" x1="10" x2="56" y1="48" y2="16">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.4" />
            <stop offset="45%" stopColor="#f0f9ff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.64" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#emmaOrbGlow)" />
        <path
          className="emma-wave-orb-swell"
          d="M14 39c8 4 13 1 18-5 5-7 12-11 20-6-5 1-8 4-10 8-5 9-16 14-28 3Z"
          fill="rgba(186,230,253,0.26)"
        />
        <path
          className="emma-wave-orb-crest"
          d="M13 39c8 3 14 1 19-6 5-8 12-11 20-6-6 0-10 3-13 8-5 9-15 14-26 4Z"
          fill="none"
          stroke="url(#emmaWaveLine)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 28c5-6 15-9 24-2"
          fill="none"
          stroke="rgba(240,249,255,0.5)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="23" cy="18" r="7" fill="rgba(240,249,255,0.18)" />
      </svg>
    </span>
  );
}
