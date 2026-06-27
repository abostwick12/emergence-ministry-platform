import { CampShell } from "@/components/camp/camp-shell";
import { getServerSession } from "@/lib/auth/server";
import { resolvesToCampOnlyShell } from "@/lib/camp/shell-access";

export default async function CampLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const campOnly = session ? await resolvesToCampOnlyShell(session) : false;
  return <CampShell campOnly={campOnly}>{children}</CampShell>;
}
