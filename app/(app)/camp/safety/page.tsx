import { CampLeaderSafetyView } from "@/components/camp/camp-leader-safety-view";

// Leader Safety View route. All data and visibility come from the general-leader
// -safe Camp overview; there is no restricted endpoint behind this page, so it is
// safe for any approved leader and never carries medical/medication detail.
export default function CampSafetyPage() {
  return <CampLeaderSafetyView />;
}
