import { CampShell } from "@/components/camp/camp-shell";
import { getServerSession } from "@/lib/auth/server";
import { resolvesToCampOnlyShell } from "@/lib/camp/shell-access";
import { redirect } from "next/navigation";

export default async function CampLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const campOnly = await resolvesToCampOnlyShell(session);
  return <CampShell campOnly={campOnly}>{children}</CampShell>;
}
