import { CampShell } from "@/components/camp/camp-shell";
import { getServerSession } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";

export default async function CampLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const campOnly = session ? await resolvesToCampOnly(session) : false;
  return <CampShell campOnly={campOnly}>{children}</CampShell>;
}

async function resolvesToCampOnly(session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>) {
  try {
    return (await resolveCampAccessForRequest(session, null)).appAreaScope === "camp_only";
  } catch {
    return false;
  }
}
