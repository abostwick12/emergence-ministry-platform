import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { QuickCaptureButton } from "@/components/command-center/quick-capture-button";

export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!isCommandCenterUser(session)) redirect("/dashboard");

  return (
    <>
      {children}
      <QuickCaptureButton />
    </>
  );
}
