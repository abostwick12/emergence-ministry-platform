export function UnifiedDashboardBrandArt() {
  return (
    <>
      <div className="unified-brand-art" aria-hidden="true" />

      <svg
        className="unified-brand-arch"
        viewBox="0 0 1440 230"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="archStrokeLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.62" />
            <stop offset="20%" stopColor="#0ea5e9" stopOpacity="0.44" />
            <stop offset="46%" stopColor="#3aa7c8" stopOpacity="0.58" />
            <stop offset="68%" stopColor="#69bddb" stopOpacity="0.76" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.28" />
          </linearGradient>
          <filter id="archGlow" x="-10%" y="-160%" width="120%" height="420%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>

        <path
          d="M300 52C468 20 624 10 770 18C900 25 990 43 1060 76C1108 99 1150 128 1185 168"
          fill="none"
          stroke="url(#archStrokeLine)"
          strokeWidth="3.2"
          strokeLinecap="round"
          filter="url(#archGlow)"
          opacity="0.25"
        />
        <path
          d="M300 52C468 20 624 10 770 18C900 25 990 43 1060 76C1108 99 1150 128 1185 168"
          fill="none"
          stroke="url(#archStrokeLine)"
          strokeWidth="1.65"
          strokeLinecap="round"
          opacity="0.82"
        />
        <path
          d="M330 88C560 50 744 60 900 96C1048 130 1190 200 1440 172"
          fill="none"
          stroke="url(#archStrokeLine)"
          strokeWidth="1.05"
          strokeLinecap="round"
          opacity="0.34"
        />
        <g>
          <circle cx="920" cy="47" r="7" fill="#f8fdff" fillOpacity="0.94" stroke="#69bddb" strokeWidth="2" />
          <circle cx="920" cy="47" r="2.3" fill="#67e8f9" fillOpacity="0.72" />
          <circle cx="1130" cy="48" r="7" fill="#f8fdff" fillOpacity="0.94" stroke="#69bddb" strokeWidth="2" />
          <circle cx="1130" cy="48" r="2.3" fill="#67e8f9" fillOpacity="0.72" />
        </g>
      </svg>
    </>
  );
}
