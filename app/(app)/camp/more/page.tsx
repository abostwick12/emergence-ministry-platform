import Link from "next/link";
import { CampCommandCenter } from "@/components/camp-command-center";

// The full lower-frequency Camp toolset (roster entry, transportation, forms,
// medication intake / check-in / schedule / administration log / return, and the
// restricted-medical workflows) is preserved by reusing the existing Command
// Center component rather than rebuilding any workflow. Its internal permission
// gating remains authoritative, so restricted tools stay hidden from unauthorized
// roles.
export default function CampMorePage() {
  return (
    <div className="camp-cc-more">
      <header className="camp-cc-page-head">
        <h1>More Camp tools</h1>
        <p className="camp-cc-muted">Lower-frequency tools. Restricted tools appear only for authorized staff.</p>
      </header>
      <Link href="/camp/safety" className="camp-cc-entry" aria-label="Open Leader Safety view">
        <span className="camp-cc-entry-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" />
            <path d="M9.3 12l1.8 1.8 3.6-3.8" />
          </svg>
        </span>
        <span className="camp-cc-entry-body">
          <strong>Leader Safety</strong>
          <span className="camp-cc-muted">Safety basics for every leader — No leader safety alerts on file.</span>
        </span>
        <span className="camp-cc-entry-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
      <CampCommandCenter />
    </div>
  );
}
