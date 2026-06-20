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
      <CampCommandCenter />
    </div>
  );
}
