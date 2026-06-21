import { CampShell } from "@/components/camp/camp-shell";
import { isCampRolePreviewEnabled } from "@/lib/camp/access-control";

// The Camp role-override picker is a development/test affordance only. The server
// (resolveCampAccessForRequest) is always authoritative; this flag merely controls
// whether the picker renders, and is false in Vercel production and normal Preview.
export default function CampLayout({ children }: { children: React.ReactNode }) {
  return <CampShell rolePreviewEnabled={isCampRolePreviewEnabled()}>{children}</CampShell>;
}
